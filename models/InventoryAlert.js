const mongoose = require('mongoose');

const inventoryAlertSchema = new mongoose.Schema({
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
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryItem',
        required: true
    },
    alertType: {
        type: String,
        enum: ['low_stock', 'insufficient_stock_checkout'],
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'resolved'],
        default: 'open'
    },
    message: {
        type: String,
        required: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Documento',
        default: null
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    resolvedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

inventoryAlertSchema.index({ status: 1, alertType: 1, generatedAt: -1 });
inventoryAlertSchema.index({ warehouse: 1, status: 1, generatedAt: -1 });

module.exports = mongoose.model('InventoryAlert', inventoryAlertSchema);
