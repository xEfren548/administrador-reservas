const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    identificationType: {
        type: String,
        enum: ['INE', 'Pasaporte', 'Licencia de conducir'],
        required: true
    },
    identificationNumber: {
        type: String,
        required: true,
        unique: true
    }
});

const Client = mongoose.model('Cliente', clientSchema);

module.exports = Client;
