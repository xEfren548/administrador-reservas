const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WORKFLOW_VERSION_OWNER_CONFIRMATION = 2;
const ESTADO_PENDIENTE_CONFIRMACION_DUENO = 'PendienteConfirmacionDueno';
const ESTADO_RECHAZADA_DUENO = 'RechazadaPorDueno';

function isWorkflowOwnerConfirmation(solicitud) {
    return Number(solicitud.workflowVersion || 1) >= WORKFLOW_VERSION_OWNER_CONFIRMATION;
}

function obtenerObjetoPlano(valor) {
    if (!valor) {
        return {};
    }

    if (typeof valor.toObject === 'function') {
        return valor.toObject();
    }

    return { ...valor };
}

function construirConfirmacionDueno(actual, cambios) {
    const confirmacionDueno = {
        ...obtenerObjetoPlano(actual),
        ...cambios
    };

    if (!confirmacionDueno.comprobanteConfirmacion) {
        delete confirmacionDueno.comprobanteConfirmacion;
    }

    return confirmacionDueno;
}

async function crearTransaccionDesdeSolicitud(solicitud, usuarioId, comprobanteConfirmacion = null) {
    const SWTransaccion = mongoose.model('SWTransaccion');
    const SWCuenta = mongoose.model('SWCuenta');
    let transaccion;

    if (solicitud.tipo === 'Transferencia') {
        if (!solicitud.cuentaDestino) {
            throw new Error('La cuenta destino es requerida para transferencias');
        }

        const resultado = await SWTransaccion.crearTransferencia(
            solicitud.cuenta,
            solicitud.cuentaDestino,
            solicitud.monto,
            solicitud.concepto,
            solicitud.descripcion,
            usuarioId,
            true,
            {
                esProveedorExterno: solicitud.esProveedorExterno,
                proveedor: solicitud.esProveedorExterno
                    ? {
                        nombre: solicitud.proveedorNombre,
                        beneficiario: solicitud.proveedorBeneficiario,
                        banco: solicitud.proveedorBanco,
                        cuentaClabe: solicitud.proveedorCuentaClabe
                    }
                    : undefined
            }
        );

        transaccion = resultado.origen;

        const update = { aprobadaPor: usuarioId };
        if (comprobanteConfirmacion) {
            update.comprobanteConfirmacion = comprobanteConfirmacion;
        }

        await SWTransaccion.updateOne({ _id: resultado.origen._id }, update);
        await SWTransaccion.updateOne({ _id: resultado.destino._id }, update);

        const cuentaOrigen = await SWCuenta.findById(solicitud.cuenta);
        const cuentaDestino = await SWCuenta.findById(solicitud.cuentaDestino);

        if (cuentaOrigen) {
            await cuentaOrigen.calcularSaldo();
            await cuentaOrigen.save();
        }

        if (cuentaDestino) {
            await cuentaDestino.calcularSaldo();
            await cuentaDestino.save();
        }
    } else {
        transaccion = new SWTransaccion({
            cuenta: solicitud.cuenta,
            tipo: solicitud.tipo,
            monto: solicitud.monto,
            concepto: solicitud.concepto,
            descripcion: solicitud.descripcion,
            categoria: solicitud.categoria,
            fecha: solicitud.fecha,
            creadoPor: solicitud.solicitadoPor,
            aprobada: true,
            aprobadaPor: usuarioId,
            fechaAprobacion: new Date(),
            imagenes: solicitud.imagenes,
            etiquetas: solicitud.etiquetas,
            notas: solicitud.notas,
            esProveedorExterno: solicitud.esProveedorExterno,
            proveedor: solicitud.esProveedorExterno
                ? {
                    nombre: solicitud.proveedorNombre,
                    beneficiario: solicitud.proveedorBeneficiario,
                    banco: solicitud.proveedorBanco,
                    cuentaClabe: solicitud.proveedorCuentaClabe
                }
                : undefined,
            ...(comprobanteConfirmacion ? { comprobanteConfirmacion } : {})
        });

        await transaccion.save();

        const cuenta = await SWCuenta.findById(solicitud.cuenta);
        if (cuenta) {
            await cuenta.calcularSaldo();
            await cuenta.save();
        }
    }

    return transaccion;
}

const swSolicitudOrganizacionSchema = new Schema({
    organizacion: {
        type: Schema.Types.ObjectId,
        ref: 'SWOrganizacion',
        required: true
    },
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
        trim: true,
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
    propietarioCuenta: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    rolSolicitante: {
        type: String,
        enum: ['Administrador', 'Miembro'],
        required: true
    },
    workflowVersion: {
        type: Number
    },
    estado: {
        type: String,
        enum: ['Pendiente', 'PendienteConfirmacionDueno', 'Aprobada', 'Rechazada', 'RechazadaPorDueno', 'Cancelada'],
        default: 'Pendiente',
        required: true
    },
    aprobacionAdministrativa: {
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
        }
    },
    confirmacionDueno: {
        requerida: {
            type: Boolean,
            default: false
        },
        estado: {
            type: String,
            enum: ['Pendiente', 'Confirmada', 'Rechazada']
        },
        confirmadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario'
        },
        fechaConfirmacion: {
            type: Date
        },
        comentario: {
            type: String,
            trim: true
        },
        validacionCompra: {
            type: Boolean,
            default: false
        },
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
    imagenes: [{
        type: String,
        trim: true
    }],
    etiquetas: [{
        type: String,
        trim: true
    }],
    notas: {
        type: String,
        trim: true
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

swSolicitudOrganizacionSchema.index({ organizacion: 1, estado: 1, createdAt: -1 });
swSolicitudOrganizacionSchema.index({ solicitadoPor: 1, estado: 1, createdAt: -1 });
swSolicitudOrganizacionSchema.index({ cuenta: 1, estado: 1, createdAt: -1 });

swSolicitudOrganizacionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

swSolicitudOrganizacionSchema.methods.requiereConfirmacionDueno = function() {
    return isWorkflowOwnerConfirmation(this) && this.confirmacionDueno?.requerida === true;
};

swSolicitudOrganizacionSchema.methods.aprobar = async function(usuarioId, comentario = '') {
    if (this.estado !== 'Pendiente') {
        throw new Error('Solo se pueden aprobar solicitudes pendientes');
    }

    const transaccion = await crearTransaccionDesdeSolicitud(this, usuarioId);

    this.estado = 'Aprobada';
    this.transaccionCreada = transaccion._id;
    this.respuesta = {
        procesadaPor: usuarioId,
        fechaRespuesta: new Date(),
        comentario
    };

    await this.save();

    return transaccion;
};

swSolicitudOrganizacionSchema.methods.aprobarAdministrativamente = async function(usuarioId, comentario = '') {
    if (this.estado !== 'Pendiente') {
        throw new Error('Solo se pueden aprobar solicitudes pendientes');
    }

    this.aprobacionAdministrativa = {
        procesadaPor: usuarioId,
        fechaRespuesta: new Date(),
        comentario
    };
    this.estado = ESTADO_PENDIENTE_CONFIRMACION_DUENO;
    this.confirmacionDueno = construirConfirmacionDueno(this.confirmacionDueno, {
        requerida: true,
        estado: 'Pendiente'
    });

    await this.save();

    return this;
};

swSolicitudOrganizacionSchema.methods.confirmarPorDueno = async function(usuarioId, payload = {}) {
    if (this.estado !== ESTADO_PENDIENTE_CONFIRMACION_DUENO) {
        throw new Error('La solicitud no está pendiente de confirmación del dueño');
    }

    const comentario = payload.comentario || '';
    const validacionCompra = Boolean(payload.validacionCompra);
    const comprobanteConfirmacion = payload.comprobanteConfirmacion || null;

    if (this.esProveedorExterno) {
        if (!validacionCompra) {
            throw new Error('Debes validar la compra antes de confirmar el pago a proveedor');
        }

        if (!comprobanteConfirmacion) {
            throw new Error('Debes subir un comprobante antes de confirmar el pago a proveedor');
        }
    }

    const transaccion = await crearTransaccionDesdeSolicitud(this, usuarioId, comprobanteConfirmacion);

    this.estado = 'Aprobada';
    this.transaccionCreada = transaccion._id;
    this.confirmacionDueno = construirConfirmacionDueno(this.confirmacionDueno, {
        requerida: true,
        estado: 'Confirmada',
        confirmadoPor: usuarioId,
        fechaConfirmacion: new Date(),
        comentario,
        validacionCompra,
        ...(comprobanteConfirmacion ? { comprobanteConfirmacion } : {})
    });
    this.respuesta = {
        procesadaPor: usuarioId,
        fechaRespuesta: new Date(),
        comentario
    };

    await this.save();

    return transaccion;
};

swSolicitudOrganizacionSchema.methods.rechazar = async function(usuarioId, motivoRechazo = '') {
    if (this.estado !== 'Pendiente') {
        throw new Error('Solo se pueden rechazar solicitudes pendientes');
    }

    this.estado = 'Rechazada';
    this.respuesta = {
        procesadaPor: usuarioId,
        fechaRespuesta: new Date(),
        motivoRechazo
    };

    return this.save();
};

swSolicitudOrganizacionSchema.methods.rechazarPorDueno = async function(usuarioId, motivoRechazo = '') {
    if (this.estado !== ESTADO_PENDIENTE_CONFIRMACION_DUENO) {
        throw new Error('La solicitud no está pendiente de confirmación del dueño');
    }

    this.estado = ESTADO_RECHAZADA_DUENO;
    this.confirmacionDueno = construirConfirmacionDueno(this.confirmacionDueno, {
        requerida: true,
        estado: 'Rechazada',
        confirmadoPor: usuarioId,
        fechaConfirmacion: new Date(),
        comentario: motivoRechazo
    });
    this.respuesta = {
        procesadaPor: usuarioId,
        fechaRespuesta: new Date(),
        motivoRechazo
    };

    return this.save();
};

swSolicitudOrganizacionSchema.methods.cancelar = async function(usuarioId) {
    if (this.estado !== 'Pendiente') {
        throw new Error('Solo se pueden cancelar solicitudes pendientes');
    }

    if (this.solicitadoPor.toString() !== usuarioId.toString()) {
        throw new Error('Solo el solicitante puede cancelar la solicitud');
    }

    this.estado = 'Cancelada';
    return this.save();
};

const SWSolicitudOrganizacion = mongoose.model('SWSolicitudOrganizacion', swSolicitudOrganizacionSchema);

module.exports = SWSolicitudOrganizacion;
