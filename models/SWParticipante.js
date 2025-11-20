const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const swParticipanteSchema = new Schema({
    cuenta: {
        type: Schema.Types.ObjectId,
        ref: 'SWCuenta',
        required: true
    },
    usuario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    rol: {
        type: String,
        enum: ['Propietario', 'Participante'],
        required: true,
        default: 'Participante'
    },
    permisos: {
        puedeVerTransacciones: {
            type: Boolean,
            default: true
        },
        puedeCrearSolicitudes: {
            type: Boolean,
            default: true
        },
        puedeVerSaldo: {
            type: Boolean,
            default: true
        }
    },
    activo: {
        type: Boolean,
        default: true
    },
    fechaIngreso: {
        type: Date,
        default: Date.now
    },
    agregadoPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Índice compuesto único para evitar duplicados
swParticipanteSchema.index({ cuenta: 1, usuario: 1 }, { unique: true });

// Índices adicionales para consultas
swParticipanteSchema.index({ usuario: 1, activo: 1 });
swParticipanteSchema.index({ cuenta: 1, activo: 1 });

// Validación: Solo puede haber un propietario por cuenta
swParticipanteSchema.pre('save', async function(next) {
    if (this.rol === 'Propietario' && !this.isNew) {
        const existingOwner = await this.constructor.findOne({
            cuenta: this.cuenta,
            rol: 'Propietario',
            _id: { $ne: this._id }
        });
        
        if (existingOwner) {
            throw new Error('Ya existe un propietario para esta cuenta');
        }
    }
    next();
});

const SWParticipante = mongoose.model('SWParticipante', swParticipanteSchema);

module.exports = SWParticipante;
