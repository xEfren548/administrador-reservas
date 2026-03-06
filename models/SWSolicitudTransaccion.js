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
        enum: ['Ingreso', 'Gasto', 'Transferencia'],
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
            'Reserva',
            'Transferencia',
            'Otro'
        ],
        required: true,
        default: 'Otro'
    },
    esProveedorExterno: {
        type: Boolean,
        default: false
    },
    proveedorNombre: {
        type: String,
        trim: true,
        maxlength: 150
    },
    proveedorBeneficiario: {
        type: String,
        trim: true,
        maxlength: 150
    },
    proveedorBanco: {
        type: String,
        trim: true,
        maxlength: 120
    },
    proveedorCuentaClabe: {
        type: String,
        trim: true,
        maxlength: 30
    },
    // Para transferencias: cuenta destino (solo para solicitudes de tipo Transferencia)
    cuentaDestino: {
        type: Schema.Types.ObjectId,
        ref: 'SWCuenta'
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
        ref: 'Documento'
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
        },
        // Comprobante de confirmación subido por el propietario al aprobar
        comprobanteConfirmacion: {
            nombre: String,
            url: String,
            tipo: String,
            fechaSubida: {
                type: Date,
                default: Date.now
            }
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
swSolicitudTransaccionSchema.methods.aprobar = async function(usuarioId, comentario = '', comprobanteConfirmacion = null) {
    if (this.estado !== 'Pendiente') {
        throw new Error('Solo se pueden aprobar solicitudes pendientes');
    }
    
    const SWTransaccion = mongoose.model('SWTransaccion');
    const SWCuenta = mongoose.model('SWCuenta');
    let transaccion;
    
    // Si es transferencia, usar el método especial
    if (this.tipo === 'Transferencia') {
        if (!this.cuentaDestino) {
            throw new Error('La cuenta origen es requerida para transferencias');
        }
        
        // En solicitudes de transferencia:
        // - this.cuenta = cuenta DESTINO (donde se aprueba)
        // - this.cuentaDestino = cuenta ORIGEN (de donde sale el dinero)
        // - this.solicitadoPor = usuario que creó la solicitud (propietario de cuenta origen)
        // Usar el ID del solicitante para crear la transferencia, ya que él tiene acceso a la cuenta origen
        // Omitir validaciones de acceso porque el solicitante no tiene acceso a la cuenta destino
        const resultado = await SWTransaccion.crearTransferencia(
            this.cuentaDestino,  // Cuenta ORIGEN (de donde sale)
            this.cuenta,         // Cuenta DESTINO (a donde llega)
            this.monto,
            this.concepto,
            this.descripcion,
            this.solicitadoPor,  // Usuario solicitante (propietario de cuenta origen)
            true,                // Omitir validaciones de acceso (solicitud ya fue validada)
            {
                esProveedorExterno: this.esProveedorExterno,
                proveedor: this.esProveedorExterno
                    ? {
                        nombre: this.proveedorNombre,
                        beneficiario: this.proveedorBeneficiario,
                        banco: this.proveedorBanco,
                        cuentaClabe: this.proveedorCuentaClabe
                    }
                    : undefined
            }
        );
        
        // La transacción de origen es la que vinculamos con la solicitud
        transaccion = resultado.origen;
        
        // Actualizar las transacciones creadas para reflejar quién aprobó
        await SWTransaccion.updateOne(
            { _id: resultado.origen._id },
            { aprobadaPor: usuarioId, solicitudOriginal: this._id }
        );
        await SWTransaccion.updateOne(
            { _id: resultado.destino._id },
            { aprobadaPor: usuarioId, solicitudOriginal: this._id }
        );
        
        // Recalcular saldos de AMBAS cuentas después de las actualizaciones
        const cuentaOrigen = await SWCuenta.findById(this.cuentaDestino);
        const cuentaDestino = await SWCuenta.findById(this.cuenta);
        
        if (cuentaOrigen) {
            await cuentaOrigen.calcularSaldo();
            await cuentaOrigen.save();
        }
        if (cuentaDestino) {
            await cuentaDestino.calcularSaldo();
            await cuentaDestino.save();
        }
        
        // Vincular la solicitud con la transacción de origen
        this.transaccionCreada = transaccion._id;
    } else {
        // Transacción normal (Ingreso o Gasto)
        const transaccionData = {
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
            imagenes: this.imagenes,
            reservaAsociada: this.reservaAsociada,
            etiquetas: this.etiquetas,
            notas: this.notas,
            esProveedorExterno: this.esProveedorExterno,
            proveedor: this.esProveedorExterno
                ? {
                    nombre: this.proveedorNombre,
                    beneficiario: this.proveedorBeneficiario,
                    banco: this.proveedorBanco,
                    cuentaClabe: this.proveedorCuentaClabe
                }
                : undefined
        };
        
        // Solo agregar comprobante si existe
        if (comprobanteConfirmacion && comprobanteConfirmacion.url) {
            transaccionData.comprobanteConfirmacion = comprobanteConfirmacion;
        }
        
        // Crear la transacción
        transaccion = new SWTransaccion(transaccionData);
        await transaccion.save();
        
        // Actualizar el saldo de la cuenta
        const cuenta = await SWCuenta.findById(this.cuenta);
        if (cuenta) {
            await cuenta.calcularSaldo();
            await cuenta.save();
        }
    }
    
    // Preparar respuesta de la solicitud
    const respuestaData = {
        procesadaPor: usuarioId,
        fechaRespuesta: new Date(),
        comentario: comentario
    };
    
    // Solo agregar comprobante a la respuesta si existe
    if (comprobanteConfirmacion && comprobanteConfirmacion.url) {
        respuestaData.comprobanteConfirmacion = comprobanteConfirmacion;
    }
    
    // Actualizar la solicitud
    this.estado = 'Aprobada';
    this.respuesta = respuestaData;
    this.transaccionCreada = transaccion._id;
    
    await this.save();
    
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
    .populate('cuentaDestino', 'nombre moneda')
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
        .populate({
            path: 'reservaAsociada',
            select: 'arrivalDate departureDate resourceId',
            populate: {
                path: 'resourceId',
                select: 'propertyDetails'
            }
        })
        .sort({ createdAt: -1 });
};

const SWSolicitudTransaccion = mongoose.model('SWSolicitudTransaccion', swSolicitudTransaccionSchema);

module.exports = SWSolicitudTransaccion;
