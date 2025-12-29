const express = require('express');
const router = express.Router();
const swCuentaController = require('../controllers/swCuentaController');
const validationRequest = require('../common/middlewares/validation-request');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const { 
    requireCuentaPropietario,
    requireCuentaAcceso,
    requireCreateAccounts,
    requireViewAccounts,
    requireEditAccounts,
    requireAddParticipants,
    requireRemoveParticipants
} = require('../common/middlewares/authPrivileges/authSW');

// Todas las rutas requieren autenticación
router.use(ensureAuthenticated);

/**
 * @route   POST /api/sw/cuentas
 * @desc    Crear nueva cuenta
 * @access  Permiso CREATE_ACCOUNTS o MASTER ADMIN
 */
router.post(
    '/cuentas',
    requireCreateAccounts,
    swCuentaController.createCuentaValidators,
    validationRequest,
    swCuentaController.createCuenta
);

/**
 * @route   GET /api/sw/cuentas/mis-cuentas
 * @desc    Obtener cuentas del usuario autenticado
 * @access  Permiso VIEW_ACCOUNTS o MASTER ADMIN
 */
router.get(
    '/cuentas/mis-cuentas',
    requireViewAccounts,
    swCuentaController.getMisCuentas
);

/**
 * @route   GET /api/sw/cuentas/para-solicitudes
 * @desc    Obtener todas las cuentas de organizaciones donde el usuario es participante (para crear solicitudes)
 * @access  Autenticado
 */
router.get(
    '/cuentas/para-solicitudes',
    swCuentaController.getCuentasParaSolicitudes
);

/**
 * @route   GET /api/sw/cuentas/validas-habitacion
 * @desc    Obtener cuentas válidas para ligar a habitaciones (con datos bancarios completos)
 * @access  Autenticado
 */
router.get(
    '/cuentas/validas-habitacion',
    swCuentaController.getCuentasValidasParaHabitacion
);

/**
 * @route   GET /api/sw/cuentas/:id
 * @desc    Obtener una cuenta por ID
 * @access  Permiso VIEW_ACCOUNTS o MASTER ADMIN + Participante de la cuenta
 */
router.get(
    '/cuentas/:id',
    requireViewAccounts,
    swCuentaController.getCuentaById
);

/**
 * @route   PUT /api/sw/cuentas/:id
 * @desc    Actualizar una cuenta
 * @access  Permiso EDIT_ACCOUNTS o MASTER ADMIN + Propietario de la cuenta
 */
router.put(
    '/cuentas/:id',
    requireEditAccounts,
    requireCuentaPropietario,
    swCuentaController.updateCuentaValidators,
    validationRequest,
    swCuentaController.updateCuenta
);

/**
 * @route   POST /api/sw/cuentas/:id/participantes
 * @desc    Agregar participante a una cuenta
 * @access  Permiso ADD_ACCOUNT_PARTICIPANTS o MASTER ADMIN + Propietario de la cuenta
 */
router.post(
    '/cuentas/:id/participantes',
    requireAddParticipants,
    requireCuentaPropietario,
    swCuentaController.addParticipanteValidators,
    validationRequest,
    swCuentaController.addParticipante
);

/**
 * @route   GET /api/sw/cuentas/:id/participantes
 * @desc    Obtener participantes de una cuenta
 * @access  Permiso VIEW_ACCOUNTS o MASTER ADMIN + Participante de la cuenta
 */
router.get(
    '/cuentas/:id/participantes',
    requireViewAccounts,
    requireCuentaAcceso,
    swCuentaController.getParticipantes
);

/**
 * @route   DELETE /api/sw/cuentas/:id/participantes/:usuarioId
 * @desc    Remover participante de una cuenta
 * @access  Permiso REMOVE_ACCOUNT_PARTICIPANTS o MASTER ADMIN + Propietario de la cuenta
 */
router.delete(
    '/cuentas/:id/participantes/:usuarioId',
    requireRemoveParticipants,
    requireCuentaPropietario,
    swCuentaController.removeParticipante
);

/**
 * @route   PUT /api/sw/cuentas/:id/participantes/:participanteId/permisos
 * @desc    Actualizar permisos de un participante
 * @access  Permiso EDIT_ACCOUNTS o MASTER ADMIN + Propietario de la cuenta
 */
router.put(
    '/cuentas/:id/participantes/:participanteId/permisos',
    requireEditAccounts,
    requireCuentaPropietario,
    swCuentaController.updateParticipantePermisos
);

/**
 * @route   POST /api/sw/cuentas/:id/recalcular-saldo
 * @desc    Recalcular saldo de una cuenta
 * @access  Permiso EDIT_ACCOUNTS o MASTER ADMIN + Propietario de la cuenta
 */
router.post(
    '/cuentas/:id/recalcular-saldo',
    requireEditAccounts,
    requireCuentaPropietario,
    swCuentaController.recalcularSaldo
);

module.exports = router;
