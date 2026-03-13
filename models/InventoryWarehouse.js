const mongoose = require('mongoose');

const inventoryWarehouseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    bankName: {
        type: String,
        required: true,
        trim: true,
        default: 'Principal'
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

inventoryWarehouseSchema.index({ scopeType: 1, cabin: 1, roomGroup: 1, bankName: 1 }, { unique: true });

module.exports = mongoose.model('InventoryWarehouse', inventoryWarehouseSchema);
