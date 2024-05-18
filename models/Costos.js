const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const costSchema = new Schema({
    costName: {
        type: String, 
        required: true,
        unique: true,
    },
    category: {
        type: String,
        enum: ['Dueño', 'Gerente', 'Vendedor'],
        required: true
    },
    commission: {
        type: String,
        enum: ['Aumento porcentual', 'Aumento por costo fijo'],
        required: true
    },
    amount: {
        type: Number,
        default: 0
    },
    minAmount: {
        type: Number,
        default: 0
    },
    maxAmount: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Costo', costSchema);
