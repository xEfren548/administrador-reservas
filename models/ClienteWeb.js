const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const clienteWebSchema = new mongoose.Schema({
    // Información básica (heredada del modelo Cliente)
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    
    // Campos de autenticación - ahora opcionales
    password: {
        type: String,
        required: function() {
            // Password requerido solo si no hay OAuth
            return !this.oauth.google.id;
        },
        minlength: 6
    },
    
    // OAuth providers
    oauth: {
        google: {
            id: {
                type: String,
                sparse: true,
                unique: true
            },
            email: String,
            verified: {
                type: Boolean,
                default: false
            },
            picture: String,
            accessToken: String,
            refreshToken: String
        },
        // Preparado para otros providers
        facebook: {
            id: {
                type: String,
                sparse: true,
                unique: true
            },
            email: String,
            verified: {
                type: Boolean,
                default: false
            }
        }
    },
    
    // Método de registro
    registrationMethod: {
        type: String,
        enum: ['email', 'google', 'facebook'],
        required: true,
        default: 'email'
    },
    
    // Verificación de email
    isEmailVerified: {
        type: Boolean,
        default: function() {
            // Si se registró con Google y el email está verificado, marcar como verificado
            return this.oauth.google.verified || false;
        }
    },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    
    // Información del perfil (puede venir de OAuth)
    profilePicture: {
        type: String,
        default: function() {
            return this.oauth.google.picture || null;
        }
    },
    
    // Preferencias del cliente
    preferences: {
        newsletter: {
            type: Boolean,
            default: true
        },
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false }
        },
        favoriteAccommodations: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Habitacion'
        }]
    },
    
    // Información adicional opcional
    address: String,
    identificationType: {
        type: String,
        enum: ['INE', 'Pasaporte', 'Licencia de conducir']
    },
    identificationNumber: String,
    
    // Estado de la cuenta
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: Date,
    
    // Referencia al cliente original (si existe)
    clienteRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cliente'
    }
}, {
    timestamps: true
});

// Middleware para hash de contraseña
clienteWebSchema.pre('save', async function(next) {
    // Solo hash si hay password y fue modificado
    if (!this.password || !this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar contraseñas
clienteWebSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Método para verificar si el usuario puede hacer login con password
clienteWebSchema.methods.hasPassword = function() {
    return !!this.password;
};

// Método para verificar si tiene OAuth configurado
clienteWebSchema.methods.hasOAuth = function(provider) {
    if (provider) {
        return !!this.oauth[provider]?.id;
    }
    // Verificar cualquier OAuth
    return !!(this.oauth.google.id || this.oauth.facebook.id);
};

// Método para vincular cuenta OAuth
clienteWebSchema.methods.linkOAuth = function(provider, data) {
    if (!this.oauth[provider]) {
        throw new Error(`Provider ${provider} not supported`);
    }
    
    this.oauth[provider] = {
        ...this.oauth[provider],
        ...data
    };
    
    // Si no tenía email verificado y el OAuth lo tiene, actualizar
    if (!this.isEmailVerified && data.verified) {
        this.isEmailVerified = true;
    }
    
    // Actualizar foto de perfil si no tiene una
    if (!this.profilePicture && data.picture) {
        this.profilePicture = data.picture;
    }
};

// Método estático para encontrar o crear usuario OAuth
clienteWebSchema.statics.findOrCreateOAuth = async function(provider, profile) {
    const { id, email, given_name, family_name, picture, verified_email } = profile;
    
    // Buscar por OAuth ID primero
    let user = await this.findOne({ [`oauth.${provider}.id`]: id });
    
    if (user) {
        // Actualizar tokens si es necesario
        user.oauth[provider].accessToken = profile.accessToken;
        user.oauth[provider].refreshToken = profile.refreshToken;
        await user.save();
        return user;
    }
    
    // Buscar por email si no se encontró por OAuth ID
    user = await this.findOne({ email: email });
    
    if (user) {
        // Vincular OAuth a cuenta existente
        user.linkOAuth(provider, {
            id: id,
            email: email,
            verified: verified_email,
            picture: picture,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken
        });
        await user.save();
        return user;
    }
    
    // Crear nuevo usuario
    user = new this({
        firstName: given_name,
        lastName: family_name,
        email: email,
        registrationMethod: provider,
        isEmailVerified: verified_email,
        profilePicture: picture,
        oauth: {
            [provider]: {
                id: id,
                email: email,
                verified: verified_email,
                picture: picture,
                accessToken: profile.accessToken,
                refreshToken: profile.refreshToken
            }
        }
    });
    
    await user.save();
    return user;
};

// Método para obtener datos públicos
clienteWebSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        phone: this.phone,
        profilePicture: this.profilePicture,
        preferences: this.preferences,
        isEmailVerified: this.isEmailVerified,
        lastLogin: this.lastLogin,
        registrationMethod: this.registrationMethod,
        hasPassword: this.hasPassword(),
        oauthProviders: {
            google: this.hasOAuth('google'),
            facebook: this.hasOAuth('facebook')
        }
    };
};

const ClienteWeb = mongoose.model('ClienteWeb', clienteWebSchema);

module.exports = ClienteWeb;