const { Schema, model } = require('mongoose');

const bloqueoFechasSchema = new Schema({
    date: {
        type: Date,
        required: true
    },
    description: {
        type: String,
    },
    min: {
        type: Number
    },
    habitacionId: {
        type: Schema.Types.ObjectId,
        ref: 'habitaciones' // Referencia al modelo de habitaciones existente
    },
});

// Modelo de precio_base_x_dia
const BloqueoFechas = model('BloqueoFechas', bloqueoFechasSchema);

module.exports = BloqueoFechas;
