const mongoose = require('mongoose');

// Define schema for date changes within a request
const dateChangeSchema = new mongoose.Schema({
    newArrivalDate: {
        type: Date,
        required: true
    },
    newDepartureDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        default: ''
    }
});

// Define main request schema
const dateChangeRequestSchema = new mongoose.Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cliente',
        required: true
    },
    dateChanges: [dateChangeSchema],
    newPrice: {
        type: Number,
        required: true
    },    
    reservationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evento',
        required: true
    },
    mainReason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pendiente', 'Aprobada', 'Rechazada'],
        default: 'Pendiente'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    },
    rejectionReason: {
        type: String,
        default: ''
    }
});

// Update the updatedAt timestamp on save
dateChangeRequestSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const DateChangeRequest = mongoose.model('Aprobaciones', dateChangeRequestSchema);

module.exports = DateChangeRequest;