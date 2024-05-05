const express = require('express');
const router = express.Router();
const costController = require('../controllers/costosController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/costos/mostrar-costos', costController.showCostsView);
router.post('/costos/crear-costo', costController.createCostValidators, validationRequest, costController.createCost);
router.put('/costos/editar-costo', costController.editCostValidators, validationRequest, costController.editCost);
router.delete('/costos/eliminar-costo', costController.deleteCostValidators, validationRequest, costController.deleteCost);

module.exports = router;
