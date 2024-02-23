const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// Ruta para agregar un nuevo evento
router.post('/eventos', eventController.agregarEvento);

module.exports = router;