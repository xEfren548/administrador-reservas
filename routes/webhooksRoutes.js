// routes/webhooks.routes.js
const router = require('express').Router();
const Payment = require('../models/Payment');
const Reserva = require('../models/Evento');
const WebhookEvent = require('../models/WebhookEvent');

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

// Middleware simple para Basic Auth (opcional)
function checkBasicAuth(req, res, next) {
    const u = process.env.OPENPAY_WEBHOOK_USER;
    const p = process.env.OPENPAY_WEBHOOK_PASS;
    if (!u || !p) return next(); // sin credenciales -> no validar
    const hdr = req.headers.authorization || '';
    const token = hdr.split(' ')[1] || '';
    const decoded = Buffer.from(token, 'base64').toString();
    if (decoded === `${u}:${p}`) return next();
    return res.status(401).send('Unauthorized');
}

router.post('/openpay', checkBasicAuth, async (req, res) => {
    // Openpay puede enviar JSON; asegúrate de tener body-parser json habilitado
    const payload = req.body || {};
    const tx = payload.transaction || {};
    const eventId = String(tx.id || payload.id || Date.now());
    const type = `charge.${(tx.status || 'unknown').toLowerCase()}`;

    try {
        // Idempotencia
        const already = await WebhookEvent.findOne({ eventId });
        if (already?.processedAt) return res.status(200).send('OK');

        const evt = already || await WebhookEvent.create({
            provider: 'openpay',
            eventId,
            type,
            payload
        });

        // Localizar Payment por providerPaymentId u orderId
        const providerPaymentId = tx.id;
        const orderId = tx.order_id;

        let payment = await Payment.findOne({
            $or: [{ providerPaymentId }, { orderId }]
        });

        if (payment) {
            const newStatus = mapStatus(tx.status);
            payment.status = newStatus;
            if (newStatus === 'SUCCEEDED') {
                // Asegura monto capturado
                payment.capturedAmountMx = payment.amountMx;
            } else if (newStatus === 'REFUNDED') {
                // Si llega reembolso, puedes setear capturedAmountMx = 0 o mantenerlo y registrar un Refund aparte
            }
            payment.raw = tx;
            await payment.save();

            // Recalcula reserva
            const reserva = await Reserva.findById(payment.reservation);
            if (reserva) await reserva.recalcBalance();
        }

        evt.processedAt = new Date();
        await evt.save();

        return res.status(200).send('OK');
    } catch (err) {
        await WebhookEvent.findOneAndUpdate(
            { eventId },
            { $inc: { attempts: 1 }, error: String(err) }
        );
        // Openpay reintenta si no ve 2xx, pero mandamos 200 para no duplicar (ya registramos el error)
        return res.status(200).send('OK');
    }
});

module.exports = router;
