const express = require('express');
const router = express.Router();
const instructionsController = require('../controllers/instructionsController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/instrucciones/:uuid', instructionsController.getViewValidators, validationRequest, instructionsController.showInstructionsView);

module.exports = router;