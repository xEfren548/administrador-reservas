const mongoose = require('mongoose');
const fs = require('fs');
const xlsx = require("xlsx");
const csvParser = require('csv-parser');
const PrecioBaseXDia = require('../models/PrecioBaseXDia');
const PreciosEspeciales = require('../models/PreciosEspeciales');
const Habitacion = require('../models/Habitacion');
const channexController = require('../controllers/channexController');
const BloqueoFechas = require('../models/BloqueoFechas');
const utilidadesController = require('../controllers/utilidadesController');

// Controlador para agregar nuevos datos
async function agregarNuevoPrecio(req, res) {
    try {
        const { precio_modificado, precio_base_2noches, costo_base, costo_base_2noches, fecha, habitacionId } = req.body;
        const objectHabitacionId = new mongoose.Types.ObjectId(habitacionId);
        const chalet = await Habitacion.findById(habitacionId);

        if (!chalet) {
            return res.status(404).json({ mensaje: 'Chalet no encontrado.' });
        }

        const nuevoPrecio = new PrecioBaseXDia({
            precio_modificado,
            precio_base_2noches,
            costo_base,
            costo_base_2noches,
            fecha,
            habitacionId: objectHabitacionId
        });



        await nuevoPrecio.save();
        res.status(201).json({ mensaje: 'Precio base agregado exitosamente.' });
        if (chalet.channels?.length > 0) {
            channexController.updateChannexPrices(chalet._id)
                .then(() => {
                    console.log("Precios actualizados en Channex.");
                })
                .catch(err => {
                    // Aquí puedes: loggear a archivo, mandar notificación, email, etc.
                    console.error("Error al actualizar precios en Channex: ", err.message);
                });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al agregar el precio base.' });
    }
}

// Controlador para eliminar un precio base por su ID
async function eliminarPrecio(req, res) {
    try {
        const { id } = req.params;
        res.status(200).json({ mensaje: 'Precio base eliminado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al eliminar el precio base.' });
    }
}

// Controlador para consultar todos los precios base
async function consultarPrecios(req, res) {
    try {
        const precios = await PrecioBaseXDia.find();
        return precios;
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

async function consultarPreciosPorId(req, res) {
    try {
        const { id } = req.params;
        const precio = await PrecioBaseXDia.findById(id);
        return precio;
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

async function consultarPreciosPorFecha(req, res) {
    try {
        const { fecha, habitacionid, needSpecialPrice, pax } = req.query;

        let precio = null;
        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC

        let currentDate = new Date(fechaAjustada);
        currentDate.setUTCHours(6);

        const fechasBloqueadasPorCapacidad = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: habitacionid, type: 'capacidad_minima' });
        if (fechasBloqueadasPorCapacidad) {
            console.log("current date: ", currentDate);
            console.log("fechasBloqueadasPorCapacidad: ", fechasBloqueadasPorCapacidad);
            if (pax < fechasBloqueadasPorCapacidad.min) {
                return res.status(400).send({ mensaje: `La capacidad minima es de ${fechasBloqueadasPorCapacidad.min} personas` });
            }
        }


        if (needSpecialPrice === "true") {
            precio = await PreciosEspeciales.findOne({ fecha: fechaAjustada, habitacionId: habitacionid, noPersonas: pax })
        } else {
            precio = await PrecioBaseXDia.findOne({ fecha: fechaAjustada, habitacionId: habitacionid });

        }


        if (precio === null) {
            // const habitacionesExistentes = await Habitacion.findOne(); // Buscar el documento que contiene los eventos

            // if (!habitacionesExistentes) {
            //     throw new Error('No se encontraron eventos');
            // }

            // Buscar la habitacion por su id
            // const habitacion = habitacionesExistentes.resources.find(habitacion => habitacion.id === habitacionid);
            precio = await PrecioBaseXDia.findOne({ fecha: fechaAjustada, habitacionId: habitacionid });

            if (!precio) {


                const habitacion = await Habitacion.findById(habitacionid).lean();

                if (!habitacion) {
                    throw new Error('Habitacion no encontrada');
                }

                precio = {
                    costo_base: habitacion.others.baseCost,
                    costo_base_2noches: habitacion.others.baseCost2nights,
                    precio_modificado: habitacion.others.basePrice,
                    precio_base_2noches: habitacion.others.basePrice2nights
                }
            }


        }
        res.send(precio);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

async function consultarPreciosPorFechas(req, res) {
    try {
        const { fechaLlegada, fechaSalida, habitacionid, needSpecialPrice, pax } = req.query;

        console.log({ fechaLlegada, fechaSalida, habitacionid, needSpecialPrice, pax });

        const nNights = Math.ceil((new Date(fechaSalida) - new Date(fechaLlegada)) / (1000 * 60 * 60 * 24));

        const comisiones = await utilidadesController.calcularComisionesInternas({
            userId: req.session.id,
            nNights: nNights,
        });

        console.log("comisionesss: ", comisiones);    

        let precio = null;
        console.log("fechas llegada y salida: ", fechaLlegada, fechaSalida);    
        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fechaLlegada);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC

        let currentDate = new Date(fechaAjustada);
        currentDate.setUTCHours(6);

        const fechaLimite = new Date(fechaSalida);
        fechaLimite.setUTCHours(6);

        const precios = [];

        while (currentDate < fechaLimite) {
            console.log("current date: ", currentDate);

            const fechasBloqueadasPorCapacidad = await BloqueoFechas.findOne({ date: currentDate, habitacionId: habitacionid, type: 'capacidad_minima' });
            if (fechasBloqueadasPorCapacidad) {
                console.log("current date: ", currentDate);
                console.log("fechasBloqueadasPorCapacidad: ", fechasBloqueadasPorCapacidad);
                if (pax < fechasBloqueadasPorCapacidad.min) {
                    return res.status(400).send({ mensaje: `La capacidad minima es de ${fechasBloqueadasPorCapacidad.min} personas` });
                }
            }


            if (needSpecialPrice === "true") {
                precio = await PreciosEspeciales.findOne({ fecha: currentDate, habitacionId: habitacionid, noPersonas: pax })
            } else {
                precio = await PrecioBaseXDia.findOne({ fecha: currentDate, habitacionId: habitacionid });

            }


            if (precio === null) {

                precio = await PrecioBaseXDia.findOne({ fecha: currentDate, habitacionId: habitacionid });

                if (!precio) {


                    const habitacion = await Habitacion.findById(habitacionid).lean();

                    if (!habitacion) {
                        throw new Error('Habitacion no encontrada');
                    }

                    precio = {
                        costo_base: habitacion.others.baseCost,
                        costo_base_2noches: habitacion.others.baseCost2nights,
                        precio_modificado: habitacion.others.basePrice,
                        precio_base_2noches: habitacion.others.basePrice2nights
                    }
                    precios.push(precio);
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }


            }

            precios.push(precio);

            currentDate.setDate(currentDate.getDate() + 1);
        }
        console.log(precios);
        const twoOrMoreNights = precios.length > 1;
        const costoBaseFinal = twoOrMoreNights ? precios.reduce((total, precio) => total + precio.costo_base_2noches, 0) : precios[0].costo_base;
        let precioBaseFinal = twoOrMoreNights ? precios.reduce((total, precio) => total + precio.precio_base_2noches, 0) : precios[0].precio_modificado;
        const precioTotalSinComision = precioBaseFinal;
        precioBaseFinal += comisiones;
        res.json({precios, costoBaseFinal, precioBaseFinal, precioTotalSinComision});
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

async function eliminarRegistroPrecio(req, res) {
    try {

        const { fecha, habitacionId } = req.query;

        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC
        const resultado = await PrecioBaseXDia.findOneAndDelete({ fecha: fechaAjustada, habitacionId: habitacionId });
        if (!resultado) {
            return res.status(200).json({});
        }

        const chalet = await Habitacion.findById(habitacionId);

        if (chalet.channels?.length > 0) {
            channexController.updateChannexPrices(chalet._id)
                .then(() => {
                    console.log("Precios actualizados en Channex.");
                })
                .catch(err => {
                    // Aquí puedes: loggear a archivo, mandar notificación, email, etc.
                    console.error("Error al actualizar precios en Channex: ", err.message);
                });
        }

        res.status(200).json({ message: 'Registro eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar el registro de precio:', error);
        res.status(500).json({ error: 'Error al eliminar el registro de precio' });
    }
}

// Función para verificar si existe un registro con la misma fecha y habitación
// Función para verificar si existe un registro con la misma fecha y habitación
async function verificarExistenciaRegistro(req, res) {
    try {
        const { fecha, habitacionId } = req.query;

        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC
        // No changes

        const response = await PrecioBaseXDia.findOne({ fecha: fechaAjustada, habitacionId: habitacionId });
        const existeRegistro = response !== null;

        res.json({ existeRegistro: existeRegistro });
    } catch (error) {
        console.error('Error al verificar la existencia del registro:', error);
        throw error;
    }
}

// Subida de archivo CSV

async function cargarPreciosCSV(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No se subió ningún archivo." });
        }

        const filePath = req.file.path;

        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Usamos la primera hoja
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet); // Convertimos a JSON

        const preciosGuardados = [];
        const errores = [];

        for (const [index, row] of rows.entries()) {
            try {
                // const habitacionId = row.id_habitacion;
                const habitacionName = row.Nombre;
                // if (!mongoose.Types.ObjectId.isValid(habitacionId)) {
                //     throw new Error(`Fila ${index + 2}: ID de habitación inválido.`);

                // }
                const habitacion = await Habitacion.findOne({ 'propertyDetails.name': habitacionName });

                if (!habitacion) {
                    throw new Error(`Fila ${index + 2}: Habitación ${habitacionName} no encontrada.`);
                }

                // 📌 Validar y convertir fechas
                if (isNaN(row.fecha_inicio) || isNaN(row.fecha_fin)) {
                    throw new Error(`Fila ${index + 2}: Fechas inválidas.`);
                }

                const capacidad = row.Capacidad;

                const fechaInicio = excelDateToJSDate(row.fecha_inicio);
                const fechaFin = excelDateToJSDate(row.fecha_fin);

                const costoBase = parseFloat(row["costo_base"]);
                const costoBase2Noches = parseFloat(row["costo_base_2noches"]);
                const precioBase = parseFloat(row["precio_base"]);
                const precioBase2Noches = parseFloat(row["precio_base_2noches"]);

                if (isNaN(costoBase) || isNaN(precioBase) || isNaN(costoBase2Noches) || isNaN(precioBase2Noches)) {
                    throw new Error(`Fila ${index + 2}: Uno o más precios son inválidos.`);
                }


                // 🔹 Insertar o actualizar precios para cada día en el rango de fechas
                let currentDate = new Date(fechaInicio);
                let endDate = new Date(fechaFin);
                endDate.setUTCHours(6, 0, 0, 0); // 

                if (!capacidad || capacidad <= 0) {
                    while (currentDate <= endDate) {
                        currentDate.setUTCHours(6);
                        await PrecioBaseXDia.findOneAndUpdate(
                            { habitacionId: habitacion._id, fecha: currentDate }, // Filtro de búsqueda
                            {
                                $set: {
                                    precio_modificado: precioBase,
                                    precio_base_2noches: precioBase2Noches,
                                    costo_base: costoBase,
                                    costo_base_2noches: costoBase2Noches,
                                },
                            },
                            { upsert: true, new: true } // Si no existe, lo crea
                        );


                        currentDate.setDate(currentDate.getDate() + 1);


                    }

                } else {
                    while (currentDate <= endDate) {
                        currentDate.setUTCHours(6);
                        await PreciosEspeciales.findOneAndUpdate(
                            { habitacionId: habitacion._id, fecha: currentDate, noPersonas: capacidad }, // Filtro de búsqueda
                            {
                                $set: {
                                    precio_modificado: precioBase,
                                    precio_base_2noches: precioBase2Noches,
                                    costo_base: costoBase,
                                    costo_base_2noches: costoBase2Noches,
                                    criterio: 'personas',
                                    noPersonas: capacidad,
                                },
                            },
                            { upsert: true, new: true } // Si no existe, lo crea
                        );


                        currentDate.setDate(currentDate.getDate() + 1);


                    }

                }


                preciosGuardados.push({
                    habitacionName,
                    fechaInicio,
                    fechaFin
                });

                if (habitacion.channels.airbnbListingId) {
                    channexController.updateChannexPrices(habitacion._id)
                        .then(() => {
                            console.log("Precios actualizados en Channex.");
                        })
                        .catch(err => {
                            // Aquí puedes: loggear a archivo, mandar notificación, email, etc.
                            console.error("Error al actualizar precios en Channex: ", err.message);
                        });
                }

            } catch (error) {
                errores.push(error.message);
                console.error("Error al procesar la fila:", error);
            }
        }

        fs.unlinkSync(filePath);


        res.json({
            message: "Proceso finalizado",
            registrosExitosos: preciosGuardados.length,
            errores
        });



    } catch (error) {
        console.error("Error en el servidor:", error);
        res.status(500).json({ message: "Error en el servidor: " + error.message || "Error desconocido" });
    }
}

const excelDateToJSDate = (serial) => {
    const fechaBase = new Date(Date.UTC(1900, 0, serial - 1)); // 📌 Usar UTC y restar 1 día
    return fechaBase;
};



module.exports = {
    agregarNuevoPrecio,
    eliminarPrecio,
    consultarPrecios,
    consultarPreciosPorId,
    consultarPreciosPorFecha,
    consultarPreciosPorFechas,
    eliminarRegistroPrecio,
    verificarExistenciaRegistro,
    cargarPreciosCSV
};
