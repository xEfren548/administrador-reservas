const { Schema, model } = require('mongoose');

const bloqueoFechasSchema = new Schema({
    date: {
        type: Date,
        required: true
    },
    habitacionId: {
        type: Schema.Types.ObjectId,
        ref: 'habitaciones' // Referencia al modelo de habitaciones existente
    },
});

// Modelo de precio_base_x_dia
const BloqueoInversionistas = model('BloqueoInversionistas', bloqueoFechasSchema);

module.exports = BloqueoInversionistas;
