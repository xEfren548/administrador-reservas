const mongoose = require('mongoose');

const PlataformaSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        unique: true,
    },
    descripcion: {
        type: String,
    },
    aumentoPorcentaje: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model('Plataformas', PlataformaSchema);