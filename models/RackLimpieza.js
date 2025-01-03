const { Schema, model } = require('mongoose');

const rackLimpiezaSchema = new Schema({
    id_reserva: {
        type: Schema.Types.ObjectId,
        ref: 'documentos',
        required: true
    },
    encargadoLimpieza: {
        type: Schema.Types.ObjectId,
        ref: 'usuarios',
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
    checkIn: {
        type: Date
    },
    checkOut: {
        type: Date
    },
    status: {
        type: String,
        required: true
    },
    nombreHabitacion: {
        type: String
    },
    idHabitacion: {
        type: Schema.Types.ObjectId,
        ref: 'habitaciones'
    }
    
});

const RackLimpieza = model('racklimpieza', rackLimpiezaSchema);


module.exports = RackLimpieza;