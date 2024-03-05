const express = require('express');
const router = express.Router();

const Evento = require('../models/Evento');
const eventController = require('../controllers/eventController');

// router.get('/eventos', async (req, res) => {
//     try {
//         const eventos = await Evento.find();
//         console.log(eventos)
//         res.send(eventos);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Error al obtener eventos' });
//     }
// });


// Rutas estáticas
router.get('/eventos', eventController.obtenerEventos);
router.post('/eventos', eventController.agregarEvento);
router.put('/eventos/:id', eventController.editarEvento);
router.put('/eventos/:id/modificar', eventController.modificarEvento);
router.delete('/eventos/:id', eventController.eliminarEvento);

// Rutas con contenido dinamico de handlebars

router.get('/eventos/:idevento', (req, res) => {
    const idevento = req.params.idevento;
    // Aquí podrías consultar la base de datos u otro almacenamiento para obtener los detalles del evento con el ID proporcionado
    // Después renderiza una página HTML que muestre los detalles del evento
    res.render('detalles_evento', { idevento });
});



module.exports = router;