const jwt = require('jsonwebtoken');
const ClienteWeb = require('../../models/ClienteWeb');

const clientAuthMiddleware = async (req, res, next) => {
    try {
        // Obtener el token del header Authorization
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Token de acceso requerido'
            });
        }

        // Verificar formato del header (Bearer token)
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                success: false,
                message: 'Formato de token inválido. Use: Bearer <token>'
            });
        }

        const token = parts[1];

        // Verificar y decodificar el JWT
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_CLIENT_SECRET || 'client-secret-key');
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token expirado',
                    code: 'TOKEN_EXPIRED'
                });
            } else if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token inválido',
                    code: 'INVALID_TOKEN'
                });
            } else {
                return res.status(401).json({
                    success: false,
                    message: 'Error al verificar token'
                });
            }
        }

        // Verificar que sea un token de cliente
        if (decoded.type !== 'client') {
            return res.status(401).json({
                success: false,
                message: 'Tipo de token inválido'
            });
        }

        // Buscar el cliente en la base de datos
        const client = await ClienteWeb.findById(decoded.clienteId);
        
        if (!client) {
            return res.status(401).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        // Verificar que la cuenta esté activa
        if (!client.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Cuenta desactivada'
            });
        }

        // Agregar el cliente al request para uso en controladores
        req.client = client;
        req.clientId = client._id;

        next();

    } catch (error) {
        console.error('Error en clientAuthMiddleware:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Middleware opcional para verificar email
const requireEmailVerification = (req, res, next) => {
    try {
        const client = req.client;

        if (!client.isEmailVerified) {
            return res.status(403).json({
                success: false,
                message: 'Email no verificado. Por favor verifica tu email antes de continuar.',
                code: 'EMAIL_NOT_VERIFIED',
                data: {
                    email: client.email,
                    requiresVerification: true
                }
            });
        }

        next();

    } catch (error) {
        console.error('Error en requireEmailVerification:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Middleware para verificar que el cliente puede hacer ciertas acciones
const requireCompleteProfile = (req, res, next) => {
    try {
        const client = req.client;

        // Verificar que tenga información básica completa
        if (!client.firstName || !client.lastName || !client.email) {
            return res.status(403).json({
                success: false,
                message: 'Perfil incompleto. Por favor completa tu información.',
                code: 'INCOMPLETE_PROFILE',
                data: {
                    missingFields: {
                        firstName: !client.firstName,
                        lastName: !client.lastName,
                        email: !client.email
                    }
                }
            });
        }

        next();

    } catch (error) {
        console.error('Error en requireCompleteProfile:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Middleware opcional que verifica autenticación pero no falla si no hay token
const optionalClientAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            req.client = null;
            req.clientId = null;
            return next();
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            req.client = null;
            req.clientId = null;
            return next();
        }

        const token = parts[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_CLIENT_SECRET || 'client-secret-key');
            
            if (decoded.type === 'client') {
                const client = await ClienteWeb.findById(decoded.clienteId);
                if (client && client.isActive) {
                    req.client = client;
                    req.clientId = client._id;
                }
            }
        } catch (jwtError) {
            // En caso de error, simplemente no autenticar
            req.client = null;
            req.clientId = null;
        }

        next();

    } catch (error) {
        console.error('Error en optionalClientAuth:', error);
        req.client = null;
        req.clientId = null;
        next();
    }
};

// Middleware para refrescar último login
const updateLastLogin = async (req, res, next) => {
    try {
        if (req.client) {
            // Solo actualizar si ha pasado más de 5 minutos desde el último login
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            if (!req.client.lastLogin || req.client.lastLogin < fiveMinutesAgo) {
                req.client.lastLogin = new Date();
                await req.client.save();
            }
        }
        
        next();

    } catch (error) {
        console.error('Error en updateLastLogin:', error);
        // No fallar si hay error actualizando, solo continuar
        next();
    }
};

module.exports = {
    clientAuthMiddleware,
    requireEmailVerification,
    requireCompleteProfile,
    optionalClientAuth,
    updateLastLogin
};