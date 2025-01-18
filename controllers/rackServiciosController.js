const mongoose = require('mongoose');

const RackServicios = require('../models/RackServicios');
const Servicio = require('../models/Servicio');
const Documento = require('../models/Evento');
const habitacionController = require('../controllers/habitacionController');
const utilidadesController = require('../controllers/utilidadesController');
const usersController = require('./../controllers/usersController');
const logController = require('../controllers/logController');

async function getAllRackServices(req, res, next) {
    try {

        const services = await RackServicios.find()
        res.send(services);
    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function getAllRackServicesMongo(req, res, next, id) {
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
        const loggedUserId = req.session.id;
        const { id_reserva, id_servicio, descripcion, fecha, status, costo } = req.body;

        if (!id_servicio || !id_reserva) {
            return res.status(400).send('Servicio requerido'); // Si no se encuentra el documento, devolver un error 404
        }

        // const documento = await Documento.findOne({ 'events._id': id_reserva });

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

        if (!habitacion) {
            return res.status(404).send('Habitacion not found'); // Si no se encuentra el evento, devolver un error 404
        }

        const nombreHabitacion = habitacion.propertyDetails.name


        const servicio = {
            id_reserva: new mongoose.Types.ObjectId(id_reserva),
            id_servicio: new mongoose.Types.ObjectId(id_servicio),
            descripcion,
            fecha,
            status,
            nombreHabitacion,
            costo
        }

        const service = new RackServicios(servicio);
        await service.save();

        // Comision para servicios adicionales
        const user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)
        const servicioEncontrado = await Servicio.findOne({ _id: id_servicio });

        let userTopAdmin = {}

        while (userTopAdmin.privilege !== "Administrador") {
            userTopAdmin = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
        }

        const proveedorId = servicioEncontrado.supplier.toString();
        const adminServicioId = servicioEncontrado.serviceManager.toString();

        let adminCommission = servicioEncontrado.basePrice - servicioEncontrado.costPrice;
        let firstCommission = servicioEncontrado.firstCommission; // Para admin del vendedor
        let secondCommission = servicioEncontrado.secondCommission; // Para vendedor

        let costoBaseServicio = servicioEncontrado.costPrice;

        // Utilidad del proveedor ( costo base)
        await utilidadesController.altaComisionReturn({
            monto: costoBaseServicio,
            concepto: `Comisión Proveedor por Servicio: ${servicioEncontrado.service}`,
            fecha,
            idUsuario: proveedorId,
            idReserva: new mongoose.Types.ObjectId(id_reserva),
            idServicio: new mongoose.Types.ObjectId(id_servicio)
        })

        // Comision del administrador (diferencia entre costo y precio base)
        await utilidadesController.altaComisionReturn({
            monto: adminCommission,
            concepto: `Comisión/utilidad servicio ${servicioEncontrado.service}`,
            fecha,
            idUsuario: adminServicioId,
            idReserva: new mongoose.Types.ObjectId(id_reserva),
            idServicio: new mongoose.Types.ObjectId(id_servicio)

        })

        // Comision del administrador del vendedor
        await utilidadesController.altaComisionReturn({
            monto: firstCommission,
            concepto: `Comisión admin ligado servicio: ${servicioEncontrado.service}`,
            fecha,
            idUsuario: userTopAdmin._id.toString(),
            idReserva: new mongoose.Types.ObjectId(id_reserva),
            idServicio: new mongoose.Types.ObjectId(id_servicio)

        })

        // Comision del vendedor
        await utilidadesController.altaComisionReturn({
            monto: secondCommission,
            concepto: `Comisión servicio: ${servicioEncontrado.service}`,
            fecha,
            idUsuario: user._id.toString(),
            idReserva: new mongoose.Types.ObjectId(id_reserva),
            idServicio: new mongoose.Types.ObjectId(id_servicio)

        })

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: id_reserva,
            acciones: `Servicio ${servicioEncontrado.service} agregado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }
        
        await logController.createBackendLog(logBody);






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
        const service = await RackServicios.findById(id);
        await RackServicios.findByIdAndDelete(id);

        const idServicio = service.id_servicio;
        const idReserva = service.id_reserva;
        const utilidadEliminada = await utilidadesController.eliminarComisionServicio(idReserva, idServicio);
        if (utilidadEliminada) {
            console.log("Utilidad de servicio eliminada con éxito");
        } else {
            console.log("No se pudo eliminar la utilidad de servicio");
            res.status(200).json({ success: false });
            return;
        }
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