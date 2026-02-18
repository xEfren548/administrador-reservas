const mongoose = require('mongoose');

const cuponSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre del cupón es requerido'],
        trim: true,
        maxlength: [100, 'El nombre no puede exceder 100 caracteres']
    },
    codigo: {
        type: String,
        required: [true, 'El código del cupón es requerido'],
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: [50, 'El código no puede exceder 50 caracteres']
    },
    tipo: {
        type: String,
        required: [true, 'El tipo de cupón es requerido'],
        enum: {
            values: ['percentage', 'fixed_amount', 'nights_free'],
            message: 'El tipo debe ser percentage, fixed_amount o nights_free'
        }
    },
    valor: {
        type: Number,
        required: function() {
            return this.tipo !== 'nights_free';
        },
        min: [0, 'El valor no puede ser negativo'],
        default: null
    },
    // Campos específicos para nights_free
    nochesRecibidas: {
        type: Number,
        default: null,
        min: [1, 'Las noches recibidas deben ser al menos 1']
    },
    nochesPagadas: {
        type: Number,
        default: null,
        min: [1, 'Las noches pagadas deben ser al menos 1']
    },
    aplicableA: {
        type: String,
        required: [true, 'Debe especificar a quién aplica el cupón'],
        enum: {
            values: ['all', 'owner_only', 'except_owner', 'virtual_seller'],
            message: 'aplicableA debe ser all, owner_only, except_owner o virtual_seller'
        },
        default: 'all'
    },
    montoMinimoCompra: {
        type: Number,
        default: 0,
        min: [0, 'El monto mínimo no puede ser negativo']
    },
    descuentoMaximo: {
        type: Number,
        default: null,
        min: [0, 'El descuento máximo no puede ser negativo']
    },
    usosLimitados: {
        type: Number,
        default: null,
        min: [1, 'Si hay límite de usos, debe ser al menos 1']
    },
    usosActuales: {
        type: Number,
        default: 0,
        min: 0
    },
    fechaInicio: {
        type: Date,
        required: [true, 'La fecha de inicio es requerida']
    },
    fechaFin: {
        type: Date,
        required: [true, 'La fecha de fin es requerida']
    },
    activo: {
        type: Boolean,
        default: true
    },
    todasCabanas: {
        type: Boolean,
        default: true
    },
    habitaciones: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'habitaciones'
    }],
    restricciones: {
        nochesMinimas: {
            type: Number,
            default: null,
            min: [1, 'Las noches mínimas deben ser al menos 1']
        },
        nochesMaximas: {
            type: Number,
            default: null,
            min: [1, 'Las noches máximas deben ser al menos 1']
        },
        fechasExcluidas: [{
            type: Date
        }],
        soloNuevosClientes: {
            type: Boolean,
            default: false
        },
        soloReservasWeb: {
            type: Boolean,
            default: false
        }
    },
    descripcion: {
        type: String,
        trim: true,
        maxlength: [500, 'La descripción no puede exceder 500 caracteres']
    },
    esReferido: {
        type: Boolean,
        default: false
    },
    cuentaReferido: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CuentaReferido',
        default: null
    },
    esCuponWeb: {
        type: Boolean,
        default: false
    },
    creadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    }
}, {
    timestamps: true
});

// Índices para búsquedas eficientes
// Nota: 'codigo' ya tiene índice único por la propiedad unique: true
cuponSchema.index({ activo: 1, fechaInicio: 1, fechaFin: 1 });
cuponSchema.index({ creadoPor: 1 });
cuponSchema.index({ esReferido: 1 });
cuponSchema.index({ cuentaReferido: 1 });
cuponSchema.index({ esCuponWeb: 1 });

// Método para verificar si el cupón está vigente
cuponSchema.methods.estaVigente = function() {
    const ahora = new Date();
    return this.activo && 
           ahora >= this.fechaInicio && 
           ahora <= this.fechaFin &&
           (this.usosLimitados === null || this.usosActuales < this.usosLimitados);
};

// Método para verificar si puede ser usado por más clientes
cuponSchema.methods.tieneUsosDisponibles = function() {
    if (this.usosLimitados === null) return true;
    return this.usosActuales < this.usosLimitados;
};

// Pre-save: convertir código a mayúsculas
cuponSchema.pre('save', function(next) {
    if (this.codigo) {
        this.codigo = this.codigo.toUpperCase();
    }
    next();
});

module.exports = mongoose.model('Cupon', cuponSchema);
