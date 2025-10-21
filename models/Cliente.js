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
        unique: true,
        sparse: true
    },
    identificationType: {
        type: String,
        enum: ['INE', 'Pasaporte', 'Licencia de conducir'],
    },
    identificationNumber: {
        type: String
    },
    // Campos para relacionar con ClienteWeb
    clienteWebId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClienteWeb',
        default: null
    },
    isWebClient: {
        type: Boolean,
        default: false
    }
},{timestamps: true});

const Client = mongoose.model('Cliente', clientSchema);

module.exports = Client;
