const express = require('express');
const router = express.Router();
const cuponesController = require('../controllers/cuponesController');
const validationRequest = require('../common/middlewares/validation-request');

// ============= RUTAS DE VISTAS =============

// Dashboard de cupones
router.get('/cupones/dashboard', cuponesController.mostrarDashboardCupones);

// ============= RUTAS DE API =============

// Crear cupón
router.post(
    '/api/cupones',
    cuponesController.crearCuponValidators,
    validationRequest,
    cuponesController.crearCupon
);

// Listar cupones con filtros
router.get('/api/cupones', cuponesController.listarCupones);

// Obtener datos del dashboard
router.get('/api/cupones/dashboard/datos', cuponesController.obtenerDatosDashboard);

// Exportar cupones a CSV
router.get('/api/cupones/exportar-csv', cuponesController.exportarCuponesCSV);

// Exportar usos de cupones a CSV
router.get('/api/cupones/usos/exportar-csv', cuponesController.exportarUsosCuponesCSV);

// Validar cupón (para aplicarlo en reserva)
router.post(
    '/api/cupones/validar',
    cuponesController.validarCuponValidators,
    validationRequest,
    cuponesController.validarCupon
);

// Obtener cupón por ID
router.get('/api/cupones/:id', cuponesController.obtenerCupon);

// Obtener estadísticas de un cupón
router.get('/api/cupones/:id/estadisticas', cuponesController.obtenerEstadisticasCupon);

// Editar cupón
router.put(
    '/api/cupones',
    cuponesController.editarCuponValidators,
    validationRequest,
    cuponesController.editarCupon
);

// Activar/desactivar cupón
router.patch('/api/cupones/:id/toggle', cuponesController.toggleActivoCupon);

// Eliminar cupón (soft delete)
router.delete(
    '/api/cupones',
    cuponesController.eliminarCuponValidators,
    validationRequest,
    cuponesController.eliminarCupon
);

module.exports = router;
