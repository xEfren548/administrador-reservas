const mongoose = require('mongoose');

const inventoryRoomStockSchema = new mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryItem',
        required: true
    },
    warehouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryWarehouse',
        required: true
    },
    cabin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'habitaciones',
        required: true
    },
    stockCurrent: {
        type: Number,
        default: 0,
        min: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    }
}, {
    timestamps: true
});

inventoryRoomStockSchema.index({ item: 1, cabin: 1 }, { unique: true });
inventoryRoomStockSchema.index({ cabin: 1, updatedAt: -1 });
inventoryRoomStockSchema.index({ warehouse: 1, cabin: 1 });

module.exports = mongoose.model('InventoryRoomStock', inventoryRoomStockSchema);