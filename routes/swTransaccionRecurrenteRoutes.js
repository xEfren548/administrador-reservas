const express = require('express');
const router = express.Router();
const swTransaccionRecurrenteController = require('../controllers/swTransaccionRecurrenteController');
const validationRequest = require('../common/middlewares/validation-request');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(ensureAuthenticated);

/**
 * @route   POST /api/sw/recurrentes
 * @desc    Crear transacción recurrente
 * @access  Propietario o participante con permisos
 */
router.post(
    '/recurrentes',
    swTransaccionRecurrenteController.createRecurrenteValidators,
    validationRequest,
    swTransaccionRecurrenteController.createRecurrente
);

/**
 * @route   GET /api/sw/recurrentes
 * @desc    Obtener todas las transacciones recurrentes del usuario
 * @access  Usuario autenticado
 */
router.get(
    '/recurrentes',
    swTransaccionRecurrenteController.getAllRecurrentes
);

/**
 * @route   GET /api/sw/recurrentes/:id
 * @desc    Obtener transacción recurrente por ID
 * @access  Propietario o participante de la cuenta
 */
router.get(
    '/recurrentes/:id',
    swTransaccionRecurrenteController.getRecurrenteById
);

/**
 * @route   PUT /api/sw/recurrentes/:id
 * @desc    Actualizar transacción recurrente
 * @access  Propietario o participante con permisos
 */
router.put(
    '/recurrentes/:id',
    swTransaccionRecurrenteController.updateRecurrente
);

/**
 * @route   DELETE /api/sw/recurrentes/:id
 * @desc    Eliminar transacción recurrente
 * @access  Propietario o creador
 */
router.delete(
    '/recurrentes/:id',
    swTransaccionRecurrenteController.deleteRecurrente
);

/**
 * @route   POST /api/sw/recurrentes/:id/ejecutar
 * @desc    Ejecutar manualmente una transacción recurrente
 * @access  Propietario o participante con permisos
 */
router.post(
    '/recurrentes/:id/ejecutar',
    swTransaccionRecurrenteController.ejecutarManual
);

module.exports = router;
