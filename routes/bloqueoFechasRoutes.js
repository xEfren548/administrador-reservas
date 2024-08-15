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
            name: habitacion.propertyDetails.name,
        }

    });

    // const restrictedDates = await getRestrictedDatesFromBackend(); // fetch restricted dates from backend
    const restrictedDates = [
        {
            date: new Date('2024-12-01'),
            description: 'Min 2 pax',
            min: 2
        }
    ]
    

    res.render('bloqueoFechas', {
            chalets: habitacionesMapeadas
        }
    );
});


module.exports = router;