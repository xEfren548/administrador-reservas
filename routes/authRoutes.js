const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post("/auth/login", /*authController.validators,*/ authController.login);
router.all("/auth/logout", authController.logout);

module.exports = router;