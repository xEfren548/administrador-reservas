const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

// Controllers
const clientAuthController = require('../../controllers/webClientes/clientAuthController');

// Middlewares
const { 
    clientAuthMiddleware, 
    requireEmailVerification 
} = require('../../common/middlewares/clientAuthMiddleware');

// Validaciones
const accommodationIdValidation = [
    body('accommodationId')
        .notEmpty()
        .withMessage('ID de cabaña requerido')
        .isMongoId()
        .withMessage('ID de cabaña debe ser un ObjectId válido')
];

const accommodationIdParamValidation = [
    param('accommodationId')
        .notEmpty()
        .withMessage('ID de cabaña requerido')
        .isMongoId()
        .withMessage('ID de cabaña debe ser un ObjectId válido')
];

// Rutas de favoritos (todas requieren autenticación)

// POST /client/favorites/toggle - Toggle favorito (agregar/remover)
router.post('/toggle', 
    clientAuthMiddleware,
    accommodationIdValidation,
    clientAuthController.toggleFavoriteAccommodation
);

// POST /client/favorites - Agregar cabaña a favoritos
router.post('/', 
    clientAuthMiddleware,
    accommodationIdValidation,
    clientAuthController.addFavoriteAccommodation
);

// DELETE /client/favorites/:accommodationId - Remover cabaña de favoritos
router.delete('/:accommodationId', 
    clientAuthMiddleware,
    accommodationIdParamValidation,
    clientAuthController.removeFavoriteAccommodation
);

// GET /client/favorites - Obtener todas las cabañas favoritas
router.get('/', 
    clientAuthMiddleware,
    clientAuthController.getFavoriteAccommodations
);

// GET /client/favorites/check/:accommodationId - Verificar si una cabaña es favorita
router.get('/check/:accommodationId', 
    clientAuthMiddleware,
    accommodationIdParamValidation,
    clientAuthController.checkIsFavorite
);

// Middleware de manejo de errores específico para favoritos
router.use((err, req, res, next) => {
    console.error('Error en clientFavoritesRoutes:', err);
    
    // Error de validación
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Error de validación',
            errors: Object.values(err.errors).map(e => e.message)
        });
    }
    
    // Error genérico
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = router;