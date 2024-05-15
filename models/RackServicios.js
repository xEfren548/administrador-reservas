const { Schema, model } = require('mongoose');

const rackServiciosSchema = new Schema({
    id_reserva: {
        type: Schema.Types.ObjectId,
        ref: 'documentos',
        required: true
    },
    id_servicio: {
        type: Schema.Types.ObjectId,
        ref:'servicios',
        required: true
    },
    descripcion: {
        type: String,
        required: true
    },
    fecha: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    nombreHabitacion: {
        type: String
    },
    costo: {
        type: Number,
        required: true
    }
    
});

const RackServicios = model('rackservicios', rackServiciosSchema);


module.exports = RackServicios;