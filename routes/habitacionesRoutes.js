const express = require('express');
const router = express.Router();

const habitacionController = require('../controllers/habitacionController');

// Rutas para agregar un nuevo evento
router.get('/habitaciones', habitacionController.obtenerHabitaciones);
router.get('/habitaciones/:id', habitacionController.obtenerHabitacionPorIdRoute);
router.post('/habitaciones', habitacionController.agregarHabitacion);
router.put('/habitaciones/:id', habitacionController.editarHabitacion);
router.delete('/habitaciones/:id', habitacionController.eliminarHabitacion);

module.exports = router;