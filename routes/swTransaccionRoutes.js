const express = require('express');
const router = express.Router();
const swTransaccionController = require('../controllers/swTransaccionController');
const validationRequest = require('../common/middlewares/validation-request');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const { 
    requireCuentaPropietario,
    requireCuentaAcceso,
    requireViewTransactions,
    requireExportTransactions
} = require('../common/middlewares/authPrivileges/authSW');

// Todas las rutas requieren autenticación
router.use(ensureAuthenticated);

/**
 * @route   POST /api/sw/transacciones
 * @desc    Crear transacción directa (solo propietario)
 * @access  Propietario de la cuenta únicamente
 */
router.post(
    '/transacciones',
    requireCuentaPropietario,
    swTransaccionController.createTransaccionValidators,
    validationRequest,
    swTransaccionController.createTransaccion
);

/**
 * @route   GET /api/sw/transacciones/cuenta/:cuentaId
 * @desc    Obtener transacciones de una cuenta
 * @access  Permiso VIEW_TRANSACTIONS o MASTER ADMIN + Participante de la cuenta
 */
router.get(
    '/transacciones/cuenta/:cuentaId',
    requireViewTransactions,
    swTransaccionController.getTransacciones
);

/**
 * @route   GET /api/sw/transacciones/:id
 * @desc    Obtener una transacción por ID
 * @access  Permiso VIEW_TRANSACTIONS o MASTER ADMIN + Participante de la cuenta
 */
router.get(
    '/transacciones/:id',
    requireViewTransactions,
    swTransaccionController.getTransaccionById
);

/**
 * @route   PUT /api/sw/transacciones/:id/notas
 * @desc    Actualizar notas/etiquetas de una transacción
 * @access  Propietario de la cuenta únicamente
 */
router.put(
    '/transacciones/:id/notas',
    requireCuentaPropietario,
    swTransaccionController.updateTransaccionNotas
);

/**
 * @route   DELETE /api/sw/transacciones/:id
 * @desc    Eliminar transacción (solo si no está aprobada)
 * @access  Propietario de la cuenta únicamente
 */
router.delete(
    '/transacciones/:id',
    requireCuentaPropietario,
    swTransaccionController.deleteTransaccion
);

/**
 * @route   GET /api/sw/transacciones/cuenta/:cuentaId/resumen
 * @desc    Obtener resumen/estadísticas de una cuenta
 * @access  Permiso VIEW_TRANSACTIONS o MASTER ADMIN + Participante de la cuenta
 */
router.get(
    '/transacciones/cuenta/:cuentaId/resumen',
    requireViewTransactions,
    swTransaccionController.getResumen
);

/**
 * @route   GET /api/sw/transacciones/cuenta/:cuentaId/por-categoria
 * @desc    Obtener transacciones agrupadas por categoría
 * @access  Permiso VIEW_TRANSACTIONS o MASTER ADMIN + Participante de la cuenta
 */
router.get(
    '/transacciones/cuenta/:cuentaId/por-categoria',
    requireViewTransactions,
    swTransaccionController.getPorCategoria
);

/**
 * @route   GET /api/sw/transacciones/cuenta/:cuentaId/exportar-csv
 * @desc    Exportar transacciones a CSV
 * @access  Permiso EXPORT_TRANSACTIONS o MASTER ADMIN + Participante de la cuenta
 */
router.get(
    '/transacciones/cuenta/:cuentaId/exportar-csv',
    requireExportTransactions,
    swTransaccionController.exportarCSV
);

module.exports = router;

