const express = require('express');
const router = express.Router();

const Habitacion = require('../models/Habitacion');
const habitacionController = require('../controllers/habitacionController');

router.get('/habitaciones', async (req, res) => {
    try {
        const habitaciones = await Habitacion.find();
        res.send(habitaciones);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
});

// Ruta para agregar un nuevo evento
router.post('/habitaciones', habitacionController.agregarHabitacion);

module.exports = router;