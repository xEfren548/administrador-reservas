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
    checkAuth
};