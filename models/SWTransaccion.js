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
    proveedor: {
        nombre: {
            type: String,
            trim: true,
            maxlength: 150
        },
        beneficiario: {
            type: String,
            trim: true,
            maxlength: 150
        },
        cuentaClabe: {
            type: String,
            trim: true,
            maxlength: 30
        }
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
    // Comprobante de confirmación subido por el propietario al aprobar (opcional)
    comprobanteConfirmacion: {
        nombre: String,
        url: String,
        tipo: String,
        fechaSubida: {
            type: Date,
            default: Date.now
        }
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
        ref: 'Documento'
    },
    // Para transferencias: referencia a la transacción vinculada
    transferenciaVinculada: {
        type: Schema.Types.ObjectId,
        ref: 'SWTransaccion'
    },
    // Para transferencias: cuenta destino (solo se usa en la transacción de origen/gasto)
    cuentaDestino: {
        type: Schema.Types.ObjectId,
        ref: 'SWCuenta'
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
swTransaccionSchema.index({ transferenciaVinculada: 1 });

// Middleware para actualizar updatedAt
swTransaccionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Middleware para prevenir edición de transacciones aprobadas
swTransaccionSchema.pre('save', function(next) {
    if (!this.isNew && this.aprobada && this.isModified()) {
        // Permitir solo actualizar ciertos campos en transacciones aprobadas
        const allowedFields = ['notas', 'etiquetas', 'archivosAdjuntos', 'transferenciaVinculada', 'updatedAt', 'imagenes'];
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

// Middleware para validar transferencias
swTransaccionSchema.pre('save', function(next) {
    if (this.tipo === 'Transferencia') {
        // Forzar categoría a Transferencia
        this.categoria = 'Transferencia';
        
        // Validar que tenga transferenciaVinculada (excepto durante creación inicial)
        if (!this.isNew && !this.transferenciaVinculada) {
            return next(new Error('Las transferencias deben tener una transacción vinculada'));
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
                // Transferencias salientes (tienen cuentaDestino definido) - se restan
                totalTransferenciasSalida: {
                    $sum: {
                        $cond: [
                            { 
                                $and: [
                                    { $eq: ['$tipo', 'Transferencia'] },
                                    { $ne: [{ $type: '$cuentaDestino' }, 'missing'] }
                                ]
                            }, 
                            '$monto', 
                            0
                        ]
                    }
                },
                // Transferencias entrantes (NO tienen cuentaDestino - campo missing) - se suman
                totalTransferenciasEntrada: {
                    $sum: {
                        $cond: [
                            { 
                                $and: [
                                    { $eq: ['$tipo', 'Transferencia'] },
                                    { $eq: [{ $type: '$cuentaDestino' }, 'missing'] }
                                ]
                            }, 
                            '$monto', 
                            0
                        ]
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
                totalTransferenciasSalida: 1,
                totalTransferenciasEntrada: 1,
                balance: { 
                    $subtract: [
                        { $add: ['$totalIngresos', '$totalTransferenciasEntrada'] },
                        { $add: ['$totalGastos', '$totalTransferenciasSalida'] }
                    ]
                },
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

// Método estático para crear transferencia entre cuentas
swTransaccionSchema.statics.crearTransferencia = async function(cuentaOrigenId, cuentaDestinoId, monto, concepto, descripcion, userId, skipAccessValidation = false, options = {}) {
    const SWCuenta = mongoose.model('SWCuenta');
    const SWParticipante = mongoose.model('SWParticipante');
    const session = await mongoose.startSession();

    const proveedorData = options.esProveedorExterno && options.proveedor
        ? {
            nombre: options.proveedor.nombre,
            beneficiario: options.proveedor.beneficiario,
            cuentaClabe: options.proveedor.cuentaClabe
        }
        : undefined;
    
    try {
        session.startTransaction();
        
        // Validar que las cuentas existen
        const cuentaOrigen = await SWCuenta.findById(cuentaOrigenId).session(session);
        const cuentaDestino = await SWCuenta.findById(cuentaDestinoId).session(session);
        
        if (!cuentaOrigen) {
            throw new Error('Cuenta de origen no encontrada');
        }
        if (!cuentaDestino) {
            throw new Error('Cuenta de destino no encontrada');
        }
        
        // Validar que las cuentas sean diferentes
        if (cuentaOrigenId.toString() === cuentaDestinoId.toString()) {
            throw new Error('No se puede transferir a la misma cuenta');
        }
        
        // Validar que tengan la misma moneda
        if (cuentaOrigen.moneda !== cuentaDestino.moneda) {
            throw new Error(`No se puede transferir entre cuentas con diferentes monedas (${cuentaOrigen.moneda} → ${cuentaDestino.moneda})`);
        }
        
        // Solo validar permisos si NO se omiten las validaciones de acceso
        if (!skipAccessValidation) {
            // Verificar acceso del usuario a cuenta origen
            const participanteOrigen = await SWParticipante.findOne({
                cuenta: cuentaOrigenId,
                usuario: userId,
                activo: true
            }).session(session);
            
            if (!participanteOrigen) {
                throw new Error('No tiene acceso a la cuenta de origen');
            }
            
            // Solo el propietario puede hacer transferencias
            if (participanteOrigen.rol !== 'Propietario' && cuentaOrigen.propietario.toString() !== userId.toString()) {
                throw new Error('Solo el propietario puede realizar transferencias');
            }
            
            // Verificar acceso del usuario a cuenta destino
            const participanteDestino = await SWParticipante.findOne({
                cuenta: cuentaDestinoId,
                usuario: userId,
                activo: true
            }).session(session);
            
            if (!participanteDestino) {
                throw new Error('No tiene acceso a la cuenta de destino');
            }
        }
        
        // Validar saldo suficiente
        await cuentaOrigen.calcularSaldo();
        if (cuentaOrigen.saldoActual < monto) {
            throw new Error(`Saldo insuficiente en cuenta origen. Disponible: ${cuentaOrigen.saldoActual} ${cuentaOrigen.moneda}`);
        }
        
        const fecha = new Date();
        
        // Crear transacción de salida (Gasto) en cuenta origen
        const transaccionOrigen = new this({
            cuenta: cuentaOrigenId,
            tipo: 'Transferencia',
            monto,
            concepto: concepto || `Transferencia a ${cuentaDestino.nombre}`,
            descripcion,
            categoria: 'Transferencia',
            fecha,
            creadoPor: userId,
            aprobada: true,
            aprobadaPor: userId,
            fechaAprobacion: fecha,
            cuentaDestino: cuentaDestinoId,
            esProveedorExterno: Boolean(proveedorData),
            proveedor: proveedorData
        });
        
        // Crear transacción de entrada (Ingreso) en cuenta destino
        const transaccionDestino = new this({
            cuenta: cuentaDestinoId,
            tipo: 'Transferencia',
            monto,
            concepto: concepto || `Transferencia desde ${cuentaOrigen.nombre}`,
            descripcion,
            categoria: 'Transferencia',
            fecha,
            creadoPor: userId,
            aprobada: true,
            aprobadaPor: userId,
            fechaAprobacion: fecha,
            esProveedorExterno: Boolean(proveedorData),
            proveedor: proveedorData
        });
        
        // Guardar ambas transacciones para obtener sus IDs
        await transaccionOrigen.save({ session });
        await transaccionDestino.save({ session });
        
        // Vincular las transacciones
        transaccionOrigen.transferenciaVinculada = transaccionDestino._id;
        transaccionDestino.transferenciaVinculada = transaccionOrigen._id;
        
        await transaccionOrigen.save({ session });
        await transaccionDestino.save({ session });
        
        // Actualizar saldos
        await cuentaOrigen.calcularSaldo();
        await cuentaDestino.calcularSaldo();
        await cuentaOrigen.save({ session });
        await cuentaDestino.save({ session });
        
        await session.commitTransaction();
        
        return {
            origen: transaccionOrigen,
            destino: transaccionDestino
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const SWTransaccion = mongoose.model('SWTransaccion', swTransaccionSchema);

module.exports = SWTransaccion;
