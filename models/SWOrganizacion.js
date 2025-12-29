const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const swOrganizacionSchema = new Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    descripcion: {
        type: String,
        trim: true
    },
    participantes: [{
        usuario: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true
        },
        rol: {
            type: String,
            enum: ['Administrador', 'Miembro'],
            default: 'Miembro'
        },
        fechaIngreso: {
            type: Date,
            default: Date.now
        },
        agregadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario'
        }
    }],
    activa: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware para actualizar updatedAt
swOrganizacionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const SWOrganizacion = mongoose.model('SWOrganizacion', swOrganizacionSchema);

module.exports = SWOrganizacion;
