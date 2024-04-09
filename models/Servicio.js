const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    service: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
        required: true
    },
    supplier: {
        type: String,
        required: true
    },
    serviceManager: {
        type: String,
        required: true
    },
    basePrice: {
        type: Number,
        required: true
    },
    firstCommission: {
        type: Number,
        required: true
    },
    firstUser: {
        type: String,
        required: true
    },
    secondCommission: {
        type: Number,
        required: true
    },
    secondUser: {
        type: String,
        required: true
    },
    finalPrice: {
        type: Number,
        required: true
    }
});

const Service = mongoose.model('Servicio', serviceSchema);

module.exports = Service;
