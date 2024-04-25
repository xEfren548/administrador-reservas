const RackLimpieza = require('../models/RackLimpieza');
const Documento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const mongoose = require('mongoose');

async function getAllServices(req, res, next) {
    try {

        const services = await RackLimpieza.find()
        res.send(services);
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function getAllServicesMongo(req, res, next) {
    try {

        const services = await RackLimpieza.find()
        return services
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function getSpecificServicesMongo(req, res, next) {
    try {

        const services = await RackLimpieza.find()
        return services
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function createService(req, res, next) {
    try {
        const { id_reserva, descripcion, fecha, status } = req.body;

        console.log(id_reserva)

        const documento = await Documento.findOne({ 'events._id': id_reserva });

        if (!documento) {
            return res.status(404).send('Documento not found'); // Si no se encuentra el documento, devolver un error 404
        }

        const evento = documento.events.find(event => event._id == id_reserva);

        if (!evento) {
            return res.status(404).send('Evento not found'); // Si no se encuentra el evento, devolver un error 404
        }

        

        const resourceId = evento.resourceId;

        console.log(resourceId);



        const servicio = {
            id_reserva: new mongoose.Types.ObjectId(id_reserva),
            descripcion,
            fecha,
            status,
            resourceId
        }

        const service = new RackLimpieza(servicio);
        await service.save();
        res.send(service);
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while creating service.');
    }
}



module.exports = {
    getAllServices,
    getAllServicesMongo,
    getSpecificServicesMongo,
    createService
}