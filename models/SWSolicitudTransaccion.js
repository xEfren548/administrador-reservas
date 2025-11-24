const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const swSolicitudTransaccionSchema = new Schema({
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
    solicitadoPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    estado: {
        type: String,
        enum: ['Pendiente', 'Aprobada', 'Rechazada', 'Cancelada'],
        default: 'Pendiente',
        required: true
    },
    propietarioCuenta: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
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
    // Imágenes asociadas a la solicitud (rutas relativas)
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
    // Respuesta del propietario
    respuesta: {
        procesadaPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario'
        },
        fechaRespuesta: {
            type: Date
        },
        comentario: {
            type: String,
            trim: true
        },
        motivoRechazo: {
            type: String,
            trim: true
        }
    },
    transaccionCreada: {
        type: Schema.Types.ObjectId,
        ref: 'SWTransaccion'
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
swSolicitudTransaccionSchema.index({ cuenta: 1, estado: 1 });
swSolicitudTransaccionSchema.index({ solicitadoPor: 1, estado: 1 });
swSolicitudTransaccionSchema.index({ propietarioCuenta: 1, estado: 1 });
swSolicitudTransaccionSchema.index({ createdAt: -1 });

// Middleware para actualizar updatedAt
swSolicitudTransaccionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Validación: No permitir modificar solicitudes ya procesadas
swSolicitudTransaccionSchema.pre('save', function(next) {
    if (!this.isNew && (this.estado === 'Aprobada' || this.estado === 'Rechazada')) {
        const allowedFields = ['notas'];
        const modifiedFields = this.modifiedPaths();
        
        const hasDisallowedChanges = modifiedFields.some(field => 
            !allowedFields.includes(field.split('.')[0])
        );
        
        if (hasDisallowedChanges && !this.isModified('estado')) {
            return next(new Error('No se pueden modificar solicitudes ya procesadas'));
        }
    }
    next();
});

// Método para aprobar solicitud y crear transacción
swSolicitudTransaccionSchema.methods.aprobar = async function(usuarioId, comentario = '') {
    if (this.estado !== 'Pendiente') {
        throw new Error('Solo se pueden aprobar solicitudes pendientes');
    }
    
    const SWTransaccion = mongoose.model('SWTransaccion');
    
    // Crear la transacción
    const transaccion = new SWTransaccion({
        cuenta: this.cuenta,
        tipo: this.tipo,
        monto: this.monto,
        concepto: this.concepto,
        descripcion: this.descripcion,
        categoria: this.categoria,
        fecha: this.fecha,
        creadoPor: this.solicitadoPor,
        aprobada: true,
        aprobadaPor: usuarioId,
        fechaAprobacion: new Date(),
        solicitudOriginal: this._id,
        archivosAdjuntos: this.archivosAdjuntos,
        reservaAsociada: this.reservaAsociada,
        etiquetas: this.etiquetas,
        notas: this.notas
    });
    
    await transaccion.save();
    
    // Actualizar la solicitud
    this.estado = 'Aprobada';
    this.respuesta = {
        procesadaPor: usuarioId,
        fechaRespuesta: new Date(),
        comentario: comentario
    };
    this.transaccionCreada = transaccion._id;
    
    await this.save();
    
    // Actualizar el saldo de la cuenta
    const SWCuenta = mongoose.model('SWCuenta');
    const cuenta = await SWCuenta.findById(this.cuenta);
    if (cuenta) {
        await cuenta.calcularSaldo();
        await cuenta.save();
    }
    
    return transaccion;
};

// Método para rechazar solicitud
swSolicitudTransaccionSchema.methods.rechazar = async function(usuarioId, motivoRechazo = '') {
    if (this.estado !== 'Pendiente') {
        throw new Error('Solo se pueden rechazar solicitudes pendientes');
    }
    
    this.estado = 'Rechazada';
    this.respuesta = {
        procesadaPor: usuarioId,
        fechaRespuesta: new Date(),
        motivoRechazo: motivoRechazo
    };
    
    return this.save();
};

// Método para cancelar solicitud (por el solicitante)
swSolicitudTransaccionSchema.methods.cancelar = async function(usuarioId) {
    if (this.estado !== 'Pendiente') {
        throw new Error('Solo se pueden cancelar solicitudes pendientes');
    }
    
    if (this.solicitadoPor.toString() !== usuarioId.toString()) {
        throw new Error('Solo el solicitante puede cancelar la solicitud');
    }
    
    this.estado = 'Cancelada';
    
    return this.save();
};

// Método estático para obtener solicitudes pendientes de una cuenta
swSolicitudTransaccionSchema.statics.obtenerPendientesPorCuenta = function(cuentaId) {
    return this.find({
        cuenta: cuentaId,
        estado: 'Pendiente'
    })
    .populate('solicitadoPor', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Método estático para obtener solicitudes de un usuario
swSolicitudTransaccionSchema.statics.obtenerPorUsuario = async function(usuarioId, estado = null) {
    const SWCuenta = require('./SWCuenta');
    
    // Obtener cuentas donde el usuario es propietario
    const cuentasPropias = await SWCuenta.find({ propietario: usuarioId }).select('_id');
    const cuentasPropiasIds = cuentasPropias.map(c => c._id);
    
    // Construir filtro: solicitudes que creó O solicitudes de cuentas que posee
    const filtro = {
        $or: [
            { solicitadoPor: usuarioId },
            { cuenta: { $in: cuentasPropiasIds } }
        ]
    };
    
    if (estado) {
        filtro.estado = estado;
    }
    
    return this.find(filtro)
        .populate('cuenta', 'nombre propietario')
        .populate('solicitadoPor', 'firstName lastName')
        .populate('propietarioCuenta', 'firstName lastName')
        .sort({ createdAt: -1 });
};

const SWSolicitudTransaccion = mongoose.model('SWSolicitudTransaccion', swSolicitudTransaccionSchema);

module.exports = SWSolicitudTransaccion;
