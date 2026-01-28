const express = require('express');
const router = express.Router();
const referidosController = require('../controllers/referidosController');
const validationRequest = require('../common/middlewares/validation-request');

// ============= RUTAS DE API - CUENTAS DE REFERIDOS =============

// Crear cuenta de referido (crea cuenta + cupón asociado)
router.post(
    '/api/referidos/cuentas',
    referidosController.crearCuentaReferidoValidators,
    validationRequest,
    referidosController.crearCuentaReferido
);

// Listar todas las cuentas de referidos
router.get('/api/referidos/cuentas', referidosController.listarCuentasReferidos);

// Obtener detalle de cuenta de referido
router.get('/api/referidos/cuentas/:id', referidosController.obtenerCuentaReferido);

// Actualizar cuenta de referido
router.put('/api/referidos/cuentas', referidosController.actualizarCuentaReferido);

// Toggle activo/inactivo de cuenta
router.patch('/api/referidos/cuentas/:id/toggle', referidosController.toggleActivoCuentaReferido);

// Obtener estadísticas generales de referidos
router.get('/api/referidos/estadisticas', referidosController.obtenerEstadisticasReferidos);

// Exportar cuentas de referidos a CSV
router.get('/api/referidos/exportar-csv', referidosController.exportarCuentasReferidosCSV);

module.exports = router;
