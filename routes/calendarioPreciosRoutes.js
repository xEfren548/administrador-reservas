const precioBaseController = require('../controllers/precioBaseController')    
const habitacionController = require('../controllers/habitacionController')
const preciosEspecialesController = require('../controllers/preciosEspecialesController')

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

// CURRENT CHANGE
function pricexdaymatrix(daysWithDates, habitaciones, preciosHabitacionesData, preciosEspecialesData) {
    var matrixhabitaciones = [];
    const dayOfYear = date => Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    
    habitaciones.forEach((habitacion, index) => {
        var habitacionesyprecio = {
            name: habitacion.propertyDetails.name,
            precios: [],
            preciosEspeciales: {}
        };
        var matrix = [];
        matrix.push(["Precio Base"]);
        for (var a = 1; a <= daysWithDates.length; a++) {
            matrix.push([habitacion.others.basePrice]);
        }
        var matrix2n = [];
        matrix2n.push(["Precio Base 2 Noches"]);
        for (var a = 1; a <= daysWithDates.length; a++) {
            matrix2n.push([habitacion.others.basePrice2nights]);
        }
        var matrixc1 = [];
        matrixc1.push(["Costo Base"]);
        for (var a = 1; a <= daysWithDates.length; a++) {
            matrixc1.push([habitacion.others.baseCost]);
        }
        var matrixc2 = [];
        matrixc2.push(["Costo Base 2 Noches"]);
        for (var a = 1; a <= daysWithDates.length; a++) {
            matrixc2.push([habitacion.others.baseCost2nights]);
        }

        preciosHabitacionesData.forEach((element) => {
            let currentTime = new Date(element.fecha).getTime();
            let updatedTime = new Date(currentTime + 24 * 60 * 60 * 1000);
            if (habitacion._id == element.habitacionId) {
                matrix[dayOfYear(updatedTime) - 1] = element.precio_modificado;
                matrix2n[dayOfYear(updatedTime) - 1] = element.precio_base_2noches;
                matrixc1[dayOfYear(updatedTime) - 1] = element.costo_base;
                matrixc2[dayOfYear(updatedTime) - 1] = element.costo_base_2noches;
            }
        });

        preciosEspecialesData.forEach((element) => {
            let currentTime = new Date(element.fecha).getTime();
            let updatedTime = new Date(currentTime + 24 * 60 * 60 * 1000);
            if (habitacion._id == element.habitacionId) {
                if (!habitacionesyprecio.preciosEspeciales[element.noPersonas]) {
                    habitacionesyprecio.preciosEspeciales[element.noPersonas] = {
                        precio_modificado: Array(daysWithDates.length).fill(habitacion.others.basePrice),
                        precio_base_2noches: Array(daysWithDates.length).fill(habitacion.others.basePrice2nights),
                        costo_base: Array(daysWithDates.length).fill(habitacion.others.baseCost),
                        costo_base_2noches: Array(daysWithDates.length).fill(habitacion.others.baseCost2nights)
                    };
                }
                let dayIndex = dayOfYear(new Date(currentTime)) - 1;
                habitacionesyprecio.preciosEspeciales[element.noPersonas].precio_modificado[dayIndex] = element.precio_modificado || habitacion.others.basePrice;
                habitacionesyprecio.preciosEspeciales[element.noPersonas].precio_base_2noches[dayIndex] = element.precio_base_2noches || habitacion.others.basePrice2nights;
                habitacionesyprecio.preciosEspeciales[element.noPersonas].costo_base[dayIndex] = element.costo_base || habitacion.others.baseCost;
                habitacionesyprecio.preciosEspeciales[element.noPersonas].costo_base_2noches[dayIndex] = element.costo_base_2noches || habitacion.others.baseCost2nights;
            }
        });

        habitacionesyprecio.precios.push(matrix);
        habitacionesyprecio.precios.push(matrix2n);
        habitacionesyprecio.precios.push(matrixc1);
        habitacionesyprecio.precios.push(matrixc2);
        matrixhabitaciones.push(habitacionesyprecio);
    });

    return matrixhabitaciones;
}


// INCOMING CHANGE
router.get('/calendario-precios', async (req, res) => {
    try {
        
        const url = `/api/habitaciones`; 

        // Obtener las habitaciones
        const response = await fetch(url);
        const data = await response.json();
        const habitaciones = data[0].resources;

        // Crear un arreglo con las fechas correspondientes a cada día del año
        const daysWithDates = Array.from({ length: getDaysInYear() }, (_, index) => getDateFromDayOfYear(index + 1));

        //console.log(habitaciones);

        const preciosHabitacionesData = await precioBaseController.consultarPrecios();
        //console.log(preciosHabitacionesData);
        const preciosEspecialesData = await preciosEspecialesController.consultarPrecios()

        const pricexday = pricexdaymatrix(daysWithDates,habitaciones,preciosHabitacionesData, preciosEspecialesData);



        res.render('calendarioPrecios', {
            habitaciones: habitaciones, // Pasa las habitaciones a la plantilla
            daysWithDates: daysWithDates, // Pasa el arreglo de fechas a la plantilla
            preciosHabitaciones: preciosHabitacionesData, // Pasa los precios de las habitaciones a la plantilla
            pricexday: pricexday
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error al obtener las habitaciones');
    }
})

router.get('/api/calendario-precios', precioBaseController.verificarExistenciaRegistro);
router.post('/api/calendario-precios', precioBaseController.agregarNuevoPrecio);
router.get('/api/calendario-precios/:id', precioBaseController.consultarPreciosPorId);
router.get('/api/consulta-fechas/', precioBaseController.consultarPreciosPorFecha);
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