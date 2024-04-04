const { Schema, model } = require('mongoose');

const preSchema = new Schema({
    id: {
        type: String,
        unique: true,
        },
    habitaciones: String,
    title: String,
    ocupacion_max: String,
    precio_base: Number
});

const habitacionesSchema = new Schema({
    resources: [preSchema],
});

module.exports = model('habitaciones', habitacionesSchema);
