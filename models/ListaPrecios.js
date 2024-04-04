const { Schema, model } = require('mongoose');

// Definición del esquema de precio_base_x_dia
const precioBaseSchema = new Schema({
    nuevo_precio: {
        type: Number,
        required: true
    },
    fechaInicio: {
        type: Date,
        
    },
    fechaFinal: {
        type: Date,
    },
    habitacion: {
        type: Schema.Types.ObjectId,
        ref: 'habitaciones' // Referencia al modelo de habitaciones existente
    }
});

// Modelo de precio_base_x_dia
const PrecioBase = model('ListaDePrecios', precioBaseSchema);

module.exports = PrecioBase;
