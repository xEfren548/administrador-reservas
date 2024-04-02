const express = require('express');
const router = express.Router();
const userController = require('../controllers/authController');

router.post("/auth/login", userController.login);
router.post("/auth/logout", userController.logout);

module.exports = router;