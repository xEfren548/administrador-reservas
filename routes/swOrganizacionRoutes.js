const express = require('express');
const router = express.Router();
const swOrganizacionController = require('../controllers/swOrganizacionController');
const validationRequest = require('../common/middlewares/validation-request');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const { 
    requireManageOrganizations,
    requireViewOrganizations 
} = require('../common/middlewares/authPrivileges/authSW');

// Todas las rutas requieren autenticación
router.use(ensureAuthenticated);

/**
 * @route   POST /api/sw/organizaciones
 * @desc    Crear nueva organización
 * @access  Permiso MANAGE_ORGANIZATIONS o MASTER ADMIN
 */
router.post(
    '/organizaciones',
    requireManageOrganizations,
    swOrganizacionController.createOrganizacionValidators,
    validationRequest,
    swOrganizacionController.createOrganizacion
);

/**
 * @route   GET /api/sw/organizaciones
 * @desc    Obtener todas las organizaciones
 * @access  Permiso VIEW_ORGANIZATIONS o MASTER ADMIN
 */
router.get(
    '/organizaciones',
    requireViewOrganizations,
    swOrganizacionController.getAllOrganizaciones
);

/**
 * @route   GET /api/sw/organizaciones/:id
 * @desc    Obtener una organización por ID
 * @access  Permiso VIEW_ORGANIZATIONS o MASTER ADMIN
 */
router.get(
    '/organizaciones/:id',
    requireViewOrganizations,
    swOrganizacionController.getOrganizacionById
);

/**
 * @route   PUT /api/sw/organizaciones/:id
 * @desc    Actualizar una organización
 * @access  Permiso MANAGE_ORGANIZATIONS o MASTER ADMIN
 */
router.put(
    '/organizaciones/:id',
    requireManageOrganizations,
    swOrganizacionController.updateOrganizacionValidators,
    validationRequest,
    swOrganizacionController.updateOrganizacion
);

/**
 * @route   DELETE /api/sw/organizaciones/:id
 * @desc    Desactivar una organización
 * @access  Permiso MANAGE_ORGANIZATIONS o MASTER ADMIN
 */
router.delete(
    '/organizaciones/:id',
    requireManageOrganizations,
    swOrganizacionController.deleteOrganizacion
);

/**
 * @route   GET /api/sw/organizaciones/:id/cuentas
 * @desc    Obtener cuentas de una organización
 * @access  Permiso VIEW_ORGANIZATIONS o MASTER ADMIN
 */
router.get(
    '/organizaciones/:id/cuentas',
    requireViewOrganizations,
    swOrganizacionController.getOrganizacionCuentas
);

/**
 * @route   POST /api/sw/organizaciones/:id/participantes
 * @desc    Agregar participante a una organización
 * @access  Administrador de la organización
 */
router.post(
    '/organizaciones/:id/participantes',
    swOrganizacionController.addParticipante
);

/**
 * @route   DELETE /api/sw/organizaciones/:id/participantes/:participanteId
 * @desc    Eliminar participante de una organización
 * @access  Administrador de la organización
 */
router.delete(
    '/organizaciones/:id/participantes/:participanteId',
    swOrganizacionController.removeParticipante
);

/**
 * @route   PUT /api/sw/organizaciones/:id/participantes/:participanteId/rol
 * @desc    Actualizar rol de un participante
 * @access  Administrador de la organización
 */
router.put(
    '/organizaciones/:id/participantes/:participanteId/rol',
    swOrganizacionController.updateParticipanteRole
);

module.exports = router;
