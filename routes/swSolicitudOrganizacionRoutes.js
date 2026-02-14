const express = require('express');
const router = express.Router();
const swSolicitudOrganizacionController = require('../controllers/swSolicitudOrganizacionController');
const validationRequest = require('../common/middlewares/validation-request');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const upload = require('../config/multer');

router.use(ensureAuthenticated);

router.post(
    '/solicitudes-organizacion',
    swSolicitudOrganizacionController.createSolicitudOrganizacionValidators,
    validationRequest,
    swSolicitudOrganizacionController.createSolicitudOrganizacion
);

router.get(
    '/solicitudes-organizacion/mis-solicitudes',
    swSolicitudOrganizacionController.getMisSolicitudesOrganizacion
);

router.get(
    '/solicitudes-organizacion/organizacion/:organizacionId/pendientes',
    swSolicitudOrganizacionController.getSolicitudesPendientesOrganizacion
);

router.get(
    '/solicitudes-organizacion/organizacion/:organizacionId/estadisticas',
    swSolicitudOrganizacionController.getEstadisticasSolicitudesOrganizacion
);

router.get(
    '/solicitudes-organizacion/organizacion/:organizacionId',
    swSolicitudOrganizacionController.getSolicitudesOrganizacion
);

router.get(
    '/solicitudes-organizacion/:id',
    swSolicitudOrganizacionController.getSolicitudOrganizacionById
);

router.post(
    '/solicitudes-organizacion/:id/procesar',
    swSolicitudOrganizacionController.procesarSolicitudOrganizacionValidators,
    validationRequest,
    swSolicitudOrganizacionController.procesarSolicitudOrganizacion
);

router.post(
    '/solicitudes-organizacion/:id/cancelar',
    swSolicitudOrganizacionController.cancelarSolicitudOrganizacion
);

router.post(
    '/solicitudes-organizacion/:id/imagenes',
    upload.array('imagenes', 3),
    swSolicitudOrganizacionController.uploadSolicitudOrganizacionImages
);

router.delete(
    '/solicitudes-organizacion/:id/imagenes/:imagenNombre',
    swSolicitudOrganizacionController.deleteSolicitudOrganizacionImage
);

module.exports = router;
