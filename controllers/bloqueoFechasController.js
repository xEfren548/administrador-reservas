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
    const {date, description, min, habitacionId} = req.body;

    const newFechaBloqueada = new BloqueoFechas({
        date: new Date(date),
        description,
        min,
        habitacionId: new mongoose.Types.ObjectId(habitacionId)
    })
    
    const agregarFecha = await newFechaBloqueada.save();
    if (!agregarFecha){
        res.status(400).send({ message: 'Failed to create date' });
    }
    res.status(200).send({ message: 'Date created successfully', date: agregarFecha});
}

module.exports = {
    obtenerFechasBloqueadas,
    crearFechaBloqueada
}