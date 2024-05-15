const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/', reservationController.showReservationsViewValidators, validationRequest, reservationController.showReservationsView);

module.exports = router;