const RackLimpieza = require('../models/RackLimpieza');
const Documento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const habitacionController = require('../controllers/habitacionController');
const Usuario = require('../models/Usuario');
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

        const services = await RackLimpieza.find().lean()
        return services
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function getSpecificServicesMongo(idChalet) {
    try {
        const newChaletId = new mongoose.Types.ObjectId(idChalet);
        const services = await RackLimpieza.find({idHabitacion: newChaletId}).lean()
        return services
    } catch (error) {
        console.log(error.message);
        return error.message
    }
}

async function dataForRackLimpiezaCalendar(req, res, next) {
    try {
        const id = new mongoose.Types.ObjectId(req.session.id);
        const chaletId = req.query.idHabitacion;
        console.log(chaletId)
        
        const habitaciones = await Habitacion.find({_id: chaletId}).lean();
        if (!habitaciones) {
            return res.status(404).send('No rooms found');
        }

        const eventos = await Documento.find({ status: { $nin: ["no-show", "cancelled"] }, resourceId: { $in: habitaciones.map(habitacion => habitacion._id) } }).lean();
        if (!eventos) {
            return res.status(404).send('No events found');
        }

        // Enhance each event with user details if createdBy is present
        for (let evento of eventos) {
            if (evento.createdBy) {
                const usuario = await Usuario.findById(evento.createdBy).select('color firstName lastName').exec();
                if (usuario) {
                    evento.colorUsuario = usuario.color;
                    evento.creadaPor = usuario.firstName + ' ' + usuario.lastName;
                }
            }
        }


        const data = {};
        data.resources = habitaciones;
        data.events = eventos;

        console.log(data)
        
        res.send(data);
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.' + error.message);
    }
}

async function createService(req, res, next) {
    try {
        const { id_reserva, descripcion, fecha, status } = req.body;


        // const documento = await Documento.findById({ 'events._id': id_reserva });

        // if (!documento) {
        //     return res.status(404).send('Documento not found'); // Si no se encuentra el documento, devolver un error 404
        // }

        // const evento = documento.events.find(event => event._id == id_reserva);

        const evento = await Documento.findById(id_reserva).lean();


        if (!evento) {
            return res.status(404).send('Evento not found'); // Si no se encuentra el evento, devolver un error 404
        }

        const resourceId = evento.resourceId.toString();

        const habitacion = await habitacionController.obtenerHabitacionPorId(resourceId);

        const nombreHabitacion = habitacion.propertyDetails.name;
        const idHabitacion = habitacion._id;
        const encargadoLimpieza = habitacion.others.janitor;


        const servicio = {
            id_reserva: new mongoose.Types.ObjectId(id_reserva),
            descripcion,
            fecha,
            status,
            nombreHabitacion,
            idHabitacion,
            encargadoLimpieza
        }

        const service = new RackLimpieza(servicio);
        await service.save();
        res.send(service);
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while creating service.');
    }
}

async function createServiceForReservation(req, res, next) {
    try {
        console.log(req)
        const { id_reserva, descripcion, fecha, status, idHabitacion, checkInDate, checkOutDate } = req;


        
        // if (!documento) {
            //     return res.status(404).send('Documento not found'); // Si no se encuentra el documento, devolver un error 404
            // }
            
            // const evento = documento.events.find(event => event._id == id_reserva);
            
        const evento = await Documento.findById(id_reserva).lean();
        if (!evento) {
            return res.status(404).send('Evento not found'); // Si no se encuentra el evento, devolver un error 404
        }

        const resourceId = evento.resourceId.toString();

        const habitacion = await habitacionController.obtenerHabitacionPorId(resourceId);

        const nombreHabitacion = habitacion.propertyDetails.name
        const encargadoLimpieza = habitacion.others.janitor;


        const servicio = {
            id_reserva: new mongoose.Types.ObjectId(id_reserva),
            descripcion,
            fecha,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            status,
            nombreHabitacion,
            idHabitacion,
            encargadoLimpieza: new mongoose.Types.ObjectId(encargadoLimpieza)
        }

        const service = new RackLimpieza(servicio);
        await service.save();
    } catch (error) {
        console.log(error.message);
        return error;
    }
}

async function modifyService(req, res, next) {
    const { descripcion, fecha, status } = req.body;
    const { id } = req.params;

    const updateFields = {};

    if (descripcion) { updateFields.descripcion = descripcion; }
    if (fecha) { updateFields.fecha = fecha; }
    if (status) { updateFields.status = status; }


    try {
        // Buscar el usuario por su dirección de correo electrónico
        const updateService = await RackLimpieza.findOneAndUpdate({ _id: id }, updateFields, { new: true });

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

async function deleteService(req, res, next) {
    try {
        const { id } = req.params;
        await RackLimpieza.findByIdAndDelete(id);
        console.log("Servicio eliminado con éxito");
        res.status(200).json({ success: true });
    } catch (e) {
        console.log(e.message);
        res.send({ error: e.message });
    }
}



module.exports = {
    getAllServices,
    getAllServicesMongo,
    getSpecificServicesMongo,
    createService,
    createServiceForReservation,
    modifyService,
    deleteService,
    dataForRackLimpiezaCalendar
}