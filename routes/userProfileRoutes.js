const express = require('express');
const router = express.Router();
const userProfileController = require('../controllers/userProfileController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/', userProfileController.showUserProfile);
router.put('/editar-nombre', userProfileController.nameValidator, validationRequest, userProfileController.updateUserFullName);
router.put('/editar-nombre/:uuid', userProfileController.nameValidator, validationRequest, userProfileController.updateUserFullNameById);
router.put('/editar-email', userProfileController.emailValidator, validationRequest, userProfileController.updateUserEmail);
router.put('/editar-email/:uuid', userProfileController.emailValidator, validationRequest, userProfileController.updateUserEmailById);
router.put('/editar-contrasena', userProfileController.passwordValidator, validationRequest, userProfileController.updateUserPassword);
router.put('/editar-contrasena/:uuid', userProfileController.passwordValidator, validationRequest, userProfileController.updateUserPasswordById);

module.exports = router;