const express = require('express');
const router = express.Router();
const utilidadesController = require('../controllers/utilidadesController');

router.get('/utilidades', utilidadesController.calcularComisiones)
router.get('/mostrar-utilidades', utilidadesController.mostrarUtilidadesPorUsuario)
router.post('/utilidades', utilidadesController.altaComision);
router.put('/utilidades', utilidadesController.editarComision);
router.delete('/utilidades', utilidadesController.eliminarComision);


module.exports = router