const express = require('express');
const router = express.Router();
const instructionsController = require('../controllers/instructionsController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/instrucciones/:uuid', instructionsController.getViewValidators, validationRequest, instructionsController.showInstructionsView);
router.get('/instrucciones/:uuid/are-terms-accepted', instructionsController.areTermsAcceptedValidators, validationRequest, instructionsController.areTermsAccepted);
router.post('/instrucciones/:uuid/accept-terms', instructionsController.acceptTermsAndConditionsValidators, validationRequest, instructionsController.acceptTermsAndConditions);
router.post('/instrucciones/realizarcheckin', instructionsController.realizarCheckIn)

module.exports = router;