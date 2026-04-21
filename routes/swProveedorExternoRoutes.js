const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const validationRequest = require('../common/middlewares/validation-request');
const swProveedorExternoController = require('../controllers/swProveedorExternoController');

router.use(ensureAuthenticated);

router.get(
    '/proveedores-externos/organizacion/:organizacionId',
    swProveedorExternoController.listProveedoresExternos
);

router.post(
    '/proveedores-externos',
    swProveedorExternoController.createProveedorExternoValidators,
    validationRequest,
    swProveedorExternoController.createProveedorExterno
);

router.put(
    '/proveedores-externos/:id',
    swProveedorExternoController.updateProveedorExternoValidators,
    validationRequest,
    swProveedorExternoController.updateProveedorExterno
);

router.delete(
    '/proveedores-externos/:id',
    swProveedorExternoController.deleteProveedorExterno
);

module.exports = router;