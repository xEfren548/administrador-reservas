const express = require('express');
const router = express.Router();
const userController = require('../controllers/authController');

router.post("/logIn-usuario", userController.logIn);
router.post('/crear-usuario', userController.createUser);

module.exports = router;