const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/swDashboardController');

// Middleware de autenticación (asumiendo que ya existe)
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado'
        });
    }
    next();
};

// Estadísticas de una organización
router.get('/organizacion/:organizacionId', requireAuth, dashboardController.getEstadisticasOrganizacion);

// Estadísticas personales del usuario
router.get('/personal', requireAuth, dashboardController.getEstadisticasPersonales);

module.exports = router;
