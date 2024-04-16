const { Schema, model } = require('mongoose');

const preSchema = new Schema({
    habitaciones: {
        type: String,
<<<<<<< HEAD
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
=======
        unique: true,
        },
    habitaciones: String,
    title: String,
    ocupacion_max: String,

    precio_base: {
        type: Number
>>>>>>> d787274b362d94bdcca4e08a4663192234aedbef
    }
});

const habitacionesSchema = new Schema({
    resources: [preSchema],
});

module.exports = model('habitaciones', habitacionesSchema);
