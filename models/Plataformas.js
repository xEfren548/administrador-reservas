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
    aumentoFijo: {
        type: Number,
        default: null, // No es obligatorio
    },
    aumentoPorcentual: {
        type: Number,
        default: null, // No es obligatorio
    },
});

// Validación adicional para asegurar que al menos uno de los dos campos esté presente
PlataformaSchema.pre("validate", function (next) {
    if (this.aumentoFijo === null && this.aumentoPorcentual === null) {
        this.invalidate("aumentoFijo", "Debe proporcionar un aumento fijo o un aumento porcentual.");
        this.invalidate("aumentoPorcentual", "Debe proporcionar un aumento fijo o un aumento porcentual.");
    }
    next();
});

module.exports = mongoose.model('Plataformas', PlataformaSchema);