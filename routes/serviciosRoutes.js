const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const validationRequest = require('../common/middlewares/validation-request');


router.get('/servicios', serviceController.mostrarServicios);
router.post('/servicios/crear-servicio', serviceController.createServiceValidators, validationRequest, serviceController.createService);
router.put('/servicios/editar-servicio', serviceController.editServiceValidators, validationRequest, serviceController.editService);
router.put('/servicios/editar-servicio/:uuid', serviceController.editServiceValidators, validationRequest, serviceController.editServiceById);
router.delete('/servicios/eliminar-servicio', serviceController.deleteServiceValidators, validationRequest, serviceController.deleteService);
router.delete('/servicios/eliminar-servicio/:uuid', serviceController.deleteServiceValidators, validationRequest, serviceController.deleteServiceById);

module.exports = router;