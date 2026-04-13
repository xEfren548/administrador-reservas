const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryItem',
        required: true
    },
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
    movementType: {
        type: String,
        enum: ['purchase_entry', 'checkout_exit', 'manual_adjustment_in', 'manual_adjustment_out', 'merma', 'transfer_in', 'transfer_out'],
        required: true
    },
    balanceScope: {
        type: String,
        enum: ['warehouse', 'room'],
        default: 'warehouse'
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    unitCost: {
        type: Number,
        default: 0,
        min: 0
    },
    totalCost: {
        type: Number,
        default: 0,
        min: 0
    },
    stockBefore: {
        type: Number,
        required: true,
        min: 0
    },
    stockAfter: {
        type: Number,
        required: true,
        min: 0
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Documento',
        default: null
    },
    note: {
        type: String,
        default: ''
    },
    idempotencyKey: {
        type: String,
        default: undefined,
        trim: true
    },
    operationKey: {
        type: String,
        default: '',
        trim: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    }
}, {
    timestamps: true
});

inventoryMovementSchema.index({ item: 1, createdAt: -1 });
inventoryMovementSchema.index({ warehouse: 1, createdAt: -1 });
inventoryMovementSchema.index({ cabin: 1, balanceScope: 1, createdAt: -1 });
inventoryMovementSchema.index({ event: 1, movementType: 1 });
inventoryMovementSchema.index({ operationKey: 1, createdAt: -1 });
inventoryMovementSchema.index(
    { idempotencyKey: 1 },
    {
        name: 'idempotencyKey_1',
        unique: true,
        partialFilterExpression: {
            idempotencyKey: { $type: 'string' }
        }
    }
);

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);
