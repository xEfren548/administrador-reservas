const express = require('express');
const router = express.Router();
const swPagoDiferidoController = require('../controllers/swPagoDiferidoController');
const validationRequest = require('../common/middlewares/validation-request');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(ensureAuthenticated);

/**
 * @route   POST /api/sw/pagos-diferidos
 * @desc    Crear pago diferido
 * @access  Propietario o participante con permisos
 */
router.post(
    '/pagos-diferidos',
    swPagoDiferidoController.createPagoDiferidoValidators,
    validationRequest,
    swPagoDiferidoController.createPagoDiferido
);

/**
 * @route   GET /api/sw/pagos-diferidos
 * @desc    Obtener todos los pagos diferidos del usuario
 * @access  Usuario autenticado
 */
router.get(
    '/pagos-diferidos',
    swPagoDiferidoController.getAllPagosDiferidos
);

/**
 * @route   GET /api/sw/pagos-diferidos/:id
 * @desc    Obtener pago diferido por ID
 * @access  Propietario o participante de la cuenta
 */
router.get(
    '/pagos-diferidos/:id',
    swPagoDiferidoController.getPagoDiferidoById
);

/**
 * @route   POST /api/sw/pagos-diferidos/:id/cuotas/:cuotaNumero/pagar
 * @desc    Pagar una cuota específica
 * @access  Propietario o participante con permisos
 */
router.post(
    '/pagos-diferidos/:id/cuotas/:cuotaNumero/pagar',
    swPagoDiferidoController.pagarCuota
);

/**
 * @route   POST /api/sw/pagos-diferidos/:id/cancelar
 * @desc    Cancelar pago diferido
 * @access  Propietario o creador
 */
router.post(
    '/pagos-diferidos/:id/cancelar',
    swPagoDiferidoController.cancelarPagoDiferido
);

module.exports = router;
