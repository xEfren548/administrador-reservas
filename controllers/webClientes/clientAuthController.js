const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ClienteWeb = require('../../models/ClienteWeb');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

// Función para generar JWT
const generateToken = (clienteId) => {
    return jwt.sign(
        { clienteId, type: 'client' },
        process.env.JWT_CLIENT_SECRET || 'client-secret-key',
        { expiresIn: '7d' }
    );
};

// Función para generar token de verificación
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Registro con email y password
const register = async (req, res) => {
    try {
        // Validar datos de entrada
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de registro inválidos',
                errors: errors.array()
            });
        }

        const { firstName, lastName, email, password, phone } = req.body;

        // Verificar si el email ya existe
        const existingClient = await ClienteWeb.findOne({ email: email.toLowerCase() });
        if (existingClient) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una cuenta con este email'
            });
        }

        // Generar token de verificación
        const verificationToken = generateVerificationToken();

        // Crear nuevo cliente
        const newClient = new ClienteWeb({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password,
            phone,
            registrationMethod: 'email',
            emailVerificationToken: verificationToken,
            isEmailVerified: false
        });

        await newClient.save();

        // Generar JWT
        const token = generateToken(newClient._id);

        // TODO: Enviar email de verificación
        // await sendVerificationEmail(newClient.email, verificationToken);

        res.status(201).json({
            success: true,
            message: 'Cuenta creada exitosamente. Revisa tu email para verificar tu cuenta.',
            data: {
                client: newClient.toPublicJSON(),
                token,
                requiresEmailVerification: true
            }
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Login con email y password
const login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de login inválidos',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Buscar cliente por email
        const client = await ClienteWeb.findOne({ 
            email: email.toLowerCase(),
            isActive: true 
        });

        if (!client) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Verificar si tiene password (podría ser cuenta OAuth)
        if (!client.hasPassword()) {
            return res.status(401).json({
                success: false,
                message: 'Esta cuenta fue creada con Google. Por favor inicia sesión con Google.'
            });
        }

        // Verificar password
        const isPasswordValid = await client.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Actualizar último login
        client.lastLogin = new Date();
        await client.save();

        // Generar JWT
        const token = generateToken(client._id);

        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                client: client.toPublicJSON(),
                token
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Iniciar autenticación con Google
const googleAuth = (req, res) => {
    // Esta función será manejada por passport
    res.redirect('/client/auth/google');
};

// Callback de Google OAuth
const googleCallback = async (req, res) => {
    try {
        // El usuario viene de passport
        const client = req.user;
        
        // Actualizar último login
        client.lastLogin = new Date();
        await client.save();

        // Generar JWT
        const token = generateToken(client._id);

        // Redirigir al frontend con el token
        res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}&success=true`);

    } catch (error) {
        console.error('Error en Google callback:', error);
        res.redirect(`${process.env.CLIENT_URL}/auth/callback?error=auth_failed`);
    }
};

// Verificar email
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const client = await ClienteWeb.findOne({
            emailVerificationToken: token,
            isActive: true
        });

        if (!client) {
            return res.status(400).json({
                success: false,
                message: 'Token de verificación inválido o expirado'
            });
        }

        // Marcar email como verificado
        client.isEmailVerified = true;
        client.emailVerificationToken = undefined;
        await client.save();

        res.json({
            success: true,
            message: 'Email verificado exitosamente',
            data: {
                client: client.toPublicJSON()
            }
        });

    } catch (error) {
        console.error('Error en verificación de email:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Reenviar email de verificación
const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        const client = await ClienteWeb.findOne({ 
            email: email.toLowerCase(),
            isActive: true 
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró una cuenta con este email'
            });
        }

        if (client.isEmailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Este email ya está verificado'
            });
        }

        // Generar nuevo token
        const verificationToken = generateVerificationToken();
        client.emailVerificationToken = verificationToken;
        await client.save();

        // TODO: Enviar email de verificación
        // await sendVerificationEmail(client.email, verificationToken);

        res.json({
            success: true,
            message: 'Email de verificación enviado'
        });

    } catch (error) {
        console.error('Error al reenviar verificación:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Solicitar reset de password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const client = await ClienteWeb.findOne({ 
            email: email.toLowerCase(),
            isActive: true 
        });

        if (!client) {
            // Por seguridad, siempre responder exitosamente
            return res.json({
                success: true,
                message: 'Si existe una cuenta con ese email, recibirás instrucciones para resetear tu password'
            });
        }

        // Verificar si tiene password (podría ser cuenta OAuth)
        if (!client.hasPassword()) {
            return res.json({
                success: true,
                message: 'Si existe una cuenta con ese email, recibirás instrucciones para resetear tu password'
            });
        }

        // Generar token de reset
        const resetToken = generateVerificationToken();
        client.passwordResetToken = resetToken;
        client.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        await client.save();

        // TODO: Enviar email de reset
        // await sendPasswordResetEmail(client.email, resetToken);

        res.json({
            success: true,
            message: 'Si existe una cuenta con ese email, recibirás instrucciones para resetear tu password'
        });

    } catch (error) {
        console.error('Error en forgot password:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Reset password
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const client = await ClienteWeb.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() },
            isActive: true
        });

        if (!client) {
            return res.status(400).json({
                success: false,
                message: 'Token de reset inválido o expirado'
            });
        }

        // Actualizar password
        client.password = password;
        client.passwordResetToken = undefined;
        client.passwordResetExpires = undefined;
        await client.save();

        res.json({
            success: true,
            message: 'Password actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error en reset password:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener perfil del cliente autenticado
const getProfile = async (req, res) => {
    try {
        const client = req.client; // Viene del middleware de autenticación

        res.json({
            success: true,
            data: {
                client: client.toPublicJSON()
            }
        });

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Logout
const logout = async (req, res) => {
    try {
        // Con JWT, el logout es principalmente del lado del cliente
        // Pero podemos invalidar el token si implementamos una blacklist
        
        res.json({
            success: true,
            message: 'Logout exitoso'
        });

    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Verificar si el usuario está autenticado
const checkAuth = async (req, res) => {
    try {
        const client = req.client; // Viene del middleware de autenticación

        res.json({
            success: true,
            data: {
                isAuthenticated: true,
                client: client.toPublicJSON()
            }
        });

    } catch (error) {
        console.error('Error en check auth:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Agregar cabaña a favoritos
const addFavoriteAccommodation = async (req, res) => {
    try {
        const client = req.client; // Viene del middleware de autenticación
        const { accommodationId } = req.body;

        // Validar que se proporcione el ID de la cabaña
        if (!accommodationId) {
            return res.status(400).json({
                success: false,
                message: 'ID de cabaña requerido'
            });
        }

        // Verificar que la cabaña no esté ya en favoritos
        if (client.preferences.favoriteAccommodations.includes(accommodationId)) {
            return res.status(400).json({
                success: false,
                message: 'Esta cabaña ya está en tus favoritos'
            });
        }

        // Agregar cabaña a favoritos
        client.preferences.favoriteAccommodations.push(accommodationId);
        await client.save();

        res.json({
            success: true,
            message: 'Cabaña agregada a favoritos exitosamente',
            data: {
                favoriteAccommodations: client.preferences.favoriteAccommodations,
                totalFavorites: client.preferences.favoriteAccommodations.length
            }
        });

    } catch (error) {
        console.error('Error al agregar favorito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Remover cabaña de favoritos
const removeFavoriteAccommodation = async (req, res) => {
    try {
        const client = req.client; // Viene del middleware de autenticación
        const { accommodationId } = req.params;

        // Validar que se proporcione el ID de la cabaña
        if (!accommodationId) {
            return res.status(400).json({
                success: false,
                message: 'ID de cabaña requerido'
            });
        }

        // Verificar que la cabaña esté en favoritos
        const index = client.preferences.favoriteAccommodations.indexOf(accommodationId);
        if (index === -1) {
            return res.status(400).json({
                success: false,
                message: 'Esta cabaña no está en tus favoritos'
            });
        }

        // Remover cabaña de favoritos
        client.preferences.favoriteAccommodations.splice(index, 1);
        await client.save();

        res.json({
            success: true,
            message: 'Cabaña removida de favoritos exitosamente',
            data: {
                favoriteAccommodations: client.preferences.favoriteAccommodations,
                totalFavorites: client.preferences.favoriteAccommodations.length
            }
        });

    } catch (error) {
        console.error('Error al remover favorito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener cabañas favoritas del cliente
const getFavoriteAccommodations = async (req, res) => {
    try {
        const client = req.client; // Viene del middleware de autenticación

        // Obtener las cabañas favoritas con información completa
        const clientWithFavorites = await ClienteWeb.findById(client._id)
            .populate('preferences.favoriteAccommodations')
            .select('preferences.favoriteAccommodations');

        res.json({
            success: true,
            data: {
                favoriteAccommodations: clientWithFavorites.preferences.favoriteAccommodations,
                totalFavorites: clientWithFavorites.preferences.favoriteAccommodations.length
            }
        });

    } catch (error) {
        console.error('Error al obtener favoritos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Toggle favorito (agregar si no existe, remover si existe)
const toggleFavoriteAccommodation = async (req, res) => {
    try {
        const client = req.client; // Viene del middleware de autenticación
        const { accommodationId } = req.body;

        // Validar que se proporcione el ID de la cabaña
        if (!accommodationId) {
            return res.status(400).json({
                success: false,
                message: 'ID de cabaña requerido'
            });
        }

        const index = client.preferences.favoriteAccommodations.indexOf(accommodationId);
        let action = '';
        
        if (index === -1) {
            // No está en favoritos, agregar
            client.preferences.favoriteAccommodations.push(accommodationId);
            action = 'added';
        } else {
            // Está en favoritos, remover
            client.preferences.favoriteAccommodations.splice(index, 1);
            action = 'removed';
        }

        await client.save();

        res.json({
            success: true,
            message: action === 'added' ? 'Cabaña agregada a favoritos' : 'Cabaña removida de favoritos',
            data: {
                action: action,
                isFavorite: action === 'added',
                favoriteAccommodations: client.preferences.favoriteAccommodations,
                totalFavorites: client.preferences.favoriteAccommodations.length
            }
        });

    } catch (error) {
        console.error('Error al toggle favorito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Verificar si una cabaña es favorita
const checkIsFavorite = async (req, res) => {
    try {
        const client = req.client; // Viene del middleware de autenticación
        const { accommodationId } = req.params;

        // Validar que se proporcione el ID de la cabaña
        if (!accommodationId) {
            return res.status(400).json({
                success: false,
                message: 'ID de cabaña requerido'
            });
        }

        const isFavorite = client.preferences.favoriteAccommodations.includes(accommodationId);

        res.json({
            success: true,
            data: {
                isFavorite: isFavorite,
                accommodationId: accommodationId
            }
        });

    } catch (error) {
        console.error('Error al verificar favorito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Actualizar perfil del usuario web
const updateProfile = async (req, res) => {
    try {
        const client = req.client; // Viene del middleware de autenticación
        const { firstName, lastName, phone } = req.body;

        if (firstName) client.firstName = firstName;
        if (lastName) client.lastName = lastName;
        if (phone) client.phone = phone;

        await client.save();

        res.json({
            success: true,
            message: 'Perfil actualizado exitosamente',
            data: { client: client.toPublicJSON() }
        });
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Actualizar preferencias del usuario web
const updatePreferences = async (req, res) => {
    try {
        const client = req.client; // Viene del middleware de autenticación
        const { preferences } = req.body;

        if (!preferences || typeof preferences !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Preferencias inválidas'
            });
        }

        // Solo actualiza los campos permitidos
        if (preferences.newsletter !== undefined) {
            client.preferences.newsletter = preferences.newsletter;
        }
        if (preferences.notifications) {
            if (preferences.notifications.email !== undefined) {
                client.preferences.notifications.email = preferences.notifications.email;
            }
            if (preferences.notifications.sms !== undefined) {
                client.preferences.notifications.sms = preferences.notifications.sms;
            }
        }

        await client.save();

        res.json({
            success: true,
            message: 'Preferencias actualizadas exitosamente',
            data: { preferences: client.preferences }
        });
    } catch (error) {
        console.error('Error al actualizar preferencias:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    googleAuth,
    googleCallback,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    getProfile,
    logout,
    checkAuth,
    addFavoriteAccommodation,
    removeFavoriteAccommodation,
    getFavoriteAccommodations,
    toggleFavoriteAccommodation,
    checkIsFavorite,
    updateProfile,
    updatePreferences
};