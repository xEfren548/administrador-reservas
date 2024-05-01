const precioBaseController = require('../controllers/precioBaseController')    
const habitacionController = require('../controllers/habitacionController')

const DAYS_IN_YEAR = 365; // Definir DAYS_IN_YEAR a nivel global

const express = require('express');
const moment = require('moment');
const router = express.Router();

function getDaysInYear() {
    const currentDate = new Date(); // Get the current date
    const currentYear = currentDate.getFullYear(); // Get the current year
    const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0; // Check if it's a leap year
    return isLeapYear ? 366 : 365; // Return 366 days for leap years and 365 days for non-leap years
}

function getDateFromDayOfYear(dayOfYear) {
    const date = new Date(new Date().getFullYear(), 0); // Empezar desde el primer día del año actual
    date.setDate(dayOfYear); // Establecer el día del año
    const options = { day: 'numeric', month: 'short' , year: 'numeric'};
    return date.toLocaleDateString('es-ES', options); // Devolver la fecha en formato 'DD/MM'
}

router.get('/calendario-precios', async (req, res) => {
    try {
        
        const url = 'http://localhost:3005/api/habitaciones'; 

        // Obtener las habitaciones
        const response = await fetch(url);
        const data = await response.json();
        const habitaciones = data[0].resources;

        // Crear un arreglo con las fechas correspondientes a cada día del año
        const daysWithDates = Array.from({ length: getDaysInYear() }, (_, index) => getDateFromDayOfYear(index + 1));

        // console.log(habitaciones);

        const preciosHabitacionesData = await precioBaseController.consultarPrecios();
        // console.log(preciosHabitacionesData);

        // console.log(preciosHabitaciones)

        res.render('calendarioPrecios', {
            layout: 'layoutCalendarioPrecios',
            habitaciones: habitaciones, // Pasa las habitaciones a la plantilla
            daysWithDates: daysWithDates, // Pasa el arreglo de fechas a la plantilla
            preciosHabitaciones: preciosHabitacionesData // Pasa los precios de las habitaciones a la plantilla
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error al obtener las habitaciones');
    }
})

router.get('/api/calendario-precios', precioBaseController.verificarExistenciaRegistro);
router.post('/api/calendario-precios', precioBaseController.agregarNuevoPrecio);
router.get('/api/calendario-precios/:id', precioBaseController.consultarPreciosPorId)
router.delete('/api/calendario-precios', precioBaseController.eliminarRegistroPrecio);
// router.get('/api/calendario-precios', precioBaseController.obtenerHabitacionesConPrecios)



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