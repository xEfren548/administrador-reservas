const express = require('express');
const router = express.Router();
const surveyProcessingController = require('../controllers/surveyProcessingController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/responder-encuesta', surveyProcessingController.showSurveyValidators, validationRequest, surveyProcessingController.showSurvey);
router.post('/enviar-respuestas', surveyProcessingController.answerSurveyValidators, validationRequest, surveyProcessingController.answerSurvey);
router.get('/mostrar-respuestas-usuario/:id', surveyProcessingController.showClientResponsesValidator, validationRequest, surveyProcessingController.showClientResponses);
router.get('/mostrar-respuestas-usuarios', surveyProcessingController.showClientsResponsesValidator, validationRequest, surveyProcessingController.showClientsResponses);

module.exports = router;
