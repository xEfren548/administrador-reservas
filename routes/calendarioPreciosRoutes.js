const listaDePreciosController = require('../controllers/listaDePrecios.controller')    

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
    const options = { day: 'numeric', month: 'short' , year: 'numeric'};
    return date.toLocaleDateString('es-ES', options); // Devolver la fecha en formato 'DD/MM'
}

router.get('/calendario-precios', async (req, res) => {
    try {
        const url = 'http://localhost:3005/api/habitaciones'; // Asegúrate de agregar http:// al URL
        const urlListaPrecios = 'http://localhost:3005/api/calendario-precios'; 

        const response = await fetch(url);
        const response2 = await fetch(urlListaPrecios);
        const data = await response.json();
        const data2 = await response2.json();

        const habitaciones = data[0].resources.map(habitacion => {
            return { title: habitacion.title, baseRate: habitacion.precio_base };
        });

        const listaPrecios = data2.map(lista => {
            return { nuevo_precio: lista.nuevo_precio, fechaInicio: lista.fechaInicio, fechaFinal: lista.fechaFinal, habitacion: lista.habitacion }
        })

        const daysWithDates = Array.from({ length: DAYS_IN_YEAR }, (_, index) => getDateFromDayOfYear(index + 1)); // Obtener un arreglo con las fechas correspondientes a cada día del año

        console.log(habitaciones);
        console.log(listaPrecios);
        
        res.render('calendarioPrecios', {
            layout: 'layoutCalendarioPrecios',
            habitaciones: habitaciones,
            daysWithDates: daysWithDates
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error al obtener las habitaciones');
    }
})

router.post('/api/calendario-precios', listaDePreciosController.agregarNuevoPrecio)
router.get('/api/calendario-precios', listaDePreciosController.consultarPrecios)

module.exports = router;