const express = require('express');
const router = express.Router();
const surveyModelingController = require('../controllers/surveyModelingController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/crear-encuesta', surveyModelingController.showFormModellingView);
router.post('/guardar-encuesta', surveyModelingController.createFormValidators, validationRequest, surveyModelingController.createFornm);
router.post('/modificar-encuesta', surveyModelingController.updateFormValidators, validationRequest, surveyModelingController.updateForm);

module.exports = router;
