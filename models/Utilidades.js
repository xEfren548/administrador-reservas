const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const utilidadesSchema = new Schema({
    monto: {
        type: Number, 
        required: true,
    },
    concepto: {
        type: String,
        required: true
    },
    fecha: {
        type: Date,
        required: true
    },
    idUsuario: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Usuario'
    }
});

module.exports = mongoose.model('Utilidades', utilidadesSchema);
