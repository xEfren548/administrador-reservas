const { Schema, model } = require('mongoose');

const preSchema = new Schema({
    id: {
        type: String,
        unique: true,
        },
    habitaciones: String,
    title: String,
});

const habitacionesSchema = new Schema({
    resources: [preSchema],
});

module.exports = model('habitaciones', habitacionesSchema);
