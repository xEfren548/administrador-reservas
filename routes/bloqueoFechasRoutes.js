const express = require('express');
const router = express.Router();

const Habitacion = require('../models/Habitacion');
const BloqueoFechas = require('../models/BloqueoFechas');
const bloqueoFechasController  = require('../controllers/bloqueoFechasController');

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

    res.render('bloqueoFechas', {
            chalets: habitacionesMapeadas
        }
    );
});

router.get('/api/calendario-bloqueofechas', bloqueoFechasController.obtenerFechasBloqueadas);
router.post('/api/calendario-bloqueofechas', bloqueoFechasController.crearFechaBloqueada)
router.delete('/api/calendario-bloqueofechas', bloqueoFechasController.eliminarFechaBloqueada);

module.exports = router;