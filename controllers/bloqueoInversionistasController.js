const mongoose = require('mongoose');
const Habitacion = require('../models/Habitacion');
const BloqueoInversionistas = require('../models/BloqueoInversionistas');

async function obtenerFechasBloqueadas(req, res){
    const fechasBloquedas = await BloqueoInversionistas.find().lean();
    if (!fechasBloquedas){
        res.status(404).send({ message: 'No dates found' });
    }
    res.status(200).send(fechasBloquedas);
}

async function crearFechaBloqueada(req, res){
    const {date, habitacionId} = req.body;

    const fechaFormatted = new Date(date)
    fechaFormatted.setUTCHours(6); // Ajustar la hora a 00:00:00 UTC
    const mongooseHabitacionId = new mongoose.Types.ObjectId(habitacionId);

    const newFechaBloqueada = new BloqueoInversionistas({
        date: new Date(date),
        habitacionId: mongooseHabitacionId
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
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 00:00:00 UTC
        console.log("fecha ajustada: ", fechaAjustada)
        const newHabitacionId = new mongoose.Types.ObjectId(habitacionId);
        console.log(newHabitacionId)
        const resultado = await BloqueoInversionistas.findOneAndDelete({ date: fechaAjustada, habitacionId: newHabitacionId });
        
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
    crearFechaBloqueada,
    eliminarFechaBloqueada
}