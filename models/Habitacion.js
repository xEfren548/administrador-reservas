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
});

const habitacionesSchema = new Schema({
    resources: [preSchema],
});

module.exports = model('habitaciones', habitacionesSchema);
