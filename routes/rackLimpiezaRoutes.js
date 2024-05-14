const express = require('express');
const moment = require('moment');
const router = express.Router();
const rackLimpiezaController = require('../controllers/rackLimpiezaController');
const RackLimpieza = require('../models/RackLimpieza');


router.get('/rackLimpieza', async (req, res) => {
    try {
        console.log(req.session)
        const usuarioLogueado = req.session.userId;
        let services; // Declarar la variable fuera de los bloques if/else

        if (req.session.privilege === 'Limpieza'){
            services = await RackLimpieza.find({encargadoLimpieza: usuarioLogueado}).lean();
        } else {
            services = await RackLimpieza.find().lean();
        }

        // Procesar los servicios obtenidos
        services.forEach(service => {
            service._id = service._id.toString();
            service.id_reserva = service.id_reserva.toString();
            service.fecha = moment.utc(service.fecha).format('DD-MM-YYYY');
        });

        res.render('rackLimpieza', {
            services: services
        });

    } catch (error) {
        console.log(error.message);
        res.send({ error: error.message });
    }
});


router.get('/api/racklimpieza', rackLimpiezaController.getAllServices)
router.post('/api/racklimpieza', rackLimpiezaController.createService)
router.post('/api/racklimpieza/reservations', rackLimpiezaController.createServiceForReservation)
router.put('/api/racklimpieza/:id', rackLimpiezaController.modifyService);
router.delete('/api/racklimpieza/:id', rackLimpiezaController.deleteService);







module.exports = router;