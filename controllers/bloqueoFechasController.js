const mongoose = require('mongoose');
const Habitacion = require('../models/Habitacion');
const BloqueoFechas = require('../models/BloqueoFechas');
const channexController = require('../controllers/channexController');
const { format } = require('date-fns');

async function obtenerFechasBloqueadas(req, res){
    const fechasBloquedas = await BloqueoFechas.find().lean();
    if (!fechasBloquedas){
        res.status(404).send({ message: 'No dates found' });
    }
    res.status(200).send(fechasBloquedas);
}

async function crearFechaRestringida(req, res){
    const {date, min, habitacionId, type, motivo} = req.body;

    console.log(req.body);

    try {

        if (type !== 'restriccion') {
            return res.status(400).send({ message: 'Invalid type value' });
        }

        if (isNaN(min) || min <= 0) {
            return res.status(400).send({ message: 'Invalid min value' });
        }

        const fechaFormatted = new Date(date)
        fechaFormatted.setUTCHours(6); // Ajustar la hora a 00:00:00 UTC
        const mongooseHabitacionId = new mongoose.Types.ObjectId(habitacionId);
    
        const description = `Estancia mínima de ${min} noches.`
        const creadoPorId = req.session && req.session.id ? new mongoose.Types.ObjectId(req.session.id) : null;
        const ahora = new Date();
    
    
        const existeFecha = await BloqueoFechas.findOne({date: date, habitacionId: mongooseHabitacionId, type: 'restriccion'});
        if (existeFecha){
            // edit the existe fecha to the new description and min
            existeFecha.description = description;
            existeFecha.min = min;
            existeFecha.motivo = motivo || existeFecha.motivo;
            existeFecha.creadoPor = creadoPorId;
            existeFecha.fechaCreacion = ahora;
            existeFecha.horaCreacion = ahora;
            await existeFecha.save();
            return res.status(201).send({ message: 'Date modified successfully', date: existeFecha});
    
        }
    
        const newFechaBloqueada = new BloqueoFechas({
            date: new Date(date),
            description,
            min,
            type,
            habitacionId: new mongoose.Types.ObjectId(habitacionId),
            motivo,
            creadoPor: creadoPorId,
            fechaCreacion: ahora,
            horaCreacion: ahora
        })
    
        const agregarFecha = await newFechaBloqueada.save();
        if (!agregarFecha){
            return res.status(400).send({ message: 'Failed to create date' });
        }
        res.status(200).send({ message: 'Date created successfully', date: agregarFecha});
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
}

async function crearFechaBloqueada(req, res){
    const { habitacionId, type, min, motivo} = req.body;
    let {date} = req.body;
    console.log("date: ", date);

    try {

        if (type !== 'bloqueo' && type !== 'capacidad_minima') {
            return res.status(400).send({ message: 'Invalid type value' });
        }

        if (type === 'capacidad_minima' && isNaN(min) || min <= 0) {
            return res.status(400).send({ message: 'Invalid min value' });
        }

        const fechaFormatted = new Date(date)
        fechaFormatted.setUTCHours(17); // Ajustar la hora a 17:00:00 UTC
        const mongooseHabitacionId = new mongoose.Types.ObjectId(habitacionId);
    
        const description = (type === "bloqueo") ? `Fecha bloqueada` : `Capacidad mínima de ${min} personas.`
        const creadoPorId = req.session && req.session.id ? new mongoose.Types.ObjectId(req.session.id) : null;
        const ahora = new Date();
    
        if (type === "bloqueo") {
            date = fechaFormatted
        }
    
        const existeFecha = await BloqueoFechas.findOne({date: date, habitacionId: mongooseHabitacionId, type: type})
        if (existeFecha){
            // edit the existe fecha to the new description and min
            existeFecha.description = description;
            existeFecha.motivo = motivo || existeFecha.motivo;
            existeFecha.creadoPor = creadoPorId;
            existeFecha.fechaCreacion = ahora;
            existeFecha.horaCreacion = ahora;
            if (type === "capacidad_minima") {
                existeFecha.min = min;
            } else if (type === "bloqueo") {
                existeFecha.date = fechaFormatted
            }
            await existeFecha.save();
            return res.status(201).send({ message: 'Date modified successfully', date: existeFecha});
    
        }
    
        let newFechaBloqueada;
        if (type === "capacidad_minima") {
            newFechaBloqueada = new BloqueoFechas({
                date: new Date(date),
                description,
                habitacionId: new mongoose.Types.ObjectId(habitacionId),
                type: 'capacidad_minima',
                min: min,
                motivo,
                creadoPor: creadoPorId,
                fechaCreacion: ahora,
                horaCreacion: ahora
            })
        } else if (type === "bloqueo") {
            newFechaBloqueada = new BloqueoFechas({
                date: fechaFormatted,
                description,
                habitacionId: new mongoose.Types.ObjectId(habitacionId),
                type: 'bloqueo',
                motivo,
                creadoPor: creadoPorId,
                fechaCreacion: ahora,
                horaCreacion: ahora
            })
        } else {
            newFechaBloqueada = null
        }

        if (!newFechaBloqueada) {
            return res.status(400).send({ message: 'Invalid type value' });
        }
    
        const agregarFecha = await newFechaBloqueada.save();
        if (!agregarFecha){
            return res.status(400).send({ message: 'Failed to create date' });
        }

        res.status(200).send({ message: 'Date created successfully', date: agregarFecha});
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
}

async function crearBloqueosRango(req, res){
    const { dates, habitacionIds, motivo } = req.body;

    try {
        // Validaciones
        if (!dates || !Array.isArray(dates) || dates.length === 0) {
            return res.status(400).send({ message: 'Se requiere un array de rangos de fechas' });
        }

        if (!habitacionIds || !Array.isArray(habitacionIds) || habitacionIds.length === 0) {
            return res.status(400).send({ message: 'Se requiere al menos una habitación' });
        }

        if (!req.session || !req.session.id) {
            return res.status(401).send({ message: 'Usuario no autenticado' });
        }

        const creadoPorId = new mongoose.Types.ObjectId(req.session.id);
        const ahora = new Date();

        // Generar todas las fechas de todos los rangos
        const todasLasFechas = [];
        
        for (const rango of dates) {
            const { fechaInicio, fechaFin } = rango;

            if (!fechaInicio || !fechaFin) {
                return res.status(400).send({ message: 'Cada rango debe tener fechaInicio y fechaFin' });
            }

            const inicio = new Date(fechaInicio);
            const fin = new Date(fechaFin);

            if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
                return res.status(400).send({ message: 'Fechas inválidas en el rango' });
            }

            if (inicio > fin) {
                return res.status(400).send({ message: 'La fechaInicio no puede ser mayor que fechaFin' });
            }

            // Generar todas las fechas del rango (inclusive)
            const fechaActual = new Date(inicio);
            while (fechaActual <= fin) {
                const fechaFormatted = new Date(fechaActual);
                fechaFormatted.setUTCHours(17); // Ajustar la hora a 17:00:00 UTC
                todasLasFechas.push(fechaFormatted);
                
                // Avanzar al siguiente día
                fechaActual.setDate(fechaActual.getDate() + 1);
            }
        }

        if (todasLasFechas.length === 0) {
            return res.status(400).send({ message: 'No se generaron fechas válidas de los rangos proporcionados' });
        }

        const description = 'Fecha bloqueada';
        const type = 'bloqueo';

        // Contadores globales
        let totalCreadas = 0;
        let totalActualizadas = 0;
        const resultadosPorHabitacion = [];

        // Procesar cada habitación
        for (const habitacionId of habitacionIds) {
            const mongooseHabitacionId = new mongoose.Types.ObjectId(habitacionId);
            const operaciones = [];
            const fechasCreadas = [];
            const fechasActualizadas = [];

            // Procesar cada fecha para esta habitación
            for (const fecha of todasLasFechas) {
                const existeFecha = await BloqueoFechas.findOne({
                    date: fecha,
                    habitacionId: mongooseHabitacionId,
                    type: 'bloqueo'
                });

                if (existeFecha) {
                    // Actualizar fecha existente
                    existeFecha.description = description;
                    existeFecha.motivo = motivo || existeFecha.motivo;
                    existeFecha.creadoPor = creadoPorId;
                    existeFecha.fechaCreacion = ahora;
                    existeFecha.horaCreacion = ahora;
                    
                    await existeFecha.save();
                    fechasActualizadas.push(existeFecha);
                } else {
                    // Crear nueva fecha bloqueada
                    const nuevoBloqueo = new BloqueoFechas({
                        date: fecha,
                        description,
                        habitacionId: mongooseHabitacionId,
                        type,
                        motivo,
                        creadoPor: creadoPorId,
                        fechaCreacion: ahora,
                        horaCreacion: ahora
                    });

                    operaciones.push(nuevoBloqueo);
                }
            }

            // Insertar todas las nuevas fechas de esta habitación
            if (operaciones.length > 0) {
                const resultados = await BloqueoFechas.insertMany(operaciones);
                fechasCreadas.push(...resultados);
            }

            totalCreadas += fechasCreadas.length;
            totalActualizadas += fechasActualizadas.length;

            resultadosPorHabitacion.push({
                habitacionId,
                creadas: fechasCreadas.length,
                actualizadas: fechasActualizadas.length
            });
        }

        res.status(200).send({
            message: 'Bloqueos procesados exitosamente',
            totalHabitaciones: habitacionIds.length,
            totalFechas: todasLasFechas.length,
            totalCreadas,
            totalActualizadas,
            detallePorHabitacion: resultadosPorHabitacion
        });

    } catch (error) {
        console.log(error.message);
        res.status(500).send({ message: error.message });
    }
}

async function eliminarFechaBloqueada(req, res){
    try{
        const { fecha, habitacionId, type } = req.query;
        console.log(fecha)
        console.log(habitacionId)
    
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 00:00:00 UTC
        const newHabitacionId = new mongoose.Types.ObjectId(habitacionId);

        if (type === 'bloqueo') {
            fechaAjustada.setUTCHours(17); // Ajustar la hora a 17:00:00 UTC
            const resultado = await BloqueoFechas.findOneAndDelete({ date: fechaAjustada, habitacionId: newHabitacionId, type: 'bloqueo' });

            if (!resultado) {
                return res.status(200).json({});
            }

            return res.status(200).json({ message: 'Registro eliminado correctamente', date: resultado });

        } else if (type === "bloqueo_capacidad") {
            const resultado = await BloqueoFechas.findOneAndDelete({ date: fechaAjustada, habitacionId: newHabitacionId, type: 'capacidad_minima' });

            if (!resultado) {
                return res.status(200).json({});
            }

            return res.status(200).json({ message: 'Registro eliminado correctamente' });
        }

        const resultado = await BloqueoFechas.findOneAndDelete({
            date: fechaAjustada,
            habitacionId: newHabitacionId,
            type: { $ne: 'bloqueo', $ne: 'capacidad_minima' }
        });
        
        if (!resultado) {
            return res.status(200).json({});
        }
    
        res.status(200).json({ message: 'Registro eliminado correctamente' });

    } catch(error){
        console.error('Error al eliminar el registro de precio:', error);
        res.status(500).json({ error: 'Error al eliminar el registro de precio' });
    }
}


module.exports = {
    obtenerFechasBloqueadas,
    crearFechaRestringida,
    crearFechaBloqueada,
    crearBloqueosRango,
    eliminarFechaBloqueada
}