const express = require('express');
const router = express.Router();

const Habitacion = require('../models/Habitacion');

router.get('/calendario-bloqueofechas', async (req, res) => {
    const habitaciones = await Habitacion.findOne().lean();
    if (!habitaciones) {
        return res.status(404).send('No rooms found');
    }

    const habitacionesMapeadas = habitaciones.resources.map(habitacion => {
        return {
            id: habitacion._id,
            nombre: habitacion.propertyDetails.name,
        }

    });

    // const restrictedDates = await getRestrictedDatesFromBackend(); // fetch restricted dates from backend
    const restrictedDates = [
        {

            month: 9, // January
            day: 15, // 1st day of the month
            year: 2024
        
          },
          {

            month: 9, // January
            day: 16, // 1st day of the month
            year: 2024
          },
    ]
    const monthsToShow = 24; // Show 2 years

    const months = [];


    for (let i = 0; i < monthsToShow; i++) {

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        const weekdays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

        const daysInMonth = getDaysInMonth(new Date(new Date().getFullYear() + Math.floor(i / 12), i % 12, 1));


        const monthData = {

            monthName: monthNames[i % 12],

            year: new Date().getFullYear() + Math.floor(i / 12),

            weekdays,

            days: [],

        };


        for (let day = 1; day <= daysInMonth; day++) {

            const isRestricted = restrictedDates.some(restriction => {

                return restriction.month === i % 12 && restriction.day === day && restriction.year === new Date().getFullYear() + Math.floor(i / 12);

            });

            monthData.days.push({ day, isRestricted });

        }


        months.push(monthData);

    }

    res.render('bloqueoFechas',
        {
            months: months
        }
    );
});

function getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

module.exports = router;