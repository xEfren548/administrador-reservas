const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const swCategoriaFinancieraConfigSchema = new Schema({
    clave: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    categorias: [{
        type: String,
        trim: true
    }]
}, {
    timestamps: true
});

const SWCategoriaFinancieraConfig = mongoose.model('SWCategoriaFinancieraConfig', swCategoriaFinancieraConfigSchema);

module.exports = SWCategoriaFinancieraConfig;