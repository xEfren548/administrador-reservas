const express = require('express');
const router = express.Router();

const Habitacion = require('../models/Habitacion');
const bloqueoInversionistasController  = require('../controllers/bloqueoInversionistasController');

router.get('/calendario-bloqueofechasinversionistas', async (req, res) => {
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

    res.render('bloqueoInversionistas', {
            chalets: habitacionesMapeadas
        }
    );
});

router.get('/api/calendario-bloqueofechasinversionistas', bloqueoInversionistasController.obtenerFechasBloqueadas);
router.post('/api/calendario-bloqueofechasinversionistas', bloqueoInversionistasController.crearFechaBloqueada)
router.delete('/api/calendario-bloqueofechasinversionistas', bloqueoInversionistasController.eliminarFechaBloqueada);

module.exports = router;