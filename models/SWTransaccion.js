const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const swTransaccionSchema = new Schema({
    cuenta: {
        type: Schema.Types.ObjectId,
        ref: 'SWCuenta',
        required: true
    },
    tipo: {
        type: String,
        enum: ['Ingreso', 'Gasto'],
        required: true
    },
    monto: {
        type: Number,
        required: true,
        min: [0.01, 'El monto debe ser mayor a 0']
    },
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
        required: true,
        default: 'Otro'
    },
    fecha: {
        type: Date,
        required: true,
        default: Date.now
    },
    creadoPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    aprobada: {
        type: Boolean,
        default: false,
        required: true
    },
    aprobadaPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    fechaAprobacion: {
        type: Date
    },
    solicitudOriginal: {
        type: Schema.Types.ObjectId,
        ref: 'SWSolicitudTransaccion'
    },
    // Archivos adjuntos (comprobantes, facturas, etc.)
    archivosAdjuntos: [{
        nombre: String,
        url: String,
        tipo: String,
        fechaSubida: {
            type: Date,
            default: Date.now
        }
    }],
    // Imágenes asociadas a la transacción (rutas relativas)
    imagenes: [{
        type: String,
        trim: true
    }],
    // Para asociar con reservas del PMS si aplica
    reservaAsociada: {
        type: Schema.Types.ObjectId,
        ref: 'documentos'
    },
    etiquetas: [{
        type: String,
        trim: true
    }],
    notas: {
        type: String,
        trim: true
    },
    editada: {
        type: Boolean,
        default: false
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

// Índices para optimizar consultas
swTransaccionSchema.index({ cuenta: 1, fecha: -1 });
swTransaccionSchema.index({ cuenta: 1, aprobada: 1 });
swTransaccionSchema.index({ creadoPor: 1 });
swTransaccionSchema.index({ tipo: 1, categoria: 1 });
swTransaccionSchema.index({ fecha: -1 });

// Middleware para actualizar updatedAt
swTransaccionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Middleware para prevenir edición de transacciones aprobadas
swTransaccionSchema.pre('save', function(next) {
    if (!this.isNew && this.aprobada && this.isModified()) {
        // Permitir solo actualizar ciertos campos en transacciones aprobadas
        const allowedFields = ['notas', 'etiquetas', 'archivosAdjuntos'];
        const modifiedFields = this.modifiedPaths();
        
        const hasDisallowedChanges = modifiedFields.some(field => 
            !allowedFields.includes(field.split('.')[0])
        );
        
        if (hasDisallowedChanges) {
            return next(new Error('No se pueden modificar transacciones aprobadas'));
        }
    }
    next();
});

// Método para aprobar transacción
swTransaccionSchema.methods.aprobar = function(usuarioId) {
    if (this.aprobada) {
        throw new Error('Esta transacción ya fue aprobada');
    }
    
    this.aprobada = true;
    this.aprobadaPor = usuarioId;
    this.fechaAprobacion = new Date();
    
    return this.save();
};

// Método estático para obtener resumen de transacciones
swTransaccionSchema.statics.obtenerResumen = async function(cuentaId, fechaInicio, fechaFin) {
    const filtro = {
        cuenta: cuentaId,
        aprobada: true
    };
    
    if (fechaInicio || fechaFin) {
        filtro.fecha = {};
        if (fechaInicio) filtro.fecha.$gte = fechaInicio;
        if (fechaFin) filtro.fecha.$lte = fechaFin;
    }
    
    return this.aggregate([
        { $match: filtro },
        {
            $group: {
                _id: null,
                totalIngresos: {
                    $sum: {
                        $cond: [{ $eq: ['$tipo', 'Ingreso'] }, '$monto', 0]
                    }
                },
                totalGastos: {
                    $sum: {
                        $cond: [{ $eq: ['$tipo', 'Gasto'] }, '$monto', 0]
                    }
                },
                cantidadTransacciones: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                totalIngresos: 1,
                totalGastos: 1,
                balance: { $subtract: ['$totalIngresos', '$totalGastos'] },
                cantidadTransacciones: 1
            }
        }
    ]);
};

// Método estático para obtener transacciones por categoría
swTransaccionSchema.statics.obtenerPorCategoria = async function(cuentaId, fechaInicio, fechaFin) {
    const filtro = {
        cuenta: cuentaId,
        aprobada: true
    };
    
    if (fechaInicio || fechaFin) {
        filtro.fecha = {};
        if (fechaInicio) filtro.fecha.$gte = fechaInicio;
        if (fechaFin) filtro.fecha.$lte = fechaFin;
    }
    
    return this.aggregate([
        { $match: filtro },
        {
            $group: {
                _id: {
                    tipo: '$tipo',
                    categoria: '$categoria'
                },
                total: { $sum: '$monto' },
                cantidad: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                tipo: '$_id.tipo',
                categoria: '$_id.categoria',
                total: 1,
                cantidad: 1
            }
        },
        { $sort: { total: -1 } }
    ]);
};

const SWTransaccion = mongoose.model('SWTransaccion', swTransaccionSchema);

module.exports = SWTransaccion;
