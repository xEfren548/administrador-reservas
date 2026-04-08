const mongoose = require('mongoose');

const purchaseLineSchema = new mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryItem',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0.0001
    },
    unitCost: {
        type: Number,
        required: true,
        min: 0
    },
    totalCost: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const inventoryPurchaseSchema = new mongoose.Schema({
    warehouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryWarehouse',
        default: null,
        required: true
    },
    cabin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'habitaciones',
        default: null
    },
    supplier: {
        type: String,
        default: ''
    },
    invoiceNumber: {
        type: String,
        default: ''
    },
    purchaseDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    lines: {
        type: [purchaseLineSchema],
        validate: {
            validator: (lines) => Array.isArray(lines) && lines.length > 0,
            message: 'At least one line is required for purchase'
        }
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    }
}, {
    timestamps: true
});

inventoryPurchaseSchema.index({ warehouse: 1, purchaseDate: -1 });

module.exports = mongoose.model('InventoryPurchase', inventoryPurchaseSchema);
