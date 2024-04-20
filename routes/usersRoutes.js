const express = require('express');
const router = express.Router();
const userController = require('../controllers/usersController');
//const validationRequest = require('../common/middlewares/validation-request');

router.get('/', userController.showUsersView);
router.post('/crear-usuario', userController.createUser);
router.get('/mostrar-usuario/:uuid', userController.obtenerUsuarioPorId);
router.put('/editar-usuario', userController.editarUsuario);
router.put('/editar-usuario/:uuid', userController.editarUsuarioPorId);
router.delete('/eliminar-usuario/', userController.deleteUser);
router.delete('/eliminar-usuario/:uuid', userController.eliminarUsuarioPorId);

module.exports = router;