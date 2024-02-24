const express = require('express');
const router = express.Router();

const Evento = require('../models/Evento');
const eventController = require('../controllers/eventController');

router.get('/eventos', async (req, res) => {
    try {
        const eventos = await Evento.find();
        console.log(eventos)
        res.send(eventos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
});

// Ruta para agregar un nuevo evento
router.post('/eventos', eventController.agregarEvento);

module.exports = router;