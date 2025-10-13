const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Documento', index: true, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },

    provider: { type: String, default: 'openpay' },
    providerPaymentId: { type: String, index: true }, // charge.id
    orderId: { type: String, index: true },           // tu order_id (idempotencia/conciliación)

    method: { type: String, enum: ['card', 'bank_account', 'store'], required: true },
    status: {
        type: String,
        enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'IN_PROGRESS', 'REFUND_PENDING', 'REFUNDED', 'CHARGEBACK'],
        default: 'PENDING'
    },

    amountMx: { type: Number, required: true },       // monto solicitado MXN
    capturedAmountMx: { type: Number, default: 0 },   // monto efectivamente cobrado
    currency: { type: String, default: 'MXN' },

    paymentMethodData: {
        brand: String,     // visa/master/amex
        last4: String,
        holderName: String,
        type: String       // 'credit'|'debit' o 'spei'|'store'
    },

    receiptUrl: String,
    description: String,
    raw: {}              // payload bruto/útil de Openpay
}, { timestamps: true });

PaymentSchema.index({ reservation: 1, status: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
