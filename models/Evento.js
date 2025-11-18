const { check } = require("express-validator");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const channelsSchema = new Schema({
    ota_name: { type: String, required: false },
    propertyId: { type: String, required: false },
    listingId: { type: String, required: false },
    channelId: { type: String, required: false },
    bookingId: { type: String, required: false }
});

const infoReservaExternaSchema = new Schema({
    plataforma: { 
        type: String, 
        enum: ['Airbnb', 'Booking', 'Directo', 'WhatsApp', 'Facebook', 'Instagram', 'Otro'],
        default: null 
    },
    precioExternoNoche: { type: Number, default: null },
    precioExternoTotal: { type: Number, default: null },
    metodoCobro: { 
        type: String, 
        enum: ['Efectivo', 'Transferencia', 'Tarjeta', 'PayPal', 'Otro'],
        default: null 
    },
    estadoPago: { 
        type: String, 
        enum: ['Pendiente', 'Pagado', 'Parcial'],
        default: 'Pendiente' 
    },
    montoPagado: { type: Number, default: 0 },
    fechaPago: { type: Date, default: null },
    comisionPlataforma: { type: Number, default: 0 },
    gananciaNetaDueno: { type: Number, default: 0 }
});

const reservaSchema = new Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cliente'
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'habitaciones'
    },
    reservationDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    arrivalDate: {
        type: Date,
        required: true
    },
    departureDate: {
        type: Date,
        required: true
    },
    maxOccupation: {
        type: Number,
        required: true
    },
    pax: {
        type: Number,
    },
    nNights: {
        type: Number,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    total: {
        type: Number,
    },
    discount: {
        type: Number,
        //required: true
    },
    notes: [{ texto: String }],
    privateNotes: [{ texto: String }],
    termsAccepted: {
        type: Boolean,
        default: false
    },
    madeCheckIn: {
        type: Boolean,
        default: false
    },
    surveySubmited: {
        type: Boolean,
        default: false
    },
    isDeposit: {
        type: Boolean,
        default: false
    },
    paymentCancelation: {
        type: Date
    },
    status: {
        type: String,
        enum: ["active", "playground", "cancelled", "pending", "reserva de dueño", "no-show"],
        required: true,
        default: "pending"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    clienteProvisional: {
        type: "String"
    },
    comisionVendedor: {
        type: Number
    },
    thanksSent: {
        type: Boolean,
        default: false
    },
    checkInSent: {
        type: Boolean,
        default: false
    },
    channels: channelsSchema,

    // NUEVOS CAMPOS PARA RESERVAS EXTERNAS
    tipoReserva: {
        type: String,
        enum: ['nyn-hoteles', 'reserva-dueno', 'reserva-externa'],
        default: 'nyn-hoteles',
        required: true
    },
    esReservaExterna: {
        type: Boolean,
        default: false
    },
    infoReservaExterna: infoReservaExternaSchema,
    // Integracion OpenPay
    currency: { type: String, default: "MXN" },
    paymentStatus: {
        type: String,
        enum: ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUND_PENDING", "REFUNDED", "CHARGEBACK"],
        default: "UNPAID"
    },
    balanceDue: { type: Number, default: 0 },
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
    // Campo para identificar reservas hechas por clientes web
    isWebClientReservation: {
        type: Boolean,
        default: false
    }
});

// Middleware pre-save para calcular automáticamente valores de reservas externas
reservaSchema.pre('save', function(next) {
    if (this.tipoReserva === 'reserva-externa' && this.infoReservaExterna) {
        const info = this.infoReservaExterna;
        
        // Calcular precio total si no existe
        if (info.precioExternoNoche && this.nNights && !info.precioExternoTotal) {
            info.precioExternoTotal = info.precioExternoNoche * this.nNights;
        }
        
        // Calcular ganancia neta del dueño
        if (info.precioExternoTotal) {
            info.gananciaNetaDueno = info.precioExternoTotal - (info.comisionPlataforma || 0);
        }
        
        this.esReservaExterna = true;
        this.total = info.precioExternoTotal || 0;
    }
    
    next();
});

reservaSchema.methods.recalcBalance = async function () {
    await this.populate('payments');
    const paid = this.payments
        .filter(p => p.status === 'SUCCEEDED')
        .reduce((sum, p) => sum + (p.capturedAmountMx || 0), 0);

    const total = Number(this.total || 0);
    this.balanceDue = Math.max(total - paid, 0);
    this.paymentStatus = paid === 0 ? 'UNPAID' : (paid < total ? 'PARTIALLY_PAID' : 'PAID');
    return this.save();
};


// const documentSchema = new Schema({
//     events: [reservaSchema]
// });

module.exports = mongoose.model('Documento', reservaSchema);