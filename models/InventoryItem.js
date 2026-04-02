const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        set: (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value
    },
    description: {
        type: String,
        default: ''
    },
    itemType: {
        type: String,
        enum: ['directo', 'indirecto', 'no_consumible'],
        required: true
    },
    unit: {
        type: String,
        required: true,
        trim: true
    },
    stockCurrent: {
        type: Number,
        default: 0,
        min: 0
    },
    stockMin: {
        type: Number,
        default: 0,
        min: 0
    },
    lastPurchaseUnitCost: {
        type: Number,
        default: 0,
        min: 0
    },
    cabin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'habitaciones',
        default: null
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

inventoryItemSchema.index({ cabin: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
