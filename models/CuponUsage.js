const mongoose = require('mongoose');

const cuponUsageSchema = new mongoose.Schema({
    cupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cupon',
        required: [true, 'La referencia al cupón es requerida']
    },
    reserva: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Documento',
        required: [true, 'La referencia a la reserva es requerida']
    },
    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cliente',
        default: null
    },
    clienteWeb: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClienteWeb',
        default: null
    },
    montoDescuento: {
        type: Number,
        required: [true, 'El monto del descuento es requerido'],
        min: [0, 'El monto del descuento no puede ser negativo']
    },
    montoOriginal: {
        type: Number,
        required: [true, 'El monto original es requerido'],
        min: [0, 'El monto original no puede ser negativo']
    },
    montoFinal: {
        type: Number,
        required: [true, 'El monto final es requerido'],
        min: [0, 'El monto final no puede ser negativo']
    },
    tipoCupon: {
        type: String,
        enum: ['percentage', 'fixed_amount', 'nights_free'],
        required: true
    },
    valorAplicado: {
        type: Number,
        required: true
    },
    fechaUso: {
        type: Date,
        default: Date.now
    },
    habitacion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'habitaciones',
        default: null
    },
    noches: {
        type: Number,
        default: null
    },
    notas: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
    }
}, {
    timestamps: true
});

// Índices para reportes
cuponUsageSchema.index({ cupon: 1, fechaUso: -1 });
cuponUsageSchema.index({ cliente: 1 });
cuponUsageSchema.index({ clienteWeb: 1 });
cuponUsageSchema.index({ reserva: 1 });
cuponUsageSchema.index({ fechaUso: -1 });

module.exports = mongoose.model('CuponUsage', cuponUsageSchema);
