const express = require('express');
const moment = require('moment');
const router = express.Router();
const rackServiciosController = require('../controllers/rackServiciosController');



router.get('/rackservicios', async (req, res) => {
    try {

        const services = await rackServiciosController.getAllRackServicesMongo(req, res); // Pass req and res to the controller function
        console.log(services)
        services.forEach(service => {
            service._id = service._id.toString();
            service.id_reserva = service.id_reserva.toString();
            service.fecha = moment.utc(service.fecha).format('DD-MM-YYYY');
        });

        services.sort((a, b) => {
            if (a.status === "Pendiente" && b.status !== "Pendiente") return -1;
            if (a.status !== "Pendiente" && b.status === "Pendiente") return 1;
            return moment(b.fecha, 'DD-MM-YYYY') - moment(a.fecha, 'DD-MM-YYYY');
        });



        res.render('rackServicios', {
            services: services
        });

    } catch (error) {
        console.log(error.message);
        res.send({ error: error.message });
    }
});

router.get('/api/rackservicios', rackServiciosController.getAllRackServices)
router.post('/api/rackservicios', rackServiciosController.createRackService)
router.put('/api/rackservicios/:id', rackServiciosController.modifyRackService);
router.delete('/api/rackservicios/:id', rackServiciosController.deleteRackService);

module.exports = router;