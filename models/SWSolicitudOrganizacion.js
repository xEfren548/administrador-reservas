const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
    rolSolicitante: {
        type: String,
        enum: ['Administrador', 'Miembro'],
        required: true
    },
    estado: {
        type: String,
        enum: ['Pendiente', 'Aprobada', 'Rechazada', 'Cancelada'],
        default: 'Pendiente',
        required: true
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

swSolicitudOrganizacionSchema.methods.aprobar = async function(usuarioId, comentario = '') {
    if (this.estado !== 'Pendiente') {
        throw new Error('Solo se pueden aprobar solicitudes pendientes');
    }

    const SWTransaccion = mongoose.model('SWTransaccion');
    const SWCuenta = mongoose.model('SWCuenta');
    let transaccion;

    if (this.tipo === 'Transferencia') {
        if (!this.cuentaDestino) {
            throw new Error('La cuenta destino es requerida para transferencias');
        }

        const resultado = await SWTransaccion.crearTransferencia(
            this.cuenta,
            this.cuentaDestino,
            this.monto,
            this.concepto,
            this.descripcion,
            usuarioId,
            true
        );

        transaccion = resultado.origen;

        await SWTransaccion.updateOne(
            { _id: resultado.origen._id },
            { aprobadaPor: usuarioId }
        );

        await SWTransaccion.updateOne(
            { _id: resultado.destino._id },
            { aprobadaPor: usuarioId }
        );

        const cuentaOrigen = await SWCuenta.findById(this.cuenta);
        const cuentaDestino = await SWCuenta.findById(this.cuentaDestino);

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
            imagenes: this.imagenes,
            etiquetas: this.etiquetas,
            notas: this.notas
        });

        await transaccion.save();

        const cuenta = await SWCuenta.findById(this.cuenta);
        if (cuenta) {
            await cuenta.calcularSaldo();
            await cuenta.save();
        }
    }

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
