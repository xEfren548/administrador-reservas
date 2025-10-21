const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Controllers
const clientAuthController = require('../../controllers/webClientes/clientAuthController');

// Middlewares
const { 
    clientAuthMiddleware, 
    requireEmailVerification,
    optionalClientAuth 
} = require('../../common/middlewares/clientAuthMiddleware');

// Validaciones
const registerValidation = [
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 50 })
        .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    
    body('lastName')
        .trim()
        .notEmpty()
        .withMessage('El apellido es requerido')
        .isLength({ min: 2, max: 50 })
        .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
    
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail(),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
    
    body('phone')
        .optional()
        .isMobilePhone('es-MX')
        .withMessage('Número de teléfono inválido')
];

const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail(),
    
    body('password')
        .notEmpty()
        .withMessage('La contraseña es requerida')
];

const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail()
];

const resetPasswordValidation = [
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número')
];

const resendVerificationValidation = [
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .normalizeEmail()
];

// Rutas públicas de autenticación

// POST /client/auth/register - Registro con email y password
router.post('/register', registerValidation, clientAuthController.register);

// POST /client/auth/login - Login con email y password
router.post('/login', loginValidation, clientAuthController.login);

// Google OAuth routes (preparados para futuro)
// GET /client/auth/google - Iniciar autenticación con Google (no disponible)
router.get('/google', clientAuthController.googleAuth);

// GET /client/auth/google/callback - Callback de Google OAuth (no disponible)
router.get('/google/callback', clientAuthController.googleCallback);

// Verificación de email
// GET /client/auth/verify-email/:token - Verificar email con token
router.get('/verify-email/:token', clientAuthController.verifyEmail);

// POST /client/auth/resend-verification - Reenviar email de verificación
router.post('/resend-verification', 
    resendVerificationValidation, 
    clientAuthController.resendVerificationEmail
);

// Reset de password
// POST /client/auth/forgot-password - Solicitar reset de password
router.post('/forgot-password', 
    forgotPasswordValidation, 
    clientAuthController.forgotPassword
);

// POST /client/auth/reset-password/:token - Resetear password con token
router.post('/reset-password/:token', 
    resetPasswordValidation, 
    clientAuthController.resetPassword
);

// Rutas protegidas (requieren autenticación)

// GET /client/auth/profile - Obtener perfil del cliente autenticado
router.get('/profile', 
    clientAuthMiddleware, 
    clientAuthController.getProfile
);

// GET /client/auth/check - Verificar estado de autenticación
router.get('/check', 
    clientAuthMiddleware, 
    clientAuthController.checkAuth
);

// POST /client/auth/logout - Logout
router.post('/logout', 
    clientAuthMiddleware, 
    clientAuthController.logout
);

// PUT /client/auth/profile - Actualizar perfil del usuario web
router.put('/profile',
    clientAuthMiddleware,
    [
        body('firstName').optional().isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres'),
        body('lastName').optional().isLength({ min: 2, max: 50 }).withMessage('El apellido debe tener entre 2 y 50 caracteres'),
        body('phone').optional().isMobilePhone('es-MX').withMessage('Número de teléfono inválido')
    ],
    clientAuthController.updateProfile
);

// PUT /client/auth/preferences - Actualizar preferencias del usuario web
router.put('/preferences',
    clientAuthMiddleware,
    [
        body('preferences').isObject().withMessage('Las preferencias deben ser un objeto'),
        body('preferences.newsletter').optional().isBoolean(),
        body('preferences.notifications.email').optional().isBoolean(),
        body('preferences.notifications.sms').optional().isBoolean()
    ],
    clientAuthController.updatePreferences
);

// Rutas de utilidad

// GET /client/auth/me - Información del usuario (opcional auth)
router.get('/me', optionalClientAuth, (req, res) => {
    if (req.client) {
        res.json({
            success: true,
            data: {
                client: req.client.toPublicJSON(),
                isAuthenticated: true
            }
        });
    } else {
        res.json({
            success: true,
            data: {
                client: null,
                isAuthenticated: false
            }
        });
    }
});

// GET /client/auth/status - Estado de la sesión
router.get('/status', optionalClientAuth, (req, res) => {
    res.json({
        success: true,
        data: {
            isAuthenticated: !!req.client,
            client: req.client ? {
                id: req.client._id,
                email: req.client.email,
                isEmailVerified: req.client.isEmailVerified,
                registrationMethod: req.client.registrationMethod
            } : null
        }
    });
});

// GET /client/auth/get-my-reservations

router.get('/get-my-reservations', clientAuthMiddleware, clientAuthController.getReservationsForClient);


// Middleware de manejo de errores específico para auth
router.use((err, req, res, next) => {
    console.error('Error en clientAuthRoutes:', err);
    
    // Error de validación de Passport
    if (err.name === 'AuthenticationError') {
        return res.status(401).json({
            success: false,
            message: 'Error de autenticación con Google'
        });
    }
    
    // Error de OAuth
    if (err.message && err.message.includes('oauth')) {
        return res.status(400).json({
            success: false,
            message: 'Error en el proceso de autenticación OAuth'
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