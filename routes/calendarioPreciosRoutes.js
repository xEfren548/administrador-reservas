const DAYS_IN_YEAR = 365; // Definir DAYS_IN_YEAR a nivel global
const BASE_RATE = 2800;

const express = require('express');
const moment = require('moment');
const router = express.Router();

function calculateRate(dayOfYear) {
    // Aquí puedes implementar la lógica para calcular la tarifa
    // Puedes ajustar esta lógica según tus necesidades
    return BASE_RATE + (dayOfYear % 10) * 10; // Ejemplo de tarifa variable
}

function getDateFromDayOfYear(dayOfYear) {
    const date = new Date(new Date().getFullYear(), 0); // Empezar desde el primer día del año actual
    date.setDate(dayOfYear); // Establecer el día del año
    const options = { day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-ES', options); // Devolver la fecha en formato 'DD/MM'
}

router.get('/calendario-precios', async (req, res) => {
    try {
        const url = 'http://localhost:3005/api/habitaciones'; // Asegúrate de agregar http:// al URL

        const response = await fetch(url); // Espera a que se complete la solicitud fetch

        const data = await response.json(); // Espera a que se convierta la respuesta en formato JSON

        const habitaciones = data[0].resources.map(habitacion => {
            const rates = Array.from({ length: DAYS_IN_YEAR }, (_, day) => calculateRate(day + 1)); // Obtener un arreglo con las tarifas
            return { title: habitacion.title, rates };
        });
        console.log(habitaciones); // Imprime las habitaciones para verificar

        const daysWithDates = Array.from({ length: DAYS_IN_YEAR }, (_, index) => getDateFromDayOfYear(index + 1)); // Obtener un arreglo con las fechas correspondientes a cada día del año

        res.render('calendarioPrecios', {
            layout: 'layoutCalendarioPrecios',
            habitaciones: habitaciones, // Pasa las habitaciones a la plantilla
            daysWithDates: daysWithDates // Pasa el arreglo de fechas a la plantilla

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