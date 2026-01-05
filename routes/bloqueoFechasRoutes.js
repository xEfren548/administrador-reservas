const express = require('express');
const router = express.Router();

const Habitacion = require('../models/Habitacion');
const BloqueoFechas = require('../models/BloqueoFechas');
const bloqueoFechasController  = require('../controllers/bloqueoFechasController');
const Roles = require("../models/Roles");

router.get('/calendario-bloqueofechas', async (req, res, next) => {
    const userRole = req.session.role;

    const userPermissions = await Roles.findById(userRole);
    if(!userPermissions){
        // throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        return next(new Error("El usuario no tiene un rol definido, contacte al administrador"));
    }

    const permittedRole = "VIEW_BLOCK_CALENDAR";
    if (!userPermissions.permissions.includes(permittedRole)) {
        // throw new Error("El usuario no tiene permiso para ver utilidades globales.");
        return next(new Error("El usuario no tiene permiso para ver este calendario."));
    }

    const habitaciones = await Habitacion.find().lean();
    if (!habitaciones) {
        return res.status(404).send('No rooms found');
    }

    const habitacionesMapeadas = habitaciones.map(habitacion => {
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
router.post('/api/calendario-bloqueofechas', bloqueoFechasController.crearFechaRestringida)
router.post('/api/calendario-bloqueorealfechas', bloqueoFechasController.crearFechaBloqueada)
router.post('/api/calendario-bloqueorango', bloqueoFechasController.crearBloqueosRango)
router.delete('/api/calendario-bloqueofechas', bloqueoFechasController.eliminarFechaBloqueada);

module.exports = router;