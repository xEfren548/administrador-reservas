const RackServicios = require('../models/RackServicios');
const Documento = require('../models/Evento');
const habitacionController = require('../controllers/habitacionController');
const mongoose = require('mongoose');

async function getAllRackServices(req, res, next) {
    try {

        const services = await RackServicios.find()
        res.send(services);
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function getAllRackServicesMongo(req, res, next) {
    try {

        const services = await RackServicios.find().lean()
        return services
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function getSpecificRackServicesMongo(req, res, next) {
    try {

        const services = await RackServicios.find()
        return services
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function createRackService(req, res, next) {
    try {
        const { id_reserva, descripcion, fecha, status } = req.body;

        const documento = await Documento.findOne({ 'events._id': id_reserva });

        if (!documento) {
            return res.status(404).send('Documento not found'); // Si no se encuentra el documento, devolver un error 404
        }

        const evento = documento.events.find(event => event._id == id_reserva);

        if (!evento) {
            return res.status(404).send('Evento not found'); // Si no se encuentra el evento, devolver un error 404
        }

        const resourceId = evento.resourceId.toString();

        const habitacion = await habitacionController.obtenerHabitacionPorId(resourceId);

        const nombreHabitacion = habitacion.propertyDetails.name


        const servicio = {
            id_reserva: new mongoose.Types.ObjectId(id_reserva),
            descripcion,
            fecha,
            status,
            nombreHabitacion
        }

        const service = new RackServicios(servicio);
        await service.save();
        res.send(service);
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while creating service.');
    }
}

async function modifyRackService(req, res, next) {
    const { descripcion, fecha, status } = req.body;
    const { id } = req.params;

    const updateFields = {};

    if (descripcion) { updateFields.descripcion = descripcion; }
    if (fecha) { updateFields.fecha = fecha; }
    if (status) { updateFields.status = status; }


    try {
        // Buscar el usuario por su dirección de correo electrónico
        const updateService = await RackServicios.findOneAndUpdate({ _id: id }, updateFields, { new: true });

        if (!updateService) {
            // Si no se encuentra el usuario, devolver un error
            const error = new Error("El servicio no fue encontrado.");
            error.status = 404;
            throw error;
        }

        console.log("Servicio editado con éxito");
        res.status(200).json({ updateService });
    } catch (e) {
        console.log(e.message);
        res.send({ error: e.message });
    }

}

async function deleteRackService(req, res, next) {
    try {
        const { id } = req.params;
        await RackServicios.findByIdAndDelete(id);
        console.log("Servicio eliminado con éxito");
        res.status(200).json({ success: true });
    } catch (e) {
        console.log(e.message);
        res.send({ error: e.message });
    }
}



module.exports = {
    getAllRackServices,
    getAllRackServicesMongo,
    getSpecificRackServicesMongo,
    createRackService,
    modifyRackService,
    deleteRackService
}