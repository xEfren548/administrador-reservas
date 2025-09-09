const express = require('express');
const moment = require('moment');
const router = express.Router();
const eventController = require('../controllers/eventController');
const habitacionController = require('../controllers/habitacionController');
const pagoController = require('../controllers/pagoController');
const Service = require('../models/Servicio');
const Cliente = require('../models/Cliente');
const RackServicios = require('../models/RackServicios');
const Evento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const Usuario = require('../models/Usuario');
const Log = require('../models/Log');

const validationRequest = require('../common/middlewares/validation-request');

// Rutas estáticas
router.get('/eventos', eventController.obtenerEventos);
router.get('/eventos-opt', eventController.obtenerEventosOptimizados);

router.get('/eventos/chalet/:id', eventController.obtenerEventosDeCabana);
router.get('/eventos/route/:id', eventController.obtenerEventoPorIdRoute);
router.get('/cotizar', eventController.cotizadorView);

router.post('/eventos', eventController.createReservationValidators, validationRequest, eventController.createReservation);
router.post('/notas/:id', eventController.crearNota);
router.post('/eventos/reservadueno', eventController.createOwnersReservationValidators, validationRequest, eventController.createOwnerReservation)
router.post('/eventos/cotizaciones', eventController.cotizadorChaletsyPrecios);

router.put('/eventos/:id', eventController.editarEvento);
router.put('/eventos/:id/modificar', eventController.modificarEvento);

router.delete('/eventos/:id', eventController.eliminarEvento);
router.delete('/notas', eventController.eliminarNota)


// Rutas con contenido dinamico de handlebars
router.get('/eventos/:idevento', async (req, res) => {
    try {
        const idEvento = req.params.idevento;
        const privilege = req.session.privilege;

        // Llama a la función del controlador de eventos para obtener los detalles del evento
        // const evento = await eventController.obtenerEventoPorId(idEvento);
        const evento = await Evento.findById(idEvento).lean();

        const clientesTodos = await Cliente.find({}).lean();
        if (!clientesTodos) {
            throw new NotFoundError("No client not found");
        }

        eventoJson = JSON.stringify(evento);
        const eventoObjeto = JSON.parse(eventoJson);
        eventoObjeto.arrivalDate = moment.utc(eventoObjeto.arrivalDate).format('DD/MM/YYYY');
        eventoObjeto.departureDate = moment.utc(eventoObjeto.departureDate).format('DD/MM/YYYY');
        eventoObjeto.reservationDate = moment.utc(eventoObjeto.reservationDate).format('DD/MM/YYYY');

        eventoObjeto.comisionVendedor = eventoObjeto.comisionVendedor ? eventoObjeto.comisionVendedor : 0;


        const habitacion = await habitacionController.obtenerHabitacionPorId(eventoObjeto.resourceId);
        const habitacionJson = JSON.stringify(habitacion);
        const habitacionObjeto = JSON.parse(habitacionJson);

        const idCliente = eventoObjeto.client;

        const clientes = await Cliente.find({ _id: idCliente }).lean();
        let cliente = clientes[0]
        if (!cliente) {
            cliente = {
                firstName: eventoObjeto.clienteProvisional,
            }
        }

        // cliente.firstName = cliente.firstName ? cliente.firstName : eventoObjeto.clienteProvisional;

        const pagos = await pagoController.obtenerPagos(idEvento);

        const servicios = await Service.find().lean();
        // console.log(servicios)

        const rackServicios = await RackServicios.find({ id_reserva: idEvento }).lean();

        let pagoTotal = 0
        pagos.forEach(pago => {
            pago.fechaPago = moment.utc(pago.fechaPago).format('DD/MM/YYYY');
            pagoTotal += pago.importe;
        })

        eventoObjeto.pagoTotal = pagoTotal

        let totalServicios = 0;
        rackServicios.forEach(service => {
            service.fecha = moment.utc(service.fecha).format('DD/MM/YYYY');
            totalServicios += service.costo

        })

        rackServicios.totalServicios = totalServicios

        const logs = await Log.find({ idReserva: idEvento, type: 'reservation' }).lean();

        logs.sort((a, b) => a.fecha - b.fecha);

        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses en JavaScript son 0-indexados
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        };

        const formattedActions = logs.map(action => {
            const fecha = formatDate(action.fecha);
            const hora = action.fecha.toTimeString().split(' ')[0];
            return {
                ...action,
                fecha,
                hora
            };
        });

        const desplazamiento = 3


        const notasPrivadas = eventoObjeto.privateNotes;
        if (notasPrivadas) {
            notasPrivadas.forEach(nota => {
                nota.texto = eventController.cifrarMensaje(nota.texto, desplazamiento);
            });
        }

        console.log(notasPrivadas);


        eventoObjeto.privilege = privilege;

        eventoObjeto.ota_name = eventoObjeto.channels?.ota_name ? eventoObjeto.channels.ota_name : "Recepción";

        // Renderiza la página HTML con los detalles del evento
        res.render('detalles_evento', {
            evento: eventoObjeto,
            habitacion: habitacionObjeto,
            cliente: cliente,
            clientes: clientesTodos,
            pagos: pagos,
            servicios: servicios,
            rackServicios: rackServicios,
            logs: formattedActions
        });
    } catch (error) {
        console.error('Error al obtener los detalles del evento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener los detalles de un evento por su ID para FLUTTER
router.get('/eventos/f/:idevento', async (req, res) => {
    const id = req.params.idevento;
    try {
        // const documentos = await Documento.find({ 'events.resourceId': newId });
        // const habitaciones = await Habitacion.findOne();

        // let eventos = [];
        // documentos.forEach(doc => {
        //     const matchingEvents = doc.events.filter(evento => evento.resourceId.equals(newId));
        //     eventos = eventos.concat(matchingEvents);
        // });
        console.log(id);
        const evento = await Evento.findById(id).lean();

        if (!evento) { throw new Error('No se encontró el evento'); }

        // const habitacion = habitaciones.resources.find(habitacion => habitacion._id.equals(newId));
        const habitacion = await Habitacion.findById(evento.resourceId).lean();
        if (!habitacion) { throw new Error('No se encontró la habitación'); }

        // Fetch colorUsuario for each evento's createdBy
        const createdBy = evento.createdBy;
        let colorUsuario = null; // Default to null if usuario is not found
        let clientName = null;
        let chaletName = habitacion.propertyDetails.name;
        let creadaPor = null;
        let precioBaseTotal = null;
        let montoPendiente = null;
        let pagosTotales = 0.0;
        if (createdBy) {
            const usuario = await Usuario.findById(createdBy).select('color firstName lastName').exec();
            if (usuario) {
                colorUsuario = usuario.color;
                creadaPor = usuario.firstName + ' ' + usuario.lastName;
            }
        }
        if (evento.client) {
            const client = await Cliente.findById(evento.client);
            if (client) {
                // clientName = (client.firstName + ' ' + client.lastName).toUpperCase();
                clientName = (client.firstName + ' ' + client.lastName);
            } else {
                clientName = "Reserva"
            }
        } else {
            if (evento.clienteProvisional) {
                clientName = evento.clienteProvisional;
            }
        }

        if (evento.status !== "reserva dueño") {
            const pagosReserva = await pagoController.obtenerPagos(evento._id);
            let pagoTotal = 0
            pagosReserva.forEach(pago => {
                pagoTotal += pago.importe;
            })
            const totalReserva = evento.total;
            // let precioBaseTotal = 0
            if (evento.status === "reserva de dueño") {
                precioBaseTotal = 0;
            } else {
                precioBaseTotal = evento.nNights > 1 ? habitacion.others.basePrice2nights * evento.nNights : habitacion.others.basePrice * evento.nNights
            }

            montoPendiente = totalReserva - pagoTotal;
            pagosTotales = pagoTotal;
            console.log("Precio base total: ", precioBaseTotal)
        }

        const logs = await Log.find({ idReserva: id, type: 'reservation' }).lean();

        const nuevoEvento = {
            ...evento,
            colorUsuario: colorUsuario,
            clientName: clientName,
            creadaPor: creadaPor,
            precioBaseTotal: precioBaseTotal,
            chaletName: chaletName,
            montoPendiente: montoPendiente,
            pagosTotales: pagosTotales,
            imagenReserva: Array.isArray(habitacion.images) ? habitacion.images[0] : '',
            logs: logs || []
        };

        console.log(nuevoEvento)
        res.send(nuevoEvento);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
});

router.get('/check-availability', async (req, res) => {
    const { resourceId, arrivalDate, departureDate, eventId } = req.query;

    // const arrival = new Date(arrivalDate);
    // const departure = new Date(departureDate);

    try {
        const nNights = eventController.calculateNightDifference(arrivalDate, departureDate);
        const isAvailable = await eventController.checkAvailability(resourceId, arrivalDate, departureDate, eventId, nNights);

        res.json({ available: isAvailable });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.get('/disponibilidad', eventController.obtenerHabitacionesDisponibles);
router.get('/reservas/entrantes', eventController.getIncomingReservations);

router.post('/eventos/move-to-playground', eventController.moveToPlayground)
router.get('/calendar/duenos', eventController.reservasDeDuenos)
router.get('/calendar/colaboradorduenos', eventController.reservasDeDuenosParaColaborador)
router.post('/whatsapp/send-whatsapp', eventController.sendIntructionsToWhatsapp);
router.post('/email/send-email', eventController.sendReservationMail);


module.exports = router;