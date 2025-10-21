const Habitacion = require('../../models/Habitacion');
const PrecioBaseXDia = require('../../models/PrecioBaseXDia');
const PreciosEspeciales = require('../../models/PreciosEspeciales');
const BloqueoFechas = require('../../models/BloqueoFechas');
const Costos = require('../../models/Costos');
const Reservas = require('../../models/Evento');
const Usuario = require('../../models/Usuario');
const Cliente = require('../../models/Cliente');
const ClienteWeb = require('../../models/ClienteWeb');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const utilidadesController = require('./../utilidadesController');
const logController = require('../logController');
const channexController = require('../channexController');
const sendEmail = require('../../common/tasks/send-mails');
const rackLimpiezaController = require('../rackLimpiezaController');
const SendMessages = require('../../common/tasks/send-messages');

const web = 'fernando';

const COMISSIONS_MAP = {
    'fernando': 'VENDEDOR VIRTUAL 1',
    'carlos': 'VENDEDOR VIRTUAL 2',
    'externo': 'VENDEDOR VIRTUAL 3'
};

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


// async function cotizadorChaletsyPrecios(req, res) {
//     try {
//         const { categorias, fechaLlegada, fechaSalida, huespedes, soloDisponibles, isForClient, noVendedor } = req.body;

//         // if (!req.session.token && !isForClient) {
//         //     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
//         //         const token = req.headers.authorization.split(' ')[1];
//         //         const payload = jwt.verify(token, process.env.JWT_SECRET, {
//         //             algorithms: ['HS256'],
//         //             clockTolerance: 5,
//         //         });

//         //         // OJO: toma el id como sub || userId || id (según cómo lo firmaste en login)
//         //         const userId = payload.sub || payload.userId || payload.id;
//         //         if (!userId) {
//         //             return res.status(401).json({ message: 'Invalid token payload' });
//         //         }

//         //         const user = await Usuario.findById(userId).lean();
//         //         if (!user) {
//         //             return res.status(401).json({ message: 'Invalid user' });
//         //         }

//         //         // Emula req.session para tu código legacy
//         //         req.session = {
//         //             token,
//         //             firstName: user.firstName,
//         //             lastName: user.lastName,
//         //             email: user.email,
//         //             privilege: user.privilege,
//         //             id: user._id,
//         //             userId: String(user._id),
//         //             profileImageUrl: user.profileImageUrl ?? null,
//         //             role: user.role,
//         //             assignedChalets: user.assignedChalets ?? [],
//         //         };
//         //     } else {
//         //         return res.status(401).json({ message: 'Por inactividad, es necesario recargar la página para continuar' });
//         //     }
//         // }

//         let filtro = {};

//         if (!categorias.includes("all")) { //Si se seleccionaron categorias
//             if (isForClient) {
//                 if (categorias.length > 1) {
//                     for (let categoria of categorias) {
//                         categorias.push(categoria.toLowerCase());
//                     }
//                 } else {
//                     categorias.push(categorias[0].toLowerCase());
//                 }
//                 console.log(categorias)
//                 filtro = {
//                     "location.population": { $in: categorias },
//                     "propertyDetails.maxOccupancy": { $gte: huespedes },
//                     "propertyDetails.minOccupancy": { $lte: huespedes },
//                     isActive: true
//                 }
//             } else {
//                 filtro = {
//                     "propertyDetails.accomodationType": { $in: categorias },
//                     "propertyDetails.maxOccupancy": { $gte: huespedes },
//                     "propertyDetails.minOccupancy": { $lte: huespedes },
//                     isActive: true
//                 }
//             };
//         } else { // Si se mostrara todo
//             filtro = {
//                 "propertyDetails.maxOccupancy": { $gte: huespedes },
//                 "propertyDetails.minOccupancy": { $lte: huespedes },
//                 isActive: true
//             };
//         }


//         const startDate = new Date(convertirFechaES(fechaLlegada));
//         startDate.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC
//         const endDate = new Date(convertirFechaES(fechaSalida));
//         endDate.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC


//         const timeDifference = endDate.getTime() - startDate.getTime();
//         const nNights = Math.ceil(timeDifference / (1000 * 3600 * 24)); // Calcula la diferencia en días
//         if (nNights <= 0) {
//             return res.status(400).json({ message: 'La fecha de salida debe ser posterior a la fecha de llegada' });
//         }


//         const chalets = await Habitacion.find(filtro).lean();
//         const chaletIds = chalets.map(chalet => chalet._id);
//         if (!chalets) {
//             throw new Error('No se encontraron habitaciones');
//         }


//         let availableChalets = chalets;

//         const fechaAjustada = moment(startDate).add(6, 'hours').toDate(); // Ajustar la hora a 00:00:00 UTC

//         if (soloDisponibles) {
//             availableChalets = [];
//             for (const chalet of chalets) {
//                 const disponibilidadPax = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: chalet._id, type: 'capacidad_minima' });
//                 if (disponibilidadPax) {
//                     if (huespedes < disponibilidadPax.min) {
//                         continue;
//                     }
//                 }
//                 const disponibilidadNochesMinimas = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: chalet._id, type: 'restriccion' });
//                 if (disponibilidadNochesMinimas) {
//                     if (nNights < disponibilidadNochesMinimas.min) {
//                         continue;
//                     }
//                 }

//                 const disponibilidad = await getDisponibilidad(chalet._id, startDate, endDate);
//                 if (disponibilidad) {
//                     availableChalets.push(chalet);
//                 }
//             }
//         }



//         const mappedChalets = availableChalets.map(chalet => ({

//             id: chalet._id,
//             name: chalet.propertyDetails.name,
//             minPax: chalet.propertyDetails.minOccupancy,
//             maxPax: chalet.propertyDetails.maxOccupancy,
//             precioBase: chalet.others.basePrice,
//             precioBase2noches: chalet.others.basePrice2nights,
//             costoBase: chalet.others.baseCost,
//             costoBase2noches: chalet.others.baseCost2nights,
//             images: chalet.images,
//             accomodationFeatures: chalet.accommodationFeatures,
//             accomodationDescription: chalet.accomodationDescription,
//             nBeds: chalet.additionalInfo.nBeds,
//             nRestrooms: chalet.additionalInfo.nRestrooms
//         }));

//         const eventoParaReservar = {
//             nights: nNights,
//             fechaLlegada: fechaLlegada,
//             fechaSalida: fechaSalida,
//             huespedes: huespedes
//         }

//         const infoComisiones = {
//             userId: req.session.id,
//             nNights: nNights,
//             noVendedor: noVendedor

//         }
//         const comisiones = await utilidadesController.calcularComisionesInternas(infoComisiones);

//         if (!comisiones) {
//             throw new Error("No se encontró al usuario");
//         }


//         if (startDate > endDate) {
//             throw new Error("La fecha de llegada debe ser anterior a la fecha de salida");
//         }

//         for (const chalet of mappedChalets) {
//             let precioTotal = 0;
//             let costoBaseTotal = 0;

//             let currentDate = new Date(startDate);
//             //Calculando precio para:  2025-09-03T00:00:00.000Z  - Hasta:  2025-09-05T00:00:00.000Z
//             while (currentDate <= endDate) {
//                 currentDate.setUTCHours(6);
//                 precio = await PreciosEspeciales.findOne({ fecha: currentDate, habitacionId: chalet.id, noPersonas: huespedes });
//                 if (precio) {
//                     if (nNights > 1) {
//                         precioTotal += precio.precio_base_2noches;
//                         costoBaseTotal += precio.costo_base_2noches;
//                     } else {
//                         precioTotal += precio.precio_modificado;
//                         costoBaseTotal += precio.costo_base;
//                     }
//                 } else {
//                     precio = await PrecioBaseXDia.findOne({ fecha: currentDate, habitacionId: chalet.id });
//                     if (precio) {
//                         if (nNights > 1) {
//                             precioTotal += precio.precio_base_2noches;
//                             costoBaseTotal += precio.costo_base_2noches;
//                         } else {
//                             precioTotal += precio.precio_modificado;
//                             costoBaseTotal += precio.costo_base;
//                         }
//                     } else {
//                         if (nNights > 1) {
//                             precioTotal += chalet.precioBase2noches;
//                             costoBaseTotal += chalet.costoBase2noches;
//                         } else {
//                             precioTotal += chalet.precioBase;
//                             costoBaseTotal += chalet.costoBase;
//                         }
//                     }

//                 }
//                 currentDate.setDate(currentDate.getDate() + 1); // Avanzar un día
//             }
//             chalet.totalPriceNoComs = precioTotal;
//             chalet.totalPrice = precioTotal + comisiones;
//             chalet.totalCost = costoBaseTotal;
//             // eventoParaReservar.precioTotal = chalet.price;
//             console.log("Precio Total: ", precioTotal);
//             // chalet.price = precioTotal;
//         }


//         res.status(200).json({ chalets: mappedChalets, evento: eventoParaReservar }); // Enviar los datos de las habitaciones y el eventomappedChalets

//     } catch (error) {
//         console.error('Error al obtener habitaciones y precios:', error);
//         res.status(500).json({ message: 'Error al obtener habitaciones y precios: ' + error.message });
//     }
// }




async function cotizadorChaletsyPrecios(req, res) {
    try {
        // 1. Extraer parámetros de query string
        const { location, guests, checkIn, checkOut, beds, bathrooms, amenities } = req.query;

        // 2. Validar parámetros requeridos
        if (!guests || !checkIn || !checkOut) {
            return res.status(400).json({
                error: 'Faltan parámetros requeridos',
                required: ['guests', 'checkIn', 'checkOut'],
                received: { location, guests, checkIn, checkOut, beds, bathrooms, amenities }
            });
        }

        // 3. Validar y convertir tipos
        const guestsNumber = parseInt(guests);
        if (isNaN(guestsNumber) || guestsNumber < 1) {
            return res.status(400).json({
                error: 'El número de huéspedes debe ser un número válido mayor a 0'
            });
        }

        // 4. Validar formato de fechas
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
            return res.status(400).json({
                error: 'Formato de fechas inválido. Use YYYY-MM-DD'
            });
        }

        if (checkOutDate <= checkInDate) {
            return res.status(400).json({
                error: 'La fecha de salida debe ser posterior a la fecha de llegada'
            });
        }

        // 5. Parsear filtros adicionales
        let amenitiesArray = [];
        if (amenities) {
            try {
                // Intentar parsear como JSON array
                amenitiesArray = JSON.parse(amenities);
            } catch (error) {
                // Fallback: si no es JSON válido, tratarlo como array de query params
                amenitiesArray = Array.isArray(amenities) ? amenities : [amenities];
            }
        }

        const bedsNumber = beds && beds !== 'any' ? parseInt(beds) : null;
        const bathroomsNumber = bathrooms && bathrooms !== 'any' ? parseInt(bathrooms) : null;

        // console.log('Filtros adicionales:', {
        //     beds: bedsNumber,
        //     bathrooms: bathroomsNumber,
        //     amenities: amenitiesArray
        // });

        // 6. Construir query de búsqueda basado en los campos de HabitacionesResponse
        const searchQuery = {
            // Filtrar por capacidad de huéspedes
            $and: [
                { 'propertyDetails.maxOccupancy': { $gte: guestsNumber } },
                { 'propertyDetails.minOccupancy': { $lte: guestsNumber } }
            ],
            // Solo habitaciones activas/disponibles
            isActive: true,
        };

        // 7. Agregar filtro de ubicación solo si se proporciona y no es 'any' o vacío
        if (location && location.trim() !== '' && location !== 'any') {
            const locationDecoded = decodeURIComponent(location);
            const locationRegex = new RegExp(locationDecoded, 'i'); // Case insensitive

            // Búsqueda flexible por ubicación
            searchQuery.$and.push({
                $or: [
                    { 'propertyDetails.name': locationRegex },
                    { 'location.state': locationRegex },
                    { 'location.population': locationRegex },
                    { 'location.country': locationRegex },
                    // También buscar en la combinación "población, estado"
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $concat: ['$location.population', ', ', '$location.state'] },
                                regex: locationRegex.source,
                                options: 'i'
                            }
                        }
                    }
                ]
            });
        }

        // 8. Agregar filtro de camas si se proporciona
        if (bedsNumber !== null && bedsNumber > 0) {
            searchQuery.$and.push({
                'additionalInfo.nBeds': { $gte: bedsNumber }
            });
        }

        // 9. Agregar filtro de baños si se proporciona
        if (bathroomsNumber !== null && bathroomsNumber > 0) {
            searchQuery.$and.push({
                'additionalInfo.nRestrooms': { $gte: bathroomsNumber }
            });
        }

        // 10. Agregar filtro de amenidades si se proporciona
        if (amenitiesArray && amenitiesArray.length > 0) {
            const amenityConditions = amenitiesArray.map(amenity => {
                // Construir condiciones para buscar amenidades en todas las categorías
                return {
                    $or: [
                        { [`accommodationFeatures.generalFeatures.${amenity}`]: true },
                        { [`accommodationFeatures.parking.${amenity}`]: true },
                        { [`accommodationFeatures.kitchen.${amenity}`]: true },
                        { [`accommodationFeatures.activities.${amenity}`]: true },
                        { [`accommodationFeatures.views.${amenity}`]: true },
                        { [`accommodationFeatures.livingRoom.${amenity}`]: true },
                        { [`accommodationFeatures.bedroom.${amenity}`]: true },
                        { [`accommodationFeatures.bathroom.${amenity}`]: true },
                        { [`accommodationFeatures.exterior.${amenity}`]: true },
                        { [`accommodationFeatures.services.${amenity}`]: true }
                    ]
                };
            });

            // Todas las amenidades deben estar presentes (AND)
            searchQuery.$and.push(...amenityConditions);
        }


        // 11. Buscar habitaciones que cumplan los criterios
        const habitaciones = await Habitacion.find(searchQuery)
            .sort({ 'others.basePrice': 1 })
            .lean(); // Para mejor performance


        // 12. Filtrar por disponibilidad de fechas (si tienes sistema de reservas)
        const habitacionesDisponibles = await filtrarPorDisponibilidad(
            habitaciones,
            checkInDate,
            checkOutDate
        );


        // 13. Calcular precios para cada habitación
        const habitacionesConPrecios = await Promise.all(habitacionesDisponibles.map(async habitacion => {
            const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
            const precios = await consultarPreciosPorFechas(checkInDate, checkOutDate, habitacion, guestsNumber);

            return {
                ...habitacion,
                precioCalculado: precios,
                noches: nights,
                fechaConsulta: {
                    checkIn: checkInDate,
                    checkOut: checkOutDate,
                    huespedes: guestsNumber
                }
            };
        }));

        // 14. Ordenar por precio (opcional)
        // habitacionesConPrecios.sort((a, b) => a.precioCalculado - b.precioCalculado);
        // console.log(JSON.stringify(habitacionesConPrecios[0], null, 2));
        // 15. Respuesta exitosa
        res.status(200).json({
            success: true,
            data: habitacionesConPrecios,
            searchParams: {
                location: location || 'any',
                guests: guestsNumber,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                beds: bedsNumber,
                bathrooms: bathroomsNumber,
                amenities: amenitiesArray
            },
            totalResults: habitacionesConPrecios.length,
            message: habitacionesConPrecios.length > 0
                ? `Se encontraron ${habitacionesConPrecios.length} habitaciones disponibles`
                : 'No se encontraron habitaciones que cumplan con los criterios de búsqueda',
            appliedFilters: {
                hasLocationFilter: !!(location && location !== 'any'),
                hasBedsFilter: bedsNumber !== null,
                hasBathroomsFilter: bathroomsNumber !== null,
                hasAmenitiesFilter: amenitiesArray.length > 0,
                amenitiesCount: amenitiesArray.length
            }
        });

    } catch (error) {
        console.error('Error en cotizadorChaletsyPrecios:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

async function cotizarReserva(habitacionId, checkIn, checkOut, guests) {
    try {
        // Validar parámetros
        if (!habitacionId || !checkIn || !checkOut || !guests) {
            throw new Error('Faltan parámetros requeridos: habitacionId, checkIn, checkOut, guests');
        }

        // Validar fechas
        const fechaLlegada = new Date(checkIn);
        const fechaSalida = new Date(checkOut);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (fechaLlegada < hoy) {
            return {
                success: false,
                available: false,
                error: 'La fecha de llegada no puede ser anterior a hoy',
                errorType: 'INVALID_DATE'
            };
        }

        if (fechaSalida <= fechaLlegada) {
            return {
                success: false,
                available: false,
                error: 'La fecha de salida debe ser posterior a la fecha de llegada',
                errorType: 'INVALID_DATE_RANGE'
            };
        }

        // Buscar la habitación
        const habitacion = await Habitacion.findById(habitacionId);
        if (!habitacion) {
            return {
                success: false,
                available: false,
                error: 'Habitación no encontrada',
                errorType: 'CABIN_NOT_FOUND'
            };
        }

        // Validar capacidad
        if (guests > habitacion.propertyDetails.maxOccupancy) {
            return {
                success: false,
                available: false,
                error: `La capacidad máxima es de ${habitacion.propertyDetails.maxOccupancy} huéspedes`,
                errorType: 'CAPACITY_EXCEEDED'
            };
        }

        if (guests < habitacion.propertyDetails.minOccupancy) {
            return {
                success: false,
                available: false,
                error: `La capacidad mínima es de ${habitacion.propertyDetails.minOccupancy} huéspedes`,
                errorType: 'CAPACITY_INSUFFICIENT'
            };
        }

        // Verificar disponibilidad
        const habitacionesDisponibles = await filtrarPorDisponibilidad([habitacion], checkIn, checkOut);

        if (habitacionesDisponibles.length === 0) {
            return {
                success: false,
                available: false,
                error: 'La habitación no está disponible para las fechas seleccionadas',
                errorType: 'NOT_AVAILABLE'
            };
        }

        // Calcular precios
        const precioCalculado = await consultarPreciosPorFechas(checkIn, checkOut, habitacion, guests);

        // Calcular noches
        const nights = Math.ceil((fechaSalida - fechaLlegada) / (1000 * 60 * 60 * 24));

        return {
            success: true,
            available: true,
            habitacion: {
                _id: habitacion._id,
                name: habitacion.propertyDetails.name,
                maxOccupancy: habitacion.propertyDetails.maxOccupancy,
                minOccupancy: habitacion.propertyDetails.minOccupancy
            },
            booking: {
                checkIn,
                checkOut,
                guests,
                nights
            },
            precioCalculado,
            pricing: {
                basePrice: precioCalculado.costoBaseFinal,
                totalPrice: precioCalculado.precioBaseFinal,
                pricePerNight: Math.round(precioCalculado.precioBaseFinal / nights),
                cleaningFee: habitacion.additionalInfo?.extraCleaningCost || 0,
                totalWithFees: precioCalculado.precioBaseFinal + (habitacion.additionalInfo?.extraCleaningCost || 0)
            }
        };

    } catch (error) {
        console.error('Error en cotizarReserva:', error);
        return {
            success: false,
            available: false,
            error: 'Error interno del servidor: ' + error.message,
            errorType: 'SERVER_ERROR'
        };
    }
}

async function cotizarReservaController(req, res) {
    try {
        const { habitacionId, checkIn, checkOut, guests } = req.body;

        const resultado = await cotizarReserva(habitacionId, checkIn, checkOut, guests);

        if (resultado.success) {
            res.status(200).json(resultado);
        } else {
            // Determinar código de estado según el tipo de error
            let statusCode = 400;
            if (resultado.errorType === 'NOT_AVAILABLE' || resultado.errorType === 'INVALID_DATE' || resultado.errorType === 'INVALID_DATE_RANGE') statusCode = 400;
            if (resultado.errorType === 'CABIN_NOT_FOUND') statusCode = 404;
            if (resultado.errorType === 'SERVER_ERROR') statusCode = 500;

            res.status(statusCode).json(resultado);
        }

    } catch (error) {
        console.error('Error en cotizarReservaController:', error);
        res.status(500).json({
            success: false,
            available: false,
            error: 'Error interno del servidor',
            errorType: 'SERVER_ERROR'
        });
    }
}

// Función auxiliar para filtrar por disponibilidad
async function filtrarPorDisponibilidad(habitaciones, checkIn, checkOut) {
    // Si tienes un modelo de Reservas, verifica disponibilidad
    if (typeof Reservas !== 'undefined') {
        const habitacionesDisponibles = [];

        for (const habitacion of habitaciones) {
            const disponible = await getDisponibilidad(habitacion._id, checkIn, checkOut);

            if (disponible) {
                habitacionesDisponibles.push(habitacion);
            }
        }

        return habitacionesDisponibles;
    }

    // Si no tienes sistema de reservas, devolver todas
    return habitaciones;
}



function convertirFechaES(fecha) {
    const [dia, mes, anio] = fecha.split("/");
    return `${anio}-${mes}-${dia}`; // Formato YYYY-MM-DD
}

async function consultarPreciosPorFechas(fechaLlegada, fechaSalida, habitacion, pax) {
    try {

        // console.log({ fechaLlegada, fechaSalida, habitacion, pax });

        const habitacionid = habitacion._id;

        const nNights = Math.ceil((new Date(fechaSalida) - new Date(fechaLlegada)) / (1000 * 60 * 60 * 24));

        const usuarioWeb = COMISSIONS_MAP[web];
        if (!usuarioWeb) {
            throw new Error("No se encontró el usuario para comisiones");
        }

        const costoComision = await Costos.findOne({ costName: usuarioWeb });
        if (!costoComision) {
            throw new Error("No se encontró el costo para el usuario de comisiones");
        }

        const montoComision = costoComision.amount;

        // const comisiones = await utilidadesController.calcularComisionesInternas({
        //     userId: req.session.id,
        //     nNights: nNights,
        // });

        // console.log("comisionesss: ", comisiones);    

        let precio = null;
        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fechaLlegada);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC

        let currentDate = new Date(fechaAjustada);
        currentDate.setUTCHours(6);

        const fechaLimite = new Date(fechaSalida);
        fechaLimite.setUTCHours(6);

        const precios = [];

        while (currentDate < fechaLimite) {

            // const fechasBloqueadasPorCapacidad = await BloqueoFechas.findOne({ date: currentDate, habitacionId: habitacionid, type: 'capacidad_minima' });
            // if (fechasBloqueadasPorCapacidad) {
            //     console.log("current date: ", currentDate);
            //     console.log("fechasBloqueadasPorCapacidad: ", fechasBloqueadasPorCapacidad);
            //     if (pax < fechasBloqueadasPorCapacidad.min) {
            //         return res.status(400).send({ mensaje: `La capacidad minima es de ${fechasBloqueadasPorCapacidad.min} personas` });
            //     }
            // }


            precio = await PreciosEspeciales.findOne({ fecha: currentDate, habitacionId: habitacionid, noPersonas: pax })
            if (precio) {
                precio.precio_modificado += montoComision;
                precio.precio_base_2noches += montoComision;
            }

            if (!precio) {
                precio = await PrecioBaseXDia.findOne({ fecha: currentDate, habitacionId: habitacionid });
                if (precio) {
                    precio.precio_modificado += montoComision;
                    precio.precio_base_2noches += montoComision;
                }

            }

            if (precio === null) {

                precio = await PrecioBaseXDia.findOne({ fecha: currentDate, habitacionId: habitacionid });

                if (!precio) {

                    if (!habitacion) {
                        throw new Error('Habitacion no encontrada');
                    }

                    precio = {
                        costo_base: habitacion.others.baseCost,
                        costo_base_2noches: habitacion.others.baseCost2nights,
                        precio_modificado: habitacion.others.basePrice + montoComision,
                        precio_base_2noches: habitacion.others.basePrice2nights + montoComision,
                    }
                    precios.push(precio);
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }


            }

            precios.push(precio);

            currentDate.setDate(currentDate.getDate() + 1);
        }

        const twoOrMoreNights = precios.length > 1;
        const costoBaseFinal = twoOrMoreNights ? precios.reduce((total, precio) => total + precio.costo_base_2noches, 0) : precios[0].costo_base;
        let precioBaseFinal = twoOrMoreNights ? precios.reduce((total, precio) => total + precio.precio_base_2noches, 0) : precios[0].precio_modificado;
        const precioTotalSinComision = precioBaseFinal - montoComision;
        const comisionServicio = 35;
        precioBaseFinal += comisionServicio;
        // precioBaseFinal += montoComision;
        // console.log({ precios, costoBaseFinal, precioBaseFinal, precioTotalSinComision });
        return { precios, precioBaseFinal, costoBaseFinal, precioTotalSinComision, comisionServicio };
        // res.json({precios, costoBaseFinal, precioBaseFinal, precioTotalSinComision});
    } catch (error) {
        console.error(error);
        throw new Error('Error al consultar precios: ' + error.message);
    }
}

async function getDisponibilidad(chaletId, fechaLlegada, fechaSalida) {
    const newResourceId = String(chaletId);
    if (!(fechaLlegada instanceof Date)) {
        fechaLlegada = new Date(fechaLlegada);
    }
    if (!(fechaSalida instanceof Date)) {
        fechaSalida = new Date(fechaSalida);
    }

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
        return false;
    }

    // Verificar eventos superpuestos
    const overlappingEvents = await Reservas.find({
        resourceId: newResourceId,
        status: { $nin: ["cancelled", "no-show", "playground"] },
        $or: [
            { arrivalDate: { $lt: departureDateISO }, departureDate: { $gt: arrivalDateISO } },
        ],
    });

    if (overlappingEvents.length > 0) {
        return false;
    }

    return true;
}


// Reservas

/**
 * Crea una reservación para un cliente, manejando tanto clientes web como clientes normales
 * @param {Object} reservationData - Datos de la reservación
 * @param {string} status - Estado de la reservación ('active', 'pending', etc.)
 * @param {string} paymentStatus - Estado del pago ('PAID', 'UNPAID', etc.)
 * @param {number} balanceDue - Balance pendiente
 * @param {string|null} clienteWebId - ID del cliente web (opcional). Si se proporciona, se vinculará con un cliente normal
 * @returns {Object} Nueva reservación creada
 */
async function createReservationForClient(reservationData, status, paymentStatus, balanceDue, clienteWebId = null) {
    const guestInfo = reservationData.guestInfo;
    const pricing = reservationData.pricing;


    try {
        const chalet = await Habitacion.findById(reservationData.cabinId).select('propertyDetails others');
        const arrivalDate = moment(reservationData.checkIn).toDate();
        const departureDate = moment(reservationData.checkOut).toDate();

        const cabinArrivalHour = chalet.others.arrivalTime?.getHours();
        arrivalDate.setUTCHours(cabinArrivalHour || 15, 0, 0, 0);

        const cabinDepartureHour = chalet.others.departureTime?.getHours();
        departureDate.setUTCHours(cabinDepartureHour || 11, 0, 0, 0);

        let client = null;
        let isWebClient = false;

        // Si se proporciona un ID de cliente web, usar ese cliente
        if (clienteWebId) {
            const clienteWeb = await ClienteWeb.findById(clienteWebId);
            
            if (clienteWeb) {
                // Buscar si ya existe un cliente normal con el mismo email
                client = await Cliente.findOne({ email: clienteWeb.email.toLowerCase().trim() });
                
                if (!client) {
                    // Crear cliente normal basado en los datos del cliente web
                    const newClient = new Cliente({
                        firstName: clienteWeb.firstName || guestInfo.firstName,
                        lastName: clienteWeb.lastName || guestInfo.lastName,
                        email: clienteWeb.email,
                        phone: clienteWeb.phone || guestInfo.phone,
                        address: clienteWeb.address || guestInfo.address || 'Por definir',
                        // Agregar referencia al cliente web
                        clienteWebId: clienteWebId,
                        isWebClient: true
                    });
                    await newClient.save();
                    client = newClient;
                } else {
                    // Actualizar el cliente existente para vincularlo al cliente web
                    client.clienteWebId = clienteWebId;
                    client.isWebClient = true;
                    await client.save();
                }
                
                isWebClient = true;
            }
        }

        // Si no hay cliente web o no se encontró, proceder con la lógica original
        if (!client) {
            const clientEmail = guestInfo.email.toLowerCase().trim();
            if (clientEmail) {
                client = await Cliente.findOne({ email: clientEmail });
            }

            if (!client) {
                // Crear nuevo cliente normal
                const newClient = new Cliente({
                    firstName: guestInfo.firstName,
                    lastName: guestInfo.lastName,
                    email: guestInfo.email,
                    phone: guestInfo.phone,
                    address: guestInfo.address || 'Por definir',
                    isWebClient: false
                });
                await newClient.save();
                client = newClient;
            }
        }

        console.log(`Cliente ${isWebClient ? 'web' : 'normal'}: `, client);


        const newReservation = new Reservas({
            client: client._id,
            resourceId: reservationData.cabinId,
            reservationDate: moment().toDate(),
            arrivalDate: arrivalDate,
            departureDate: departureDate,
            maxOccupation: chalet.propertyDetails.maxOccupancy,
            nNights: reservationData.nights,
            pax: reservationData.guests,
            url: '', // Se actualizará después de guardar
            status: status,
            total: pricing.totalPrice,
            balanceDue: balanceDue,
            paymentStatus: paymentStatus,
            payments: [],
            // Agregar flag para identificar si la reserva fue hecha por un cliente web
            isWebClientReservation: isWebClient
        });
        if (!newReservation) {
            throw new Error('Error creating reservation object');
        }

        const idReserva = newReservation._id;

        newReservation.url = `https://${process.env.URL}/api/eventos/${idReserva}`;
        await newReservation.save();


        // Generar rack de limpieza
        const chaletName = chalet.propertyDetails.name;
        const descripcionLimpieza = 'Limpieza ' + chaletName;
        const fechaLimpieza = new Date(arrivalDate);
        const checkInDate = new Date(arrivalDate)
        const checkOutDate = new Date(departureDate)
        fechaLimpieza.setDate(fechaLimpieza.getDate())
        const statusLimpieza = 'Pendiente'


        await rackLimpiezaController.createServiceForReservation({
            id_reserva: idReserva,
            descripcion: descripcionLimpieza,
            fecha: fechaLimpieza,
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            status: statusLimpieza,
            idHabitacion: newReservation.resourceId
        });

        if (client.phone) {
            await SendMessages.sendReservationConfirmation(client, chalet, newReservation);
            console.log("SendMessages.sendReminders");
            await SendMessages.sendInstructions(client, chalet, idReserva);
        }

        if (client.email) {
            sendEmail(client.email, idReserva);
        }

        const today = moment().startOf('day');
        const arrival = moment(arrivalDate).startOf('day');
        if (today.isSame(arrival) && chalet.propertyDetails.accomodationType.toUpperCase() === "BOSQUE IMPERIAL") {
            await SendMessages.sendCheckInMessage();
        }

        // Log
        const logBody = {
            fecha: Date.now(),
            type: 'reservation',
            idReserva: idReserva,
            acciones: `Reservación creada desde RenTravel`,
            idUsuario: chalet.others.owner
        }

        await logController.createBackendLog(logBody);

        // Crear utilidades de reserva
        const generarReservas = await generarComisionReservaRentravel(newReservation.resourceId, pricing, idReserva, arrivalDate, departureDate, newReservation.nNights);
        if (generarReservas) {
            console.log("Utilidades de reserva generadas correctamente");
        } else {
            throw new Error("Error al generar utilidades de reserva");
        }


        // Actualizar disponibilidad en Channex

        if (chalet.channels?.length > 0) {

            const arrivalDate = new Date(newReservation.arrivalDate);
            const departureDate = new Date(newReservation.departureDate);

            // Generate all dates between arrival and departure (excluding departure date)
            const datesResponse = [];
            const currentDate = new Date(arrivalDate);

            while (currentDate < departureDate) {
                datesResponse.push({
                    date: {
                        date: new Date(currentDate)
                    }
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }

            channexController.updateChannexAvailabilitySingle(newReservation.resourceId, datesResponse)
                .then(() => {
                    console.log("Disponibilidad actualizada en Channex.");
                })
                .catch(err => {
                    // Aquí puedes: loggear a archivo, mandar notificación, email, etc.
                    console.error("Error al actualizar disponibilidad en Channex: ", err.message);
                });
        }

        return newReservation;


    } catch (error) {
        console.error('Error creating reservation:', error);
        throw new Error('Error creating reservation: ' + error.message);
    }

}

// Utilidades 

async function generarComisionReservaRentravel(habitacionId, pricing, idReserva, arrivalDate, departureDate, nNights) {
    try {

        // Eliminar comisiones previas si es que existian
        // const comisionesReserva = await obtenerComisionesPorReserva(idReserva);

        // if (comisionesReserva) {
        //     for (const comisiones of comisionesReserva) {
        //         if (!comisiones.concepto.includes('servicio') && !comisiones.concepto.includes('Servicio')) {
        //             const utilidadEliminada = await eliminarComisionReturn(comisiones._id);
        //             if (utilidadEliminada) {
        //                 console.log('Utilidad eliminada correctamente');
        //             } else {
        //                 throw new Error('Error al eliminar comision.');
        //             }
        //         }
        //     }
        // }

        const chalet = await Habitacion.findById(habitacionId);
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
        }

        const chaletName = chalet.propertyDetails.name;

        // const comisiones = pricing.totalPrice - pricing.totalPriceSinComision;

        const chaletType = chalet.propertyDetails.accomodationType;

        // Obtener comision de vendedor virtual

        const usuarioWeb = COMISSIONS_MAP[web];
        if (!usuarioWeb) {
            throw new Error("No se encontró el usuario para comisiones");
        }

        const costoComision = await Costos.findOne({ costName: usuarioWeb });
        if (!costoComision) {
            throw new Error("No se encontró el costo para el usuario de comisiones");
        }

        const montoComision = costoComision.amount * nNights;
        const comisionLimpieza = chalet.additionalInfo.extraCleaningCost;
        const comisionServicio = pricing.comisionServicio;

        const totalCobrado = pricing.totalPrice;
        const totalSinComisiones = totalCobrado - montoComision - comisionServicio;
        const costoBase = pricing.basePrice;
        let utilidadChalet = totalSinComisiones - costoBase;

        // Fin obtener comision de vendedor virtual

        const chaletAdminId = chalet.others.admin.toString();
        const chaletJanitor = chalet.others.janitor.toString();
        const chaletOwner = chalet.others.owner.toString();
        const chaletInvestors = chalet.others.investors

        // const idBosqueImperial = '66a7c2f2915b94d6630b67f2'
        const idAdministracionNyN = '671be608256c4d53c3f5e12f';

        const chaletAdmin = await Usuario.findById(chaletAdminId);
        if (!chaletAdmin) {
            throw new Error("No chalet admin found.");
        }

        // Utilidad
        if (chaletType === "Bosque Imperial") {
            await utilidadesController.altaComisionReturn({
                monto: utilidadChalet,
                concepto: `Comisión administrador ligado de Cabaña ${nNights} noches`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletAdmin._id.toString(),
                idReserva: idReserva
            })

            let comisionNegativaIva = Math.round((utilidadChalet * 0.16 + Number.EPSILON) * 100) / 100;

            await utilidadesController.altaComisionReturn({
                monto: -comisionNegativaIva,
                concepto: `Retención IVA ${chaletName} ${nNights} noches`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletAdmin._id.toString(),
                idReserva: idReserva
            })
        } else {
            await utilidadesController.altaComisionReturn({
                monto: utilidadChalet,
                concepto: `Comisión administrador ligado de Cabaña ${chaletName} ${nNights} noches`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletAdmin._id.toString(),
                idReserva: idReserva
            })
        }

        // Comision de vendedor virtual
        await utilidadesController.altaComisionReturn({
            monto: montoComision,
            concepto: `Comisión por venta vía RenTravel ${chaletName} ${nNights} noches`,
            fecha: new Date(arrivalDate),
            idUsuario: chaletAdmin._id.toString(), // Pendiente de validacion
            idReserva: idReserva
        })

        // Comisión de limpieza
        await utilidadesController.altaComisionReturn({
            monto: comisionLimpieza,
            concepto: `Comisión limpieza`,
            fecha: new Date(arrivalDate),
            idUsuario: chaletJanitor,
            idReserva: idReserva
        })

        // Comisión de $35 para administracion
        await utilidadesController.altaComisionReturn({
            monto: comisionServicio,
            concepto: `Costo por uso de sistema NyN`,
            fecha: new Date(arrivalDate),
            idUsuario: idAdministracionNyN,
            idReserva: idReserva
        })

        // Comisión de dueño de cabañas (ANTERIOR)
        // await utilidadesController.altaComisionReturn({
        //     monto: costoBase - chalet.additionalInfo.extraCleaningCost,
        //     concepto: `Comisión Dueño de cabaña: ${chaletName}`,
        //     fecha: new Date(departureDate),
        //     idUsuario: chaletOwner,
        //     idReserva: idReserva
        // })

        // Comisión de dueño de cabañas (NUEVA)
        let nuevoCostoBase = costoBase - chalet.additionalInfo.extraCleaningCost
        let cuantosInversionistas = chaletInvestors?.length
        // let comisionInversionistas = Math.round((nuevoCostoBase / cuantosInversionistas + Number.EPSILON) * 100) / 100;
        let comisionInversionistas = Math.round((nuevoCostoBase / 10 + Number.EPSILON) * 100) / 100;


        if (cuantosInversionistas > 0) {

            for (let investor of chaletInvestors) {
                let userInvestor = await Usuario.findById(investor.investor);
                if (userInvestor) {
                    const noTickets = investor.noTickets
                    const comision = comisionInversionistas * noTickets

                    if (userInvestor.investorType === 'Asimilado') {
                        // Comision normal
                        await utilidadesController.altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comisionInversionistas * 0.16;
                        let comisionNegativaIva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;

                        await utilidadesController.altaComisionReturn({
                            monto: -comisionNegativaIva,
                            concepto: `IVA inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de ISR (5%)
                        // let comisionNegativaIsr = comisionInversionistas * 0.05;
                        let comisionNegativaIsr = Math.round(((comision - comisionNegativaIva) * 0.16 + Number.EPSILON) * 100) / 100;

                        await utilidadesController.altaComisionReturn({
                            monto: -comisionNegativaIsr,
                            concepto: `ISR inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // Retencion "Servicios indirectos Bosque imperial"
                        let comisionNegativaServiciosIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;

                        await utilidadesController.altaComisionReturn({
                            monto: -comisionNegativaServiciosIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                    } else if (userInvestor.investorType === 'RESICO Fisico') {
                        // Comision normal
                        await utilidadesController.altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comision * 0.16;
                        let comisionNegativaIva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;

                        // Comision Retencion IVA
                        let comisionNegativaRetIva = Math.round((comision * 0.1066 + Number.EPSILON) * 100) / 100;

                        await utilidadesController.altaComisionReturn({
                            monto: -comisionNegativaRetIva,
                            concepto: `Retención IVA inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // Comision Retencion ISR
                        let comisionNegativaRetIsr = Math.round((comision * 0.0125 + Number.EPSILON) * 100) / 100;
                        await utilidadesController.altaComisionReturn({
                            monto: -comisionNegativaRetIsr,
                            concepto: `ISR inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // Comision Retencion Servicios Indirectos
                        let comisionServIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await utilidadesController.altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                    } else if (userInvestor.investorType === 'PF con AE y PM') {
                        // Comision normal
                        await utilidadesController.altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // IVA
                        let comisionNegativaIva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;

                        // Comision Retencion Servicios Indirectos
                        let comisionServIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await utilidadesController.altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                    } else if (userInvestor.investorType === 'Efectivo') {
                        // Comision normal
                        await utilidadesController.altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comision * 0.16;
                        let comisionNegativaIva = Math.round((comision * 0.08 + Number.EPSILON) * 100) / 100;
                        
                        let comisionServIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await utilidadesController.altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        await utilidadesController.altaComisionReturn({
                            monto: -comisionNegativaIva,
                            concepto: `IVA inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                    }

                }

            }

        } else {
            // Comisión de dueño de cabañas (ANTERIOR)
            await utilidadesController.altaComisionReturn({
                monto: costoBase - chalet.additionalInfo.extraCleaningCost,
                concepto: `Comisión Dueño de cabaña`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletOwner,
                idReserva: idReserva
            })
        }

        return true;
    } catch (err) {
        console.log(err)
        return false;
    }
}

/**
 * Función auxiliar para encontrar o crear un cliente normal basado en un cliente web
 * @param {string} clienteWebId - ID del cliente web
 * @returns {Object|null} Cliente normal encontrado o creado, null si no se encuentra el cliente web
 */
async function findOrCreateClientFromWebClient(clienteWebId) {
    try {
        const clienteWeb = await ClienteWeb.findById(clienteWebId);
        if (!clienteWeb) {
            return null;
        }

        // Buscar cliente normal existente
        let client = await Cliente.findOne({ clienteWebId: clienteWebId });
        
        if (!client) {
            // También buscar por email como fallback
            client = await Cliente.findOne({ email: clienteWeb.email.toLowerCase().trim() });
            
            if (client) {
                // Vincular el cliente existente al cliente web
                client.clienteWebId = clienteWebId;
                client.isWebClient = true;
                await client.save();
            } else {
                // Crear nuevo cliente normal
                client = new Cliente({
                    firstName: clienteWeb.firstName,
                    lastName: clienteWeb.lastName,
                    email: clienteWeb.email,
                    phone: clienteWeb.phone,
                    address: clienteWeb.address || 'Por definir',
                    clienteWebId: clienteWebId,
                    isWebClient: true
                });
                await client.save();
            }
        }

        return client;
    } catch (error) {
        console.error('Error finding or creating client from web client:', error);
        return null;
    }
}

module.exports = {
    mostrarUnaHabitacion,
    mostrarTodasHabitaciones,
    cotizadorChaletsyPrecios,
    cotizarReserva,
    cotizarReservaController,
    createReservationForClient,
    findOrCreateClientFromWebClient
}