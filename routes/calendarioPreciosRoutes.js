const express = require('express');
const moment = require('moment');
const router = express.Router();

const habitacionController = require('../controllers/habitacionController');

router.get('/calendario-precios', async (req, res) => {
    try {
        const url = 'http://localhost:3005/api/habitaciones'; // Asegúrate de agregar http:// al URL

        const response = await fetch(url); // Espera a que se complete la solicitud fetch
        
        const data = await response.json(); // Espera a que se convierta la respuesta en formato JSON
        
        const habitaciones = data[0].resources

        console.log(habitaciones); // Imprime las habitaciones para verificar

        res.render('calendarioPrecios', {
            layout: 'layoutCalendarioPrecios',
            habitaciones: habitaciones // Pasa las habitaciones a la plantilla
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error al obtener las habitaciones');
    }
})

// router.get('/eventos/:idevento', async (req, res) => {
//     try {
//         const idEvento = req.params.idevento;

//         // Llama a la función del controlador de eventos para obtener los detalles del evento
//         const evento = await eventController.obtenerEventoPorId(idEvento);
//         eventoJson = JSON.stringify(evento);
//         const eventoObjeto = JSON.parse(eventoJson);
//         eventoObjeto.start = moment(eventoObjeto.start).format('DD/MM/YYYY');
//         eventoObjeto.end = moment(eventoObjeto.end).format('DD/MM/YYYY');

//         const habitacion = await habitacionController.obtenerHabitacionPorId(eventoObjeto.resourceId);
//         const habitacionJson = JSON.stringify(habitacion);
//         const habitacionObjeto = JSON.parse(habitacionJson);


//         // Renderiza la página HTML con los detalles del evento
//         console.log(eventoObjeto);
//         res.render('detalles_evento', { 
//             evento: eventoObjeto,
//             habitacion: habitacionObjeto
//         });
//     } catch (error) {
//         console.error('Error al obtener los detalles del evento:', error);
//         res.status(500).json({ error: 'Error interno del servidor' });
//     }
// });

module.exports = router;