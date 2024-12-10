const mongoose = require('mongoose');
const Habitacion = require('../models/Habitacion');
const BloqueoFechas = require('../models/BloqueoFechas');

async function obtenerFechasBloqueadas(req, res){
    const fechasBloquedas = await BloqueoFechas.find().lean();
    if (!fechasBloquedas){
        res.status(404).send({ message: 'No dates found' });
    }
    res.status(200).send(fechasBloquedas);
}

async function crearFechaRestringida(req, res){
    const {date, min, habitacionId, type} = req.body;

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
    
    
        const existeFecha = await BloqueoFechas.findOne({date: date, habitacionId: mongooseHabitacionId})
        if (existeFecha){
            // edit the existe fecha to the new description and min
            existeFecha.description = description;
            existeFecha.min = min;
            await existeFecha.save();
            return res.status(201).send({ message: 'Date modified successfully', date: existeFecha});
    
        }
    
        const newFechaBloqueada = new BloqueoFechas({
            date: new Date(date),
            description,
            min,
            habitacionId: new mongoose.Types.ObjectId(habitacionId)
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
    const {date, habitacionId, type} = req.body;

    try {

        if (type !== 'bloqueo') {
            return res.status(400).send({ message: 'Invalid type value' });
        }

        const fechaFormatted = new Date(date)
        fechaFormatted.setUTCHours(6); // Ajustar la hora a 00:00:00 UTC
        const mongooseHabitacionId = new mongoose.Types.ObjectId(habitacionId);
    
        const description = `Fecha bloqueada`
    
    
        const existeFecha = await BloqueoFechas.findOne({date: date, habitacionId: mongooseHabitacionId, type: 'bloqueo'})
        if (existeFecha){
            // edit the existe fecha to the new description and min
            existeFecha.description = description;
            await existeFecha.save();
            return res.status(201).send({ message: 'Date modified successfully', date: existeFecha});
    
        }
    
        const newFechaBloqueada = new BloqueoFechas({
            date: new Date(date),
            description,
            habitacionId: new mongoose.Types.ObjectId(habitacionId),
            type: 'bloqueo'
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

async function eliminarFechaBloqueada(req, res){
    try{
        const { fecha, habitacionId, type } = req.query;
        console.log(fecha)
        console.log(habitacionId)
    
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 00:00:00 UTC
        const newHabitacionId = new mongoose.Types.ObjectId(habitacionId);

        if (type === 'bloqueo') {
            const resultado = await BloqueoFechas.findOneAndDelete({ date: fechaAjustada, habitacionId: newHabitacionId, type: 'bloqueo' });

            if (!resultado) {
                return res.status(200).json({});
            }

            return res.status(200).json({ message: 'Registro eliminado correctamente' });

        }

        const resultado = await BloqueoFechas.findOneAndDelete({
            date: fechaAjustada,
            habitacionId: newHabitacionId,
            type: { $ne: 'bloqueo' }
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
    eliminarFechaBloqueada
}