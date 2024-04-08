const express = require('express');
const router = express.Router();
const userController = require('../controllers/usersController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/', userController.mostrarVistaUsuarios);
router.post('/crear-usuario', userController.createUserValidators, validationRequest, userController.createUser);
router.get('/mostrar-usuarios', userController.mostrarUsuarios);
router.get('/mostrar-usuario/:uuid', userController.obtenerUsuarioPorId);
router.put('/editar-usuario', userController.editUserValidators, validationRequest, userController.editarUsuario);
router.put('/editar-usuario/:uuid', userController.editUserValidators, validationRequest, userController.editarUsuarioPorId);
router.delete('/eliminar-usuario/:uuid', userController.eliminarUsuarioPorId);

module.exports = router;