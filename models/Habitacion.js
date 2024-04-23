const { Schema, model } = require('mongoose');

const preSchema = new Schema({
    habitaciones: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true,
    },
    ocupacion_max: {
        type: Number,
        required: true,
    },
    location: {
        type: String,
        required: true,
    },
    precio_base: {
        type: Number,
        required: true
    },
    precio_base_2noches: {
        type: Number
    },
    costo_base: {
        type: Number
    },
    costo_base_2noches: {
        type: Number
    }
});

const habitacionesSchema = new Schema({
    resources: [preSchema],
});

module.exports = model('habitaciones', habitacionesSchema);
