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
    },
    address: {
        type: String,
    },
    email: {
        type: String,
        unique: true
    },
    identificationType: {
        type: String,
        enum: ['INE', 'Pasaporte', 'Licencia de conducir'],
    },
    identificationNumber: {
        type: String,
        unique: true
    }
},{timestamps: true});

const Client = mongoose.model('Cliente', clientSchema);

module.exports = Client;
