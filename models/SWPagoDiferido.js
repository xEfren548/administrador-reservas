const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const swPagoDiferidoSchema = new Schema({
    cuenta: {
        type: Schema.Types.ObjectId,
        ref: 'SWCuenta',
        required: true
    },
    
    // Información del pago
    montoTotal: {
        type: Number,
        required: true,
        min: [0.01, 'El monto debe ser mayor a 0']
    },
    numeroPagos: {
        type: Number,
        required: true,
        min: [2, 'Debe tener al menos 2 pagos']
    },
    montoPorPago: {
        type: Number,
        required: true
    },
    
    // Información adicional
    concepto: {
        type: String,
        required: true,
        trim: true
    },
    descripcion: {
        type: String,
        trim: true
    },
    categoria: {
        type: String,
        enum: [
            'Alimentación',
            'Transporte',
            'Servicios',
            'Mantenimiento',
            'Compras',
            'Salud',
            'Entretenimiento',
            'Educación',
            'Hogar',
            'Salario',
            'Venta',
            'Inversión',
            'Préstamo',
            'Reembolso',
            'Otro'
        ],
        default: 'Otro'
    },
    
    // Fechas
    fechaInicio: {
        type: Date,
        required: true
    },
    
    // Interés
    interes: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Cuotas
    cuotas: [{
        numero: {
            type: Number,
            required: true
        },
        monto: {
            type: Number,
            required: true
        },
        fechaProgramada: {
            type: Date,
            required: true
        },
        fechaPago: {
            type: Date
        },
        transaccion: {
            type: Schema.Types.ObjectId,
            ref: 'SWTransaccion'
        },
        estado: {
            type: String,
            enum: ['Pendiente', 'Pagada', 'Vencida'],
            default: 'Pendiente'
        }
    }],
    
    // Estado general
    estado: {
        type: String,
        enum: ['Activo', 'Completado', 'Cancelado'],
        default: 'Activo'
    },
    
    // Información adicional
    creadoPor: {
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

// Índices
swPagoDiferidoSchema.index({ cuenta: 1, estado: 1 });
swPagoDiferidoSchema.index({ creadoPor: 1 });
swPagoDiferidoSchema.index({ 'cuotas.estado': 1 });

// Middleware para actualizar updatedAt
swPagoDiferidoSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Método para calcular el progreso
swPagoDiferidoSchema.methods.calcularProgreso = function() {
    const pagadas = this.cuotas.filter(c => c.estado === 'Pagada').length;
    const total = this.cuotas.length;
    return {
        pagadas,
        total,
        porcentaje: ((pagadas / total) * 100).toFixed(2),
        montoPagado: this.cuotas.filter(c => c.estado === 'Pagada').reduce((sum, c) => sum + c.monto, 0),
        montoRestante: this.montoTotal - this.cuotas.filter(c => c.estado === 'Pagada').reduce((sum, c) => sum + c.monto, 0)
    };
};

module.exports = mongoose.model('SWPagoDiferido', swPagoDiferidoSchema);
