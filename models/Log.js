const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    fecha: {
        type: Date,
        required: true,
    },
    idUsuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'usuarios',
        required: true
    },
    type: {
        type: String,
        required: true
    },
    idReserva: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'documentos'
    },
    acciones: {
        type: String,
        required: true
    },
    nombreUsuario: {
        type: String,
        required: true
    }
});

const Log = mongoose.model('Logs', logSchema);

module.exports = Log;
