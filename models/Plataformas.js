const mongoose = require('mongoose');

const PlataformaSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        unique: true,
    },
    descripcion: {
        type: String,
        required: true
    },
    aumentoPorcentaje: {
        type: Number,
        required: true
    },
    activo: {
        type: Boolean,
        required: true
    }
});

module.exports = mongoose.model('Plataformas', PlataformaSchema);