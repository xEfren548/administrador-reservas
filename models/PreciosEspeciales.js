const { Schema, model } = require('mongoose');

// Definición del esquema de precio_base_x_dia
const precioEspecialSchema = new Schema({
    precio_modificado: {
        type: Number,
        required: true
    },
    precio_base_2noches: {
        type: Number,
        required: true
    },
    costo_base: {
        type: Number,
        required: true
    },
    costo_base_2noches: {
        type: Number,
        required: true
    },
    criterio: {
        type: String,
    },
    noPersonas: {
        type: Number
    },
    habitacionId: {
        type: Schema.Types.ObjectId,
        ref: 'habitaciones' // Referencia al modelo de habitaciones existente
    }
});

// Modelo de precio_base_x_dia
const PreciosEspeciales = model('PreciosEspeciales', precioEspecialSchema);

module.exports = PreciosEspeciales;
