const express = require('express');
const router = express.Router();
const userProfileController = require('../controllers/userProfileController');

router.get('/', userProfileController.showUserProfile);
router.put('/editar-nombre', userProfileController.updateUserFullName);
router.put('/editar-nombre/:uuid', userProfileController.updateUserFullNameById);
router.put('/editar-email', userProfileController.updateUserEmail);
router.put('/editar-email/:uuid', userProfileController.updateUserEmailById);
router.put('/editar-contrasena', userProfileController.updateUserPassword);
router.put('/editar-contrasena/:uuid', userProfileController.updateUserPasswordById);

module.exports = router;