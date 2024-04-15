const Documento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const {check} = require("express-validator");
const BadRequestError = require("../common/error/bad-request-error");
const NotFoundError = require('../common/error/not-found-error');
const mongoose = require('mongoose');

const createReservationValidators = [
    check('clientEmail')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const client = await Cliente.findOne({ email: value });
            if (!client) {
                throw new NotFoundError('Client does not exist');
            }
            return true;
        }),
    check('arrivalDate')
        .notEmpty().withMessage('Start date is required')
        .toDate(),
    check('departureDate')
        .notEmpty().withMessage('End date is required')
        .toDate(),
    check()
        .custom((value, { req }) => {
            const start = new Date(req.body.start);
            const end = new Date(req.body.end);
            if (start >= end) {
                throw new BadRequestError('End date must be after start date');
            }
            return true;
        }),
    check("nNights")
        .notEmpty().withMessage('Number of nights is required')
        .isNumeric().withMessage('Number of nights must be a number'),
    check("chaletName")
        .notEmpty().withMessage('Chalet name is required')
        .isLength({ max: 255 }).withMessage("Chalet name must be less than 255 characters")
        .custom(async (value, { req }) => {
            const chalets = await Habitacion.findOne();
            const chalet = chalets.resources.find(chalet => chalet.title === value);
            if(!chalet){
                throw new NotFoundError('Chalet does not exist');
            }
            return true;
        }),
    check("maxOccupation")
        .notEmpty().withMessage('Max occupation is required')
        .isNumeric().withMessage('Max occupation must be a number'),
    check("units")
        .notEmpty().withMessage('Number of units is required')
        .isNumeric().withMessage('Number of units must be a number'),
    check('total')
        .notEmpty().withMessage('Total amount is required')
        .isNumeric().withMessage('Total amount must be a number')
        .toFloat(),
    check('discount')
        .notEmpty().withMessage('Discount percentage is required')
        .isNumeric().withMessage('Discount percentage must be a number')
        .toFloat()
        .custom(async (value, { req }) => {
            if(value <= 0 || value > 100){
                throw new BadRequestError('Invalid percentage');
            }
            return true;
        }),
];

const submitReservationValidators = [
    check()
        .custom((value, { req }) => {
            const reservationDetails = req.session.reservationInProgress;
            if(!reservationDetails){
                throw new BadRequestError('There is no reservation in progress to be submitted');
            }
            return true;
        }),
];

async function obtenerEventos(req, res) {
    try {
        const eventos = await Documento.find();
        res.send(eventos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

async function obtenerEventoPorId(id) {
    try {
        const eventosExistentes = await Documento.findOne(); // Buscar el documento que contiene los eventos
        
        if (!eventosExistentes) {
            throw new Error('No se encontraron eventos');
        }

        // Buscar el evento por su id
        const evento = eventosExistentes.events.find(evento => evento.id === id);

        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }
        return evento;
    } catch (error) {
        throw new Error('Error al obtener el evento por id: ' + error.message);
    }
}

async function createReservation(req, res, next) {
    const { clientEmail, chaletName, arrivalDate, departureDate, maxOccupation, nNights, units, total, discount } = req.body;

    try{
        const client = await Cliente.find({ email: clientEmail });
        if (!client) {
            throw new NotFoundError('Client does not exist');
        }

        const chalets = await Habitacion.findOne();
        const chalet = chalets.resources.find(chalet => chalet.title === chaletName);
        if(!chalet){
            throw new NotFoundError('Chalet does not exist');
        }
        
        console.log(client);
        console.log("HOLAA ", client[0]._id);
        const reservationToAdd = {
            client: client[0]._id,
            resourceId: chalet._id,
            arrivalDate: arrivalDate, 
            departureDate: departureDate,
            maxOccupation: maxOccupation,
            nNights: nNights,            
            url: `${process.env.URL}/eventos/${chalet._id}`,
            units: units,
            total: total,
            discount: discount
        };

        const documento = await Documento.findOne();
        documento.events.push(reservationToAdd);
        await documento.save();
        
        console.log('Nueva reservación agregada:', documento.events[documento.events.length - 1]._id );
        res.status(200).json({ message: 'Nueva reservación agregada', reservationId:  documento.events[documento.events.length - 1]._id });
    } catch (err) {
        console.log(err);
        return next(err);
    }
}

async function addReservationToCalendar(req, res, next){  
    req.session.email = "test@gmail.com";
    
}

async function editarEvento(req, res) {
    try {
        const id = req.params.id;
        const { resourceId, title, start, end, url, total } = req.body;

        // Fetch existing rooms from the database
        const eventosExistentes = await Documento.findOne();
        
        if (!eventosExistentes) {
            return res.status(404).json({ mensaje: 'No se encontraron habitaciones' });
        }

        // Find the room to edit by its ID
        const evento = eventosExistentes.events.find(habitacion => habitacion.id === id);

        if (!evento) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }

        // const { resourceId, title, start, end, url, total } = req.body;


        // Update only the provided fields
        if (resourceId !== undefined && resourceId !== null){
            evento.resourceId = resourceId;
        }

        if (title !== undefined && title !== null) {
            evento.title = title;
        }

        if (start !== undefined && start !== null) {
            evento.start = start;
        }

        if (end !== undefined && end !== null) {
            evento.end = end;
        }

        if (url !== undefined && url !== null) {
            evento.url = url;
        }

        if (total !== undefined && total !== null) {
            evento.total = total;
        }



        // Save the updated room to the database
        await eventosExistentes.save();

        console.log('evento editado:', evento);
        res.status(200).json({ mensaje: 'evento editado correctamente', evento });
    } catch (error) {
        console.error('Error al editar evento:', error);
        res.status(500).json({ error });
    }
}

async function eliminarEvento(req, res) {

    try {
        const id = req.params.id;
        const eventosExistentes = await Documento.findOne();

        
        
        if (!eventosExistentes) {
            return res.status(404).json({ mensaje: 'No se encontraron eventos' });
        }

        // Find the index of the room to delete by its ID
        const index = eventosExistentes.events.findIndex(evento => evento.id === id);

        if (index === -1) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }

        // Remove the room from the array
        eventosExistentes.events.splice(index, 1);

        // Save the updated room list to the database
        await eventosExistentes.save();

        console.log('Evento eliminado con éxito');
        res.status(200).json({ mensaje: 'Evento eliminado correctamente' });
    } catch(error){
        console.error('Error al eliminar el evento:', error);
        res.status(500).json({ error });
    }
}

async function modificarEvento(req, res) {
    try {
        const { event, newResource } = req.body;

        console.log('eventoRecibido: ',  event);

        // Obtener el ID del evento y la nueva fecha
        const eventId = req.params.id;
        const newStartDate = event.start;
        const newEndDate = event.end;

        // Buscar el evento existente por su ID
        const eventosExistentes = await Documento.findOne();
        

        const evento = eventosExistentes.events.find(evento => evento.id === eventId);


        if (!evento) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }else {
            console.log('evento encontrado: ', evento);
        }

        

        // Actualizar la fecha de inicio y fin del evento existente
        evento.start = newStartDate;
        evento.end = newEndDate;

        if(newResource){
            const newResourceId = newResource.id;
            evento.resourceId = newResourceId;

        }

        // Guardar el evento actualizado en la base de datos
        await eventosExistentes.save();

        console.log('Evento modificado:', evento);
        res.status(200).json({ mensaje: 'Evento modificado correctamente', evento: evento });
    } catch (error) {
        console.error('Error al modificar el evento:', error);
        res.status(500).json({ error });
    }
}

module.exports = {
    createReservationValidators,
    submitReservationValidators,
    obtenerEventos,
    obtenerEventoPorId,
    createReservation,
    addReservationToCalendar,
    editarEvento,
    eliminarEvento,
    modificarEvento
};

