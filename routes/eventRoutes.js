const express = require('express');
const router = express.Router();

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

router.get('/eventos/:idevento', async (req, res) => {
    try {
        const idEvento = req.params.idevento;
        
        // Llama a la función del controlador de eventos para obtener los detalles del evento
        const evento = await eventController.obtenerEventoPorId(idEvento);
        eventoJson = JSON.stringify(evento);
        const eventoObjeto = JSON.parse(eventoJson);


        // Renderiza la página HTML con los detalles del evento
        console.log(eventoObjeto);
        res.render('detalles_evento', { evento: eventoObjeto });
    } catch (error) {
        console.error('Error al obtener los detalles del evento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});




module.exports = router;