const mongoose = require('mongoose');

const bomLineSchema = new mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryItem',
        required: true
    },
    quantityPerNight: {
        type: Number,
        required: true,
        min: 0
    },
    useFactor: {
        type: Number,
        default: 1,
        min: 0
    },
    notes: {
        type: String,
        default: ''
    }
}, { _id: false });

const inventoryBOMTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    scopeType: {
        type: String,
        enum: ['cabana', 'grupo'],
        required: true
    },
    cabin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'habitaciones',
        default: null
    },
    roomGroup: {
        type: String,
        default: null,
        trim: true
    },
    lines: {
        type: [bomLineSchema],
        default: []
    },
    active: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    }
}, {
    timestamps: true
});

inventoryBOMTemplateSchema.index({ scopeType: 1, cabin: 1, roomGroup: 1, active: 1 });

module.exports = mongoose.model('InventoryBOMTemplate', inventoryBOMTemplateSchema);
