const mongoose = require('mongoose');

const preSchema = new mongoose.Schema({
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
    }
});

const habitacionesSchema = new mongoose.Schema({
    resources: [preSchema],
});

module.exports = mongoose.model('habitaciones', habitacionesSchema);
