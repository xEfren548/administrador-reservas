const express = require('express');
const moment = require('moment');
const router = express.Router();
const eventController = require('../controllers/eventController');
const habitacionController = require('../controllers/habitacionController');
const pagoController = require('../controllers/pagoController');

const Cliente = require('../models/Cliente');
const validationRequest = require('../common/middlewares/validation-request');

// Rutas estáticas
router.get('/eventos', eventController.obtenerEventos);
router.post('/eventos/create-reservation', eventController.createReservationValidators, validationRequest, eventController.createReservation);
router.put('/eventos/:id', eventController.editarEvento);
router.put('/eventos/:id/modificar', eventController.modificarEvento);
router.delete('/eventos/:id', eventController.eliminarEvento);

router.post('/eventos/:id/notas', eventController.crearNota);
router.delete('/notas', eventController.eliminarNota);


// Rutas con contenido dinamico de handlebars
router.get('/eventos/:idevento', async (req, res) => {
    try {
        const idEvento = req.params.idevento;
        
        // Llama a la función del controlador de eventos para obtener los detalles del evento
        const evento = await eventController.obtenerEventoPorId(idEvento);
        eventoJson = JSON.stringify(evento);
        const eventoObjeto = JSON.parse(eventoJson);
        eventoObjeto.arrivalDate = moment(eventoObjeto.arrivalDate).format('DD/MM/YYYY');
        eventoObjeto.departureDate = moment(eventoObjeto.departureDate).format('DD/MM/YYYY');
        eventoObjeto.reservationDate = moment(eventoObjeto.reservationDate).format('DD/MM/YYYY');

        const habitacion = await habitacionController.obtenerHabitacionPorId(eventoObjeto.resourceId);
        const habitacionJson = JSON.stringify(habitacion);
        const habitacionObjeto = JSON.parse(habitacionJson);

        const idCliente = eventoObjeto.client;

        const clientes = await Cliente.find({_id: idCliente }).lean();
        const cliente = clientes[0]

        const pagos = await pagoController.obtenerPagos(idEvento);

        pagos.forEach(pago => {
            pago.fechaPago = moment(pago.fechaPago).format('DD/MM/YYYY');
        })
        
        // console.log(habitacionObjeto);

        // Renderiza la página HTML con los detalles del evento
        console.log(eventoObjeto);
        res.render('detalles_evento', { 
            evento: eventoObjeto,
            habitacion: habitacionObjeto,
            cliente: cliente,
            pagos: pagos
        });
    } catch (error) {
        console.error('Error al obtener los detalles del evento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


module.exports = router;