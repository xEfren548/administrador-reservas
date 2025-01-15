const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reservaSchema = new Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
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
    pax: {
        type: Number,
    },
    nNights: {
        type: Number,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    total: {
        type: Number,
    },
    discount: {
        type: Number,
        //required: true
    },
    notes: [{texto: String}],
    privateNotes: [{texto: String}],
    termsAccepted: {
        type: Boolean,
        default: false
    },
    madeCheckIn: {
        type: Boolean,
        default: false
    },
    surveySubmited: {
        type: Boolean,
        default: false
    },
    isDeposit: {
        type: Boolean,
        default: false
    },
    paymentCancelation: {
        type: Date
    },
    status: {
        type: String,
        enum: ["active", "playground", "cancelled", "pending", "reserva de dueño", "no-show"],
        required: true,
        default: "pending"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    clienteProvisional: {
        type: "String"
    },
    comisionVendedor: {
        type: Number
    },
    thanksSent: {
        type: Boolean,
        default: false
    }
});

// const documentSchema = new Schema({
//     events: [reservaSchema]
// });

module.exports = mongoose.model('Documento', reservaSchema);