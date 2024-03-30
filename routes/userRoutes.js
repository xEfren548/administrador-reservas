const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.mostrarVistaUsuarios);
router.get('/mostrar-usuarios', userController.mostrarUsuarios);
router.get('/mostrar-usuario/:uuid', userController.obtenerUsuarioPorId);
router.put('/editar-usuario', userController.editarUsuario);
router.put('/editar-usuario/:uuid', userController.editarUsuarioPorId);
router.delete('/eliminar-usuario/:uuid', userController.eliminarUsuario);

module.exports = router;