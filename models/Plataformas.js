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
        validate: {
            validator: function (value) {
                // Solo válido si aumentoPorcentual no está definido
                return this.aumentoPorcentual === null || this.aumentoPorcentual === undefined;
            },
            message: "No se puede definir un aumento fijo y un aumento porcentual al mismo tiempo.",
        },
    },
    aumentoPorcentual: {
        type: Number,
        default: null, // No es obligatorio
        validate: {
            validator: function (value) {
                // Solo válido si aumentoFijo no está definido
                return this.aumentoFijo === null || this.aumentoFijo === undefined;
            },
            message: "No se puede definir un aumento porcentual y un aumento fijo al mismo tiempo.",
        },
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