const express = require('express');
const router = express.Router();
const rackLimpiezaController = require('../controllers/rackLimpiezaController');


router.get('/rackLimpieza', async(req, res) => {
    try {

        const services = await rackLimpiezaController.getAllServicesMongo(req, res); // Pass req and res to the controller function
        console.log(services)
        services.forEach(service => {
            service._id = service._id.toString();
            service.id_reserva = service.id_reserva.toString();
        });
        res.render('rackLimpieza', {
            services: services
        });

    } catch( error ) {
        console.log(error.message);
        res.send({error: error.message});
    }
});

router.get('/api/racklimpieza', rackLimpiezaController.getAllServices)
router.post('/api/racklimpieza', rackLimpiezaController.createService)







module.exports = router;