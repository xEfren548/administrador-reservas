const Documento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const Usuario = require('../models/Usuario');
const rackLimpiezaController = require('../controllers/rackLimpiezaController');
const Cliente = require('../models/Cliente');
const { check } = require("express-validator");
const BadRequestError = require("../common/error/bad-request-error");
const NotFoundError = require('../common/error/not-found-error');

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
            const arrivalDate = new Date(req.body.arrivalDate);
            const departureDate = new Date(req.body.departureDate);
            const currentDate = new Date();

            if (arrivalDate <= currentDate) {
                throw new BadRequestError('Arrival date must be after the current date');
            }
            if (arrivalDate >= departureDate) {
                throw new BadRequestError('Departure date must be after arrival date');
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
            const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === req.body.chaletName);
            if (!chalet) {
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
        .optional()
        .if(value => value !== '')
        .isNumeric().withMessage('Discount percentage must be a number')
        .toFloat()
        .custom(async (value, { req }) => {
            if (value <= 0 || value > 100) {
                throw new BadRequestError('Invalid percentage');
            }
            return true;
        }),
];

const submitReservationValidators = [
    check()
        .custom((value, { req }) => {
            const reservationDetails = req.session.reservationInProgress;
            if (!reservationDetails) {
                throw new BadRequestError('There is no reservation in progress to be submitted');
            }
            return true;
        }),
];

async function obtenerEventos(req, res) {
    const { id } = req.params;
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

async function obtenerEventoPorIdRoute(req, res) {
    try {
        const { id } = req.params;
        const eventosExistentes = await Documento.findOne(); // Buscar el documento que contiene los eventos

        if (!eventosExistentes) {
            throw new Error('No se encontraron eventos');
        }

        // Buscar el evento por su id
        const evento = eventosExistentes.events.find(evento => evento.id === id);

        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }
        res.send(evento);
    } catch (error) {
        throw new Error('Error al obtener el evento por id: ' + error.message);
    }
}

async function createReservation(req, res, next) {
    const { clientEmail, chaletName, arrivalDate, departureDate, maxOccupation, nNights, units, total, discount } = req.body;

    console.log(req.body)

    try {
        const client = await Cliente.find({ email: clientEmail });
        if (!client) {
            throw new NotFoundError('Client does not exist');
        }

        const chalets = await Habitacion.findOne();
        const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === chaletName);
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist');
        }

        const reservationToAdd = {
            client: client[0]._id,
            resourceId: chalet._id,
            arrivalDate: arrivalDate,
            departureDate: departureDate,
            maxOccupation: maxOccupation,
            nNights: nNights,
            url: `http://${process.env.URL}/api/eventos/${chalet._id}`,
            units: units,
            total: total,
            discount: discount
        };



        const documento = await Documento.findOne();
        documento.events.push(reservationToAdd);
        await documento.save();


        // Guardar la reserva actualizada en la base de datos
        const documento2 = await Documento.findOne()
        
        const idReserva = documento.events[documento.events.length - 1]._id.toString()
        const url = `http://${process.env.URL}/api/eventos/${idReserva}`;
        const evento = documento2.events.find(habitacion => habitacion.id === idReserva);
        
        evento.url = url;
        await documento2.save();

        const descripcionLimpieza = 'Limpieza para la habitación ' + chaletName;
        const fechaLimpieza = new Date(departureDate)
        fechaLimpieza.setDate(fechaLimpieza.getDate() + 1)
        const statusLimpieza = 'Pendiente'

        console.log(idReserva)
        console.log(descripcionLimpieza)
        console.log(fechaLimpieza)
        console.log(statusLimpieza)

        await rackLimpiezaController.createServiceForReservation({
            id_reserva: idReserva,
            descripcion: descripcionLimpieza,
            fecha: fechaLimpieza,
            status: statusLimpieza
        })

        console.log('Nueva reservación agregada:', documento.events[documento.events.length - 1]._id);
        res.status(200).send({ message: 'Nueva reservación agregada', reservationId: documento.events[documento.events.length - 1]._id });
    } catch (err) {
        console.log(err);
        return next(err);
    }
}

async function editarEvento(req, res) {
    try {
        const id = req.params.id;
        const { resourceId, nNights, arrivalDate, departureDate, url, total } = req.body;

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
        if (resourceId !== undefined && resourceId !== null) {
            evento.resourceId = resourceId;
        }

        if (nNights !== undefined && nNights !== null) {
            evento.nNights = nNights;
        }

        if (arrivalDate !== undefined && arrivalDate !== null) {
            evento.arrivalDate = arrivalDate;
        }

        if (departureDate !== undefined && departureDate !== null) {
            evento.departureDate = departureDate;
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
    } catch (error) {
        console.error('Error al eliminar el evento:', error);
        res.status(500).json({ error });
    }
}

async function modificarEvento(req, res) {
    try {
        const { event, newResource } = req.body;

        console.log('eventoRecibido: ', event);

        // Obtener el ID del evento y la nueva fecha
        const eventId = req.params.id;
        const newStartDate = event.start;
        const newEndDate = event.end;

        // Buscar el evento existente por su ID
        const eventosExistentes = await Documento.findOne();


        const evento = eventosExistentes.events.find(evento => evento.id === eventId);


        if (!evento) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        } else {
            console.log('evento encontrado: ', evento);
        }



        // Actualizar la fecha de inicio y fin del evento existente
        evento.start = newStartDate;
        evento.end = newEndDate;

        if (newResource) {
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

async function crearNota(req, res) {
    const idReserva = req.params.id;
    const { texto } = req.body;
    console.log(texto);
    console.log(req.body);

    try {
        const eventosExistentes = await Documento.findOne(); // Buscar el documento que contiene los eventos

        if (!eventosExistentes) {
            throw new Error('No se encontraron eventos');
        }

        // Buscar el evento por su id
        const evento = eventosExistentes.events.find(evento => evento._id.toString() === idReserva);

        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }

        evento.notes.push({ texto });

        await eventosExistentes.save();

        res.status(200).json({ message: 'Nueva nota agregada exitosamente a la reserva.' });


    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

async function eliminarNota(req, res) {
    console.log('Desde eliminar nota')
    const idReserva = req.query.idReserva; // Obtener el ID de la reserva desde los parámetros de la consulta
    const idNota = req.query.idNota; // Obtener el ID de la nota a eliminar desde los parámetros de la consulta

    console.log(idReserva, idNota)

    try {
        // Buscar el documento que contiene los eventos
        const documento = await Documento.findOne();

        if (!documento) {
            throw new Error('No se encontraron eventos');
        }

        console.log(documento);
        // Buscar el evento por su ID dentro del array de eventos
        const evento = documento.events.find(evento => evento._id.toString() === idReserva);


        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }

        // Encontrar la nota por su ID dentro del array de notas del evento
        const indexNota = evento.notes.findIndex(nota => nota._id.toString() === idNota);

        if (indexNota === -1) {
            throw new Error('La nota no fue encontrada en el evento');
        }

        // Eliminar la nota del array de notas del evento
        evento.notes.splice(indexNota, 1);

        // Guardar el documento actualizado en la base de datos
        await documento.save();

        res.status(200).json({ message: 'Nota eliminada exitosamente de la reserva.' });
    } catch (error) {
        // Manejar cualquier error y enviar una respuesta de error al cliente
        console.error('Error al eliminar la nota:', error.message);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    createReservationValidators,
    submitReservationValidators,
    obtenerEventos,
    obtenerEventoPorId,
    obtenerEventoPorIdRoute,
    createReservation,
    editarEvento,
    eliminarEvento,
    modificarEvento,
    crearNota,
    eliminarNota
};

