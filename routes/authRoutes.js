const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validationRequest = require('../common/middlewares/validation-request');

router.post("/auth/login", authController.validators, validationRequest, authController.login);
router.all("/auth/logout", authController.logout);

module.exports = router;