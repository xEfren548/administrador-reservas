const express = require('express');
const router = express.Router();
const Roles = require('../models/Roles');

const Habitacion = require('../models/Habitacion');
const bloqueoInversionistasController  = require('../controllers/bloqueoInversionistasController');

router.get('/calendario-bloqueofechasinversionistas', async (req, res, next) => {
    const userRole = req.session.role;

    const userPermissions = await Roles.findById(userRole);
    if(!userPermissions){
        // throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        return next(new Error("El usuario no tiene un rol definido, contacte al administrador"));
    }

    const permittedRole = "VIEW_INVESTORS_CALENDAR";
    if (!userPermissions.permissions.includes(permittedRole)) {
        // throw new Error("El usuario no tiene permiso para ver utilidades globales.");
        return next(new Error("El usuario no tiene permiso para ver este calendario."));
    }

    const habitaciones = await Habitacion.find().lean().sort({ 'propertyDetails.name': 1 });
    if (!habitaciones) {
        return res.status(404).send('No rooms found');
    }

    const habitacionesMapeadas = habitaciones.map(habitacion => {
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