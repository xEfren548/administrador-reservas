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

async function crearFechaBloqueada(req, res){
    const {date, min, habitacionId} = req.body;

    const fechaFormatted = new Date(date)
    fechaFormatted.setUTCHours(0); // Ajustar la hora a 00:00:00 UTC
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
}

async function eliminarFechaBloqueada(req, res){
    try{
        const { fecha, habitacionId } = req.query;
    
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(0); // Ajustar la hora a 00:00:00 UTC
            
        const resultado = await BloqueoFechas.findOneAndDelete({ fecha: fechaAjustada, habitacionId: habitacionId });
    
        if (!resultado) {
            return res.status(404).json({ message: 'No se encontró ningún registro para eliminar' });
        }
    
        res.status(200).json({ message: 'Registro eliminado correctamente' });

    } catch(error){
        console.error('Error al eliminar el registro de precio:', error);
        res.status(500).json({ error: 'Error al eliminar el registro de precio' });
    }
}


module.exports = {
    obtenerFechasBloqueadas,
    crearFechaBloqueada,
    eliminarFechaBloqueada
}