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
        required: true
    }
});

module.exports = mongoose.model('Costo', costSchema);
