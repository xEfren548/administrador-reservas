const { Schema, model } = require('mongoose');

const rackServiciosSchema = new Schema({
    id_reserva: {
        type: Schema.Types.ObjectId,
        ref: 'documentos',
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
    }
    
});

const RackServicios = model('rackservicios', rackServiciosSchema);


module.exports = RackServicios;