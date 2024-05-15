const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reservaSchema = new Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Cliente'
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Habitacion'
    },
    reservationDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    arrivalDate: {
        type: Date,
        required: true
    },
    departureDate: {
        type: Date,
        required: true
    },
    maxOccupation: {
        type: Number,
        required: true
    },
    nNights: {
        type: Number,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    units: {
        type: String,
        required: true
    },
    total: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        required: true
    },
    notes: [{texto: String}],        
    termsAccepted: {
        type: Boolean,
        required: true,
        default: false
    }
});

const documentSchema = new Schema({
    events: [reservaSchema]
});

module.exports = mongoose.model('Documento', documentSchema);