const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/crear-encuesta', surveyController.showFormView);
router.post('/guardar-encuesta', surveyController.createFormValidators, validationRequest, surveyController.createFornm);
router.post('/modificar-encuesta', surveyController.updateFormValidators, validationRequest, surveyController.updateForm);

module.exports = router;
