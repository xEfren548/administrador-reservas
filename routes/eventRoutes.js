const express = require('express');
const moment = require('moment');
const router = express.Router();
const eventController = require('../controllers/eventController');
const habitacionController = require('../controllers/habitacionController');
const pagoController = require('../controllers/pagoController');
const Service = require('../models/Servicio');
const Cliente = require('../models/Cliente');
const RackServicios = require('../models/RackServicios');
const Log = require('../models/Log');

const validationRequest = require('../common/middlewares/validation-request');

// Rutas estáticas
router.get('/eventos', eventController.obtenerEventos);
router.get('/eventos/chalet/:id', eventController.obtenerEventosDeCabana);
router.get('/eventos/route/:id', eventController.obtenerEventoPorIdRoute);
router.post('/eventos', eventController.createReservationValidators, validationRequest, eventController.createReservation);
router.put('/eventos/:id', eventController.editarEvento);
router.put('/eventos/:id/modificar', eventController.modificarEvento);
router.delete('/eventos/:id', eventController.eliminarEvento);
router.post('/notas/:id', eventController.crearNota);
router.delete('/notas', eventController.eliminarNota)


// Rutas con contenido dinamico de handlebars
router.get('/eventos/:idevento', async (req, res) => {
    try {
        const idEvento = req.params.idevento;

        // Llama a la función del controlador de eventos para obtener los detalles del evento
        const evento = await eventController.obtenerEventoPorId(idEvento);
        eventoJson = JSON.stringify(evento);
        const eventoObjeto = JSON.parse(eventoJson);
        console.log(eventoObjeto);
        eventoObjeto.arrivalDate = moment.utc(eventoObjeto.arrivalDate).format('DD/MM/YYYY');
        eventoObjeto.departureDate = moment.utc(eventoObjeto.departureDate).format('DD/MM/YYYY');
        eventoObjeto.reservationDate = moment.utc(eventoObjeto.reservationDate).format('DD/MM/YYYY');


        const habitacion = await habitacionController.obtenerHabitacionPorId(eventoObjeto.resourceId);
        const habitacionJson = JSON.stringify(habitacion);
        const habitacionObjeto = JSON.parse(habitacionJson);

        const idCliente = eventoObjeto.client;

        const clientes = await Cliente.find({ _id: idCliente }).lean();
        const cliente = clientes[0]

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
        console.log(logs);

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




        // Renderiza la página HTML con los detalles del evento
        res.render('detalles_evento', {
            evento: eventoObjeto,
            habitacion: habitacionObjeto,
            cliente: cliente,
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

router.get('/check-availability', async (req, res) => {
    const { resourceId, arrivalDate, departureDate } = req.query;

    // const arrival = new Date(arrivalDate);
    // const departure = new Date(departureDate);

    try {
        const isAvailable = await eventController.checkAvailability(resourceId, arrivalDate, departureDate);

        res.json({ available: isAvailable });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.post('/eventos/move-to-playground', eventController.moveToPlayground)
router.get('/calendar/duenos', eventController.reservasDeDuenos)

module.exports = router;