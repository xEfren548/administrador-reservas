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
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Usuario'
    },
    serviceManager: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Usuario'
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
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Usuario'
    },
    secondCommission: {
        type: Number,
        required: true
    },
    secondUser: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Usuario'
    },
    finalPrice: {
        type: Number,
        required: true
    }
});

const Service = mongoose.model('Servicio', serviceSchema);

module.exports = Service;
