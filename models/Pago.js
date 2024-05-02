const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    fechaPago: {
        type: Date,
        required: true,
    },
    importe: {
        type: Number,
        required: true
    },
    metodoPago: {
        type: String,
        required: true
    },
    codigoOperacion: {
        type: String,
    },
    reservacionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'documentos',
        required: true
    },
    notas: {
        type: String
    }
});

const Pago = mongoose.model('Pagos', paymentSchema);

module.exports = Pago;
