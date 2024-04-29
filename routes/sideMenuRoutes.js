const express = require('express');
const router = express.Router();
const sideMenuController = require('../controllers/sideMenuController');
const validationRequest = require('../common/middlewares/validation-request');

router.get("/sidemenu", sideMenuController.validators, validationRequest, sideMenuController.generateSideMenu);

module.exports = router;