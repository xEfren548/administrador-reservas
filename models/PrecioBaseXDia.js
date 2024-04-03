const { Schema, model } = require('mongoose');

// Definición del esquema de precio_base_x_dia
const precioBaseSchema = new Schema({
    precio_base: {
        type: Number,
        required: true
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    habitacion: {
        type: Schema.Types.ObjectId,
        ref: 'habitaciones' // Referencia al modelo de habitaciones existente
    }
});

// Modelo de precio_base_x_dia
const PrecioBase = model('precio_base_x_dia', precioBaseSchema);

module.exports = PrecioBase;
