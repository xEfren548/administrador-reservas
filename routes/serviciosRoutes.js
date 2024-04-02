const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.get('/servicios', (req, res) => {
    res.render('serviciosAdicionales', {
        layout: 'services',
    })
})
router.post('/servicios/crear-servicio', serviceController.createService);
router.put('/servicios/editar-servicio', serviceController.editService);
router.put('/servicios/editar-servicio/:uuid', serviceController.editServiceById);
router.delete('/servicios/eliminar-servicio', serviceController.deleteService);
router.delete('/servicios/eliminar-servicio/:uuid', serviceController.deleteServiceById);

module.exports = router;