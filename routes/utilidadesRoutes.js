const express = require('express');
const router = express.Router();
const utilidadesController = require('../controllers/utilidadesController');

router.get('/utilidades', utilidadesController.calcularComisiones)
router.get('/mostrar-utilidades', utilidadesController.mostrarUtilidadesPorUsuario)
router.get('/mostrar-utilidades-json', utilidadesController.mostrarUtilidadesPorUsuarioJson)

router.get('/mostrar-utilidades-globales', utilidadesController.mostrarUtilidadesGlobales)
router.get('/mostrar-utilidades-globales-v2', utilidadesController.mostrarUtilidadesGlobalesV2)
router.get('/utilidades-globales-json', utilidadesController.obtenerUtilidadesGlobalesJson)
router.get('/utilidades-globales-excel', utilidadesController.exportarUtilidadesGlobalesExcel)
router.get('/reportes', utilidadesController.vistaParaReporte)

router.post('/utilidades', utilidadesController.altaComision);
router.post('/utilidades/reserva', utilidadesController.generarComisionReserva)
// router.post('/utilidades/servicios-adicionales', utilidadesController.generarComisionServiciosAdicionales)

router.put('/utilidades', utilidadesController.editarComision);

router.delete('/utilidades', utilidadesController.eliminarComision);

// Reportes personalizados

// Render Reporte Todo en Uno
router.get('/reportes-personalizados', utilidadesController.renderReporteTodoEnUno);
router.get('/reportes-comisiones-vendedor', utilidadesController.renderReporteComisionesVendedor);

// Generar Reporte Todo en Uno
router.get('/reportes/datos', utilidadesController.reporteTodoEnUno);
// Generar Reporte de Inversionistas
router.get('/reportes/inversionistas', utilidadesController.reporteDeInversionistas);
router.get('/reportes/comisiones-vendedor', utilidadesController.reporteComisionesVendedor);
router.get('/reportes/comisiones-vendedor/cuentas-ligadas', utilidadesController.obtenerCuentasLigadasComisiones);
router.put('/reportes/comisiones-vendedor/cuentas-ligadas/:usuarioId', utilidadesController.actualizarCuentaLigadaComisiones);
router.post('/reportes/comisiones-vendedor/solicitudes', utilidadesController.crearSolicitudComisionVendedor);


module.exports = router