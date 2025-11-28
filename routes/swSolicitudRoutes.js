const express = require('express');
const router = express.Router();
const swSolicitudController = require('../controllers/swSolicitudController');
const validationRequest = require('../common/middlewares/validation-request');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const upload = require('../config/multer');
const { 
    requireCuentaPropietario,
    requireCuentaParticipante
} = require('../common/middlewares/authPrivileges/authSW');

// Todas las rutas requieren autenticación
router.use(ensureAuthenticated);

/**
 * @route   POST /api/sw/solicitudes
 * @desc    Crear solicitud de transacción
 * @access  Participante de la cuenta (no propietario)
 */
router.post(
    '/solicitudes',
    swSolicitudController.createSolicitudValidators,
    validationRequest,
    swSolicitudController.createSolicitud
);

/**
 * @route   GET /api/sw/solicitudes/mis-solicitudes
 * @desc    Obtener solicitudes del usuario autenticado
 * @access  Participante de cualquier cuenta
 */
router.get(
    '/solicitudes/mis-solicitudes',
    swSolicitudController.getMisSolicitudes
);

/**
 * @route   GET /api/sw/solicitudes/cuenta/:cuentaId/pendientes
 * @desc    Obtener solicitudes pendientes de una cuenta
 * @access  Propietario de la cuenta
 */
router.get(
    '/solicitudes/cuenta/:cuentaId/pendientes',
    requireCuentaPropietario,
    swSolicitudController.getSolicitudesPendientes
);

/**
 * @route   GET /api/sw/solicitudes/cuenta/:cuentaId
 * @desc    Obtener todas las solicitudes de una cuenta
 * @access  Participante de la cuenta
 */
router.get(
    '/solicitudes/cuenta/:cuentaId',
    requireCuentaParticipante,
    swSolicitudController.getSolicitudes
);

/**
 * @route   GET /api/sw/solicitudes/:id
 * @desc    Obtener una solicitud por ID
 * @access  Participante de la cuenta
 */
router.get(
    '/solicitudes/:id',
    swSolicitudController.getSolicitudById
);

/**
 * @route   POST /api/sw/solicitudes/:id/procesar
 * @desc    Aprobar o rechazar una solicitud
 * @access  Propietario de la cuenta únicamente
 */
router.post(
    '/solicitudes/:id/procesar',
    upload.single('comprobanteConfirmacion'),
    swSolicitudController.procesarSolicitudValidators,
    validationRequest,
    swSolicitudController.procesarSolicitud
);

/**
 * @route   POST /api/sw/solicitudes/:id/cancelar
 * @desc    Cancelar una solicitud pendiente
 * @access  Solicitante únicamente
 */
router.post(
    '/solicitudes/:id/cancelar',
    swSolicitudController.cancelarSolicitud
);

/**
 * @route   PUT /api/sw/solicitudes/:id
 * @desc    Actualizar una solicitud pendiente
 * @access  Solicitante únicamente
 */
router.put(
    '/solicitudes/:id',
    swSolicitudController.updateSolicitud
);

/**
 * @route   GET /api/sw/solicitudes/cuenta/:cuentaId/estadisticas
 * @desc    Obtener estadísticas de solicitudes
 * @access  Propietario de la cuenta
 */
router.get(
    '/solicitudes/cuenta/:cuentaId/estadisticas',
    requireCuentaPropietario,
    swSolicitudController.getEstadisticasSolicitudes
);

/**
 * @route   POST /api/sw/solicitudes/:id/imagenes
 * @desc    Subir imágenes de comprobantes para una solicitud (máximo 3)
 * @access  Creador de la solicitud únicamente
 */
router.post(
    '/solicitudes/:id/imagenes',
    upload.array('imagenes', 3),
    swSolicitudController.uploadSolicitudImages
);

/**
 * @route   DELETE /api/sw/solicitudes/:id/imagenes/:imagenNombre
 * @desc    Eliminar una imagen específica de una solicitud
 * @access  Creador de la solicitud únicamente
 */
router.delete(
    '/solicitudes/:id/imagenes/:imagenNombre',
    swSolicitudController.deleteSolicitudImage
);

module.exports = router;

