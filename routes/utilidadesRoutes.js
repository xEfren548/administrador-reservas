const express = require('express');
const router = express.Router();
const utilidadesController = require('../controllers/utilidadesController');

router.get('/utilidades', utilidadesController.calcularComisiones)
router.get('/mostrar-utilidades', utilidadesController.mostrarUtilidadesPorUsuario)
router.get('/mostrar-utilidades-globales', utilidadesController.mostrarUtilidadesGlobales)
router.get('/reportes', utilidadesController.vistaParaReporte)

router.post('/utilidades', utilidadesController.altaComision);
router.post('/utilidades/reserva', utilidadesController.generarComisionReserva)
// router.post('/utilidades/servicios-adicionales', utilidadesController.generarComisionServiciosAdicionales)

router.put('/utilidades', utilidadesController.editarComision);

router.delete('/utilidades', utilidadesController.eliminarComision);


module.exports = router