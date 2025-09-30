const Habitacion = require('../../models/Habitacion');
const PrecioBaseXDia = require('../../models/PrecioBaseXDia');
const PreciosEspeciales = require('../../models/PreciosEspeciales');
const BloqueoFechas = require('../../models/BloqueoFechas');
const Usuario = require('../../models/Usuario');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const utilidadesController = require('./../utilidadesController');

// Habitaciones
async function mostrarUnaHabitacion(req, res) {
    try {
        const { id } = req.params;
        const habitacion = await Habitacion.findById(id).lean();
        res.send(habitacion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener habitaciones' });
    }
}

async function mostrarTodasHabitaciones(req, res) {
    try {
        const habitaciones = await Habitacion.find({ isActive: true }).lean();
        res.send(habitaciones);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener habitaciones' });
    }
}


async function cotizadorChaletsyPrecios(req, res) {
    try {
        const { categorias, fechaLlegada, fechaSalida, huespedes, soloDisponibles, isForClient, noVendedor } = req.body;

        // if (!req.session.token && !isForClient) {
        //     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        //         const token = req.headers.authorization.split(' ')[1];
        //         const payload = jwt.verify(token, process.env.JWT_SECRET, {
        //             algorithms: ['HS256'],
        //             clockTolerance: 5,
        //         });

        //         // OJO: toma el id como sub || userId || id (según cómo lo firmaste en login)
        //         const userId = payload.sub || payload.userId || payload.id;
        //         if (!userId) {
        //             return res.status(401).json({ message: 'Invalid token payload' });
        //         }

        //         const user = await Usuario.findById(userId).lean();
        //         if (!user) {
        //             return res.status(401).json({ message: 'Invalid user' });
        //         }

        //         // Emula req.session para tu código legacy
        //         req.session = {
        //             token,
        //             firstName: user.firstName,
        //             lastName: user.lastName,
        //             email: user.email,
        //             privilege: user.privilege,
        //             id: user._id,
        //             userId: String(user._id),
        //             profileImageUrl: user.profileImageUrl ?? null,
        //             role: user.role,
        //             assignedChalets: user.assignedChalets ?? [],
        //         };
        //     } else {
        //         return res.status(401).json({ message: 'Por inactividad, es necesario recargar la página para continuar' });
        //     }
        // }

        let filtro = {};

        if (!categorias.includes("all")) { //Si se seleccionaron categorias
            if (isForClient) {
                if (categorias.length > 1) {
                    for (let categoria of categorias) {
                        categorias.push(categoria.toLowerCase());
                    }
                } else {
                    categorias.push(categorias[0].toLowerCase());
                }
                console.log(categorias)
                filtro = {
                    "location.population": { $in: categorias },
                    "propertyDetails.maxOccupancy": { $gte: huespedes },
                    "propertyDetails.minOccupancy": { $lte: huespedes },
                    isActive: true
                }
            } else {
                filtro = {
                    "propertyDetails.accomodationType": { $in: categorias },
                    "propertyDetails.maxOccupancy": { $gte: huespedes },
                    "propertyDetails.minOccupancy": { $lte: huespedes },
                    isActive: true
                }
            };
        } else { // Si se mostrara todo
            filtro = {
                "propertyDetails.maxOccupancy": { $gte: huespedes },
                "propertyDetails.minOccupancy": { $lte: huespedes },
                isActive: true
            };
        }


        const startDate = new Date(convertirFechaES(fechaLlegada));
        startDate.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC
        const endDate = new Date(convertirFechaES(fechaSalida));
        endDate.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC


        const timeDifference = endDate.getTime() - startDate.getTime();
        const nNights = Math.ceil(timeDifference / (1000 * 3600 * 24)); // Calcula la diferencia en días
        if (nNights <= 0) {
            return res.status(400).json({ message: 'La fecha de salida debe ser posterior a la fecha de llegada' });
        }


        const chalets = await Habitacion.find(filtro).lean();
        const chaletIds = chalets.map(chalet => chalet._id);
        if (!chalets) {
            throw new Error('No se encontraron habitaciones');
        }


        let availableChalets = chalets;

        const fechaAjustada = moment(startDate).add(6, 'hours').toDate(); // Ajustar la hora a 00:00:00 UTC

        if (soloDisponibles) {
            availableChalets = [];
            for (const chalet of chalets) {
                const disponibilidadPax = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: chalet._id, type: 'capacidad_minima' });
                if (disponibilidadPax) {
                    if (huespedes < disponibilidadPax.min) {
                        continue;
                    }
                }
                const disponibilidadNochesMinimas = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: chalet._id, type: 'restriccion' });
                if (disponibilidadNochesMinimas) {
                    if (nNights < disponibilidadNochesMinimas.min) {
                        continue;
                    }
                }

                const disponibilidad = await getDisponibilidad(chalet._id, startDate, endDate);
                if (disponibilidad) {
                    availableChalets.push(chalet);
                }
            }
        }



        const mappedChalets = availableChalets.map(chalet => ({

            id: chalet._id,
            name: chalet.propertyDetails.name,
            minPax: chalet.propertyDetails.minOccupancy,
            maxPax: chalet.propertyDetails.maxOccupancy,
            precioBase: chalet.others.basePrice,
            precioBase2noches: chalet.others.basePrice2nights,
            costoBase: chalet.others.baseCost,
            costoBase2noches: chalet.others.baseCost2nights,
            images: chalet.images,
            accomodationFeatures: chalet.accommodationFeatures,
            accomodationDescription: chalet.accomodationDescription,
            nBeds: chalet.additionalInfo.nBeds,
            nRestrooms: chalet.additionalInfo.nRestrooms
        }));

        const eventoParaReservar = {
            nights: nNights,
            fechaLlegada: fechaLlegada,
            fechaSalida: fechaSalida,
            huespedes: huespedes
        }

        const infoComisiones = {
            userId: req.session.id,
            nNights: nNights,
            noVendedor: noVendedor

        }
        const comisiones = await utilidadesController.calcularComisionesInternas(infoComisiones);

        if (!comisiones) {
            throw new Error("No se encontró al usuario");
        }


        if (startDate > endDate) {
            throw new Error("La fecha de llegada debe ser anterior a la fecha de salida");
        }

        for (const chalet of mappedChalets) {
            let precioTotal = 0;
            let costoBaseTotal = 0;

            let currentDate = new Date(startDate);
            //Calculando precio para:  2025-09-03T00:00:00.000Z  - Hasta:  2025-09-05T00:00:00.000Z
            while (currentDate <= endDate) {
                currentDate.setUTCHours(6);
                precio = await PreciosEspeciales.findOne({ fecha: currentDate, habitacionId: chalet.id, noPersonas: huespedes });
                if (precio) {
                    if (nNights > 1) {
                        precioTotal += precio.precio_base_2noches;
                        costoBaseTotal += precio.costo_base_2noches;
                    } else {
                        precioTotal += precio.precio_modificado;
                        costoBaseTotal += precio.costo_base;
                    }
                } else {
                    precio = await PrecioBaseXDia.findOne({ fecha: currentDate, habitacionId: chalet.id });
                    if (precio) {
                        if (nNights > 1) {
                            precioTotal += precio.precio_base_2noches;
                            costoBaseTotal += precio.costo_base_2noches;
                        } else {
                            precioTotal += precio.precio_modificado;
                            costoBaseTotal += precio.costo_base;
                        }
                    } else {
                        if (nNights > 1) {
                            precioTotal += chalet.precioBase2noches;
                            costoBaseTotal += chalet.costoBase2noches;
                        } else {
                            precioTotal += chalet.precioBase;
                            costoBaseTotal += chalet.costoBase;
                        }
                    }

                }
                currentDate.setDate(currentDate.getDate() + 1); // Avanzar un día
            }
            chalet.totalPriceNoComs = precioTotal;
            chalet.totalPrice = precioTotal + comisiones;
            chalet.totalCost = costoBaseTotal;
            // eventoParaReservar.precioTotal = chalet.price;
            console.log("Precio Total: ", precioTotal);
            // chalet.price = precioTotal;
        }


        res.status(200).json({ chalets: mappedChalets, evento: eventoParaReservar }); // Enviar los datos de las habitaciones y el eventomappedChalets

    } catch (error) {
        console.error('Error al obtener habitaciones y precios:', error);
        res.status(500).json({ message: 'Error al obtener habitaciones y precios: ' + error.message });
    }
}

function convertirFechaES(fecha) {
    const [dia, mes, anio] = fecha.split("/");
    return `${anio}-${mes}-${dia}`; // Formato YYYY-MM-DD
}

async function getDisponibilidad(chaletId, fechaLlegada, fechaSalida) {
    const newResourceId = new mongoose.Types.ObjectId(chaletId);

    // Convertir fechas a cadenas en formato YYYY-MM-DD
    const fechaLlegadaStr = fechaLlegada.toISOString().split('T')[0]; // Extrae solo la fecha (YYYY-MM-DD)
    const fechaSalidaStr = fechaSalida.toISOString().split('T')[0]; // Extrae solo la fecha (YYYY-MM-DD)

    const arrivalDateObj = new Date(fechaLlegada);
    const departureDateObj = new Date(fechaSalida);

    // Set specific times
    arrivalDateObj.setUTCHours(17, 30, 0, 0); // 17:30:00 UTC
    departureDateObj.setUTCHours(13, 0, 0, 0); // 14:30:00 UTC

    // Convert back to ISO strings
    const arrivalDateISO = arrivalDateObj.toISOString();
    const departureDateISO = departureDateObj.toISOString();

    console.log("ARRIVAL DATE: ", arrivalDateISO, "DEPARTURE DATE: ", departureDateISO);

    const arrivalDateBloqueo = new Date(`${fechaLlegadaStr}T10:00:00`).toISOString();
    const departureDateBloqueo = new Date(`${fechaSalidaStr}T06:00:00`).toISOString();

    // console.log("ARRIVAL DATE: ", arrivalDateISO, "DEPARTURE DATE: ", departureDateISO);
    // Verificar fechas bloqueadas
    let fechaAjustada = new Date(fechaLlegada);
    const departureDateAjustada = new Date(fechaSalida);
    departureDateAjustada.setUTCHours(6);
    let currentDate = new Date(fechaAjustada);
    currentDate.setUTCHours(17);

    let isBlocked = false;
    while (currentDate <= departureDateAjustada) {
        const fechasBloqueadas = await BloqueoFechas.findOne({ date: currentDate, habitacionId: newResourceId, type: 'bloqueo' });
        if (fechasBloqueadas) {
            isBlocked = true;
            break;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (isBlocked) {
        console.log("FECHAS BLOQUEADAS ENCONTRADAS");
        return false;
    }

    // Verificar eventos superpuestos
    const overlappingEvents = await Documento.find({
        resourceId: newResourceId,
        status: { $nin: ["cancelled", "no-show", "playground"] },
        $or: [
            { arrivalDate: { $lt: departureDateISO }, departureDate: { $gt: arrivalDateISO } },
        ],
    });

    if (overlappingEvents.length > 0) {
        console.log("EVENTOS SUPERPUESTOS ENCONTRADOS");
        console.log(overlappingEvents);
        return false;
    }

    return true;
}


module.exports = {
    mostrarUnaHabitacion,
    mostrarTodasHabitaciones,
    cotizadorChaletsyPrecios,
}