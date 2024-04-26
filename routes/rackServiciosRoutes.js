const express = require('express');
const moment = require('moment');
const router = express.Router();
const rackServiciosController = require('../controllers/rackServiciosController');



router.get('/rackservicios', async (req, res) => {
    try {

        // const services = await rackServiciosController.getAllServicesMongo(req, res); // Pass req and res to the controller function
        // console.log(services)
        // services.forEach(service => {
        //     service._id = service._id.toString();
        //     service.id_reserva = service.id_reserva.toString();
        //     service.fecha = moment.utc(service.fecha).format('DD-MM-YYYY');
        // });

        res.render('rackServicios', {
            layout: 'layoutRackLimpieza',
            // services: services
        });

    } catch (error) {
        console.log(error.message);
        res.send({ error: error.message });
    }
});

// router.get('/api/racklimpieza', rackLimpiezaController.getAllServices)
// router.post('/api/racklimpieza', rackLimpiezaController.createService)
// router.put('/api/racklimpieza/:id', rackLimpiezaController.modifyService);
// router.delete('/api/racklimpieza/:id', rackLimpiezaController.deleteService);

module.exports = router;