const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const utilidadesSchema = new Schema({
    monto: {
        type: Number, 
        required: true,
    },
    concepto: {
        type: String,
        required: true
    },
    fecha: {
        type: Date,
        required: true
    },
    idUsuario: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Usuario'
    },
    idReserva: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evento'
    },
    idServicio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Servicio'
    },
    status: {
        type: String,
        enum: ['aplicado', 'pendiente'],
        default: 'pendiente'
    }
});

module.exports = mongoose.model('Utilidades', utilidadesSchema);
