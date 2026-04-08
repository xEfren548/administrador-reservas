const mongoose = require('mongoose');

const inventoryWarehouseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    cabins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'habitaciones'
    }],
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
    timestamps: true,
    collection: 'inventorymetricgroups'
});

module.exports = mongoose.model('InventoryWarehouse', inventoryWarehouseSchema);