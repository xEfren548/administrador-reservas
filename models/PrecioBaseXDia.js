const { Schema, model } = require('mongoose');

// Definición del esquema de precio_base_x_dia
const precioBaseSchema = new Schema({
    precio_modificado: {
        type: Number,
        required: true
    },
    fecha: {
        type: Date,
    },
    habitacionId: {
        type: Schema.Types.ObjectId,
        ref: 'habitaciones' // Referencia al modelo de habitaciones existente
    }
});

// Modelo de precio_base_x_dia
const PrecioBase = model('PrecioBaseXDia', precioBaseSchema);

module.exports = PrecioBase;
