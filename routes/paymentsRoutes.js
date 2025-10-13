// routes/payments.routes.js
const router = require('express').Router();
const openpay = require('../lib/openpay');
const Payment = require('../models/Payment');
const Reserva = require('../models/Evento');

// Mapea estados Openpay -> nuestros estados
function mapStatus(s) {
    const st = String(s || '').toUpperCase();
    if (st === 'COMPLETED') return 'SUCCEEDED';
    if (st === 'IN_PROGRESS' || st === 'CHARGE_PENDING') return 'IN_PROGRESS';
    if (st === 'CANCELLED') return 'CANCELED';
    if (st === 'REFUNDED') return 'REFUNDED';
    if (st.startsWith('CHARGEBACK')) return 'CHARGEBACK';
    if (st === 'FAILED') return 'FAILED';
    return 'PENDING';
}

// POST /api/payments/charge
// body: { reservationId, method: 'card'|'bank_account'|'store', token_id?, device_session_id?, customerData? }
router.post('/charge', async (req, res) => {
    try {
        // todo 
        // La solicitud llega a este endpoint desde el frontend web cliente
        // El problema es que está buscando una reserva que aun no existe, entonces
        // falta crear la lógica de reservación + pago en un solo flujo.
        // Tambien faltan mapear los errores de Openpay a respuestas HTTP adecuadas.
        const { reservationId, method, token_id, device_session_id, customerData } = req.body;
        console.log('Payment charge request:', { reservationId, method, token_id, device_session_id, customerData });
        if (!reservationId || !method) return res.status(400).json({ error: 'reservationId y method son requeridos' });

        const reserva = await Reserva.findById(reservationId);
        if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

        const amountMx = Number(reserva.total || 0);
        if (!amountMx || amountMx <= 0) return res.status(400).json({ error: 'Monto inválido en la reserva' });

        const orderId = `res_${reserva._id}_${Math.floor(Date.now() / 1000)}`;

        // Idempotencia “casera”: si existe Payment con orderId, responde ese
        const existing = await Payment.findOne({ orderId });
        if (existing) return res.json({ ok: true, reused: true, paymentId: existing._id, status: existing.status });

        // Construir request
        const chargeReq = {
            amount: amountMx,
            currency: 'MXN',
            description: `Reserva ${reserva._id}`,
            order_id: orderId,
            method, // 'card' | 'bank_account' (SPEI) | 'store'
            customer: {
                name: customerData?.name,
                last_name: customerData?.last_name,
                email: customerData?.email,
                phone_number: customerData?.phone
            }
        };

        if (method === 'card') {
            if (!token_id || !device_session_id) {
                return res.status(400).json({ error: 'Para método card requiere token_id y device_session_id' });
            }
            chargeReq.source_id = token_id;
            chargeReq.device_session_id = device_session_id;
        }

        // Ejecutar cargo
        openpay.charges.create(chargeReq, async (error, charge /*, response */) => {
            if (error) {
                // Devuelve el error de Openpay con contexto
                return res.status(400).json({ error: 'Openpay error', detail: error });
            }

            const status = mapStatus(charge.status);

            const payment = await Payment.create({
                reservation: reserva._id,
                providerPaymentId: charge.id,
                orderId,
                method,
                status,
                amountMx,
                capturedAmountMx: status === 'SUCCEEDED' ? amountMx : 0,
                currency: 'MXN',
                paymentMethodData: {
                    brand: charge.card?.brand,
                    last4: charge.card?.last4,
                    holderName: charge.card?.holder_name,
                    type: charge.card?.type || method
                },
                description: charge.description,
                raw: charge
            });

            // Vincular a la reserva y recalcular
            reserva.payments.push(payment._id);
            if (status === 'SUCCEEDED') await reserva.recalcBalance();
            else await reserva.save();

            // Para SPEI/Tienda, devuelve referencias al cliente (vienen en charge)
            return res.json({
                ok: true,
                paymentId: payment._id,
                status: payment.status,
                charge
            });
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Unexpected error', detail: String(e) });
    }
});

module.exports = router;
