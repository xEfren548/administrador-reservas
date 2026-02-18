// routes/webhooks.routes.js
// Migrado de OpenPay a Stripe
const router = require('express').Router();
const stripe = require('../lib/stripe');
const Payment = require('../models/Payment');
const Pagos = require('../models/Pago');
const Reserva = require('../models/Evento');
const WebhookEvent = require('../models/WebhookEvent');
const moment = require('moment');
const { createReservationForClient } = require('../controllers/webClientes/generalController');

// Mapea estados Stripe -> nuestros estados
function mapStripeStatus(status) {
    switch(status) {
        case 'succeeded': 
            return 'SUCCEEDED';
        case 'processing': 
            return 'IN_PROGRESS';
        case 'requires_payment_method':
        case 'requires_confirmation':
        case 'requires_action':
            return 'PENDING';
        case 'canceled':
            return 'CANCELED';
        case 'requires_capture':
            return 'IN_PROGRESS';
        default: 
            return 'FAILED';
    }
}

// Mapea tipos de método de pago Stripe
function mapPaymentMethodType(type) {
    switch(type) {
        case 'card':
            return 'card';
        case 'oxxo':
            return 'store';
        case 'customer_balance':
        case 'bank_transfer':
            return 'bank_account';
        default:
            return type;
    }
}

/**
 * POST /webhooks/stripe
 * Webhook para recibir eventos de Stripe
 * 
 * Eventos que manejamos:
 * - payment_intent.succeeded: Pago completado exitosamente
 * - payment_intent.payment_failed: Pago fallido
 * - payment_intent.canceled: Pago cancelado
 * - charge.refunded: Reembolso procesado
 * - charge.dispute.created: Disputa/Chargeback creado
 */
router.post('/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const isProduction = process.env.NODE_ENV === 'production';
    const webhookSecret = isProduction 
        ? process.env.STRIPE_WEBHOOK_SECRET 
        : process.env.DEV_STRIPE_WEBHOOK_SECRET;
    
    let event;

    try {
        // Verificar la firma del webhook
        // NOTA: req.body debe ser el raw body (Buffer), no JSON parseado
        // Asegúrate de que en index.js el webhook de Stripe use express.raw()
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const eventId = event.id;
    const eventType = event.type;

    console.log(`📩 Stripe Webhook received: ${eventType} (${eventId})`);

    try {
        // Idempotencia: verificar si ya procesamos este evento
        const existingEvent = await WebhookEvent.findOne({ eventId });
        if (existingEvent?.processedAt) {
            console.log(`Event ${eventId} already processed, skipping...`);
            return res.status(200).json({ received: true, skipped: true });
        }

        // Registrar el evento
        const webhookEvent = existingEvent || await WebhookEvent.create({
            provider: 'stripe',
            eventId,
            type: eventType,
            payload: event
        });

        // Procesar según el tipo de evento
        switch (eventType) {
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;

            case 'payment_intent.canceled':
                await handlePaymentIntentCanceled(event.data.object);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event.data.object);
                break;

            case 'charge.dispute.created':
                await handleDisputeCreated(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${eventType}`);
        }

        // Marcar como procesado
        webhookEvent.processedAt = new Date();
        await webhookEvent.save();

        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Error processing webhook:', error);
        
        // Registrar el error pero responder 200 para evitar reintentos
        await WebhookEvent.findOneAndUpdate(
            { eventId },
            { $inc: { attempts: 1 }, error: String(error) }
        );

        return res.status(200).json({ received: true, error: error.message });
    }
});

/**
 * Maneja payment_intent.succeeded
 * Este evento se dispara cuando un pago se completa exitosamente
 * 
 * IMPORTANTE: Para evitar duplicados, el webhook solo crea reservas para:
 * 1. Pagos que no existen en BD (creados externamente)
 * 2. Pagos asíncronos (OXXO) que ya existían pero no tienen reserva después de un delay
 * 
 * Para pagos con tarjeta, el endpoint confirm-payment es quien crea la reserva.
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
    console.log('💰 PaymentIntent succeeded:', paymentIntent.id);

    const metadata = paymentIntent.metadata || {};
    const isAsyncPayment = metadata.paymentMethod === 'oxxo' || 
                           paymentIntent.payment_method_types?.includes('oxxo');

    // Buscar el Payment en nuestra BD
    let payment = await Payment.findOne({ providerPaymentId: paymentIntent.id });

    if (!payment) {
        console.log('Payment not found in DB, creating from webhook...');
        // Si no existe, es un pago externo (Stripe CLI, Dashboard, etc.)
        const depositAmount = paymentIntent.amount / 100;
        
        payment = await Payment.create({
            provider: 'stripe',
            providerPaymentId: paymentIntent.id,
            orderId: metadata.orderId || `webhook_${Date.now()}`,
            method: mapPaymentMethodType(paymentIntent.payment_method_types?.[0] || 'card'),
            status: 'SUCCEEDED',
            amountMx: depositAmount,
            capturedAmountMx: depositAmount,
            currency: 'MXN',
            paymentMethodData: {
                type: paymentIntent.payment_method_types?.[0] || 'card',
                depositPercentage: 50
            },
            raw: paymentIntent
        });
        
        // Si es un pago externo sin metadata de reserva, no hay nada más que hacer
        if (!metadata.reservationData) {
            console.log('ℹ️ External payment without reservation data, skipping reservation creation');
            return;
        }
    }

    // Si ya tiene reserva, solo actualizar estado
    if (payment.reservation) {
        console.log('ℹ️ Payment already has reservation, updating status only');
        payment.status = 'SUCCEEDED';
        payment.capturedAmountMx = paymentIntent.amount / 100;
        payment.raw = paymentIntent;
        await payment.save();

        // Recalcular balance de la reserva
        const reserva = await Reserva.findById(payment.reservation);
        if (reserva) {
            await reserva.recalcBalance();
        }
        return;
    }

    // Para pagos con tarjeta (síncronos), el endpoint confirm-payment maneja la creación
    // Solo esperamos un poco y verificamos de nuevo para evitar race condition
    if (!isAsyncPayment) {
        console.log('ℹ️ Synchronous payment (card) - waiting for confirm-payment endpoint...');
        
        // Esperar 2 segundos para dar tiempo al endpoint confirm-payment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Re-verificar si ya se creó la reserva
        payment = await Payment.findOne({ providerPaymentId: paymentIntent.id });
        if (payment?.reservation) {
            console.log('✅ Reservation already created by confirm-payment endpoint');
            return;
        }
        
        // Si después de esperar aún no hay reserva, es posible que el frontend falló
        // Pero NO creamos la reserva aquí para evitar duplicados
        // El usuario deberá reintentar desde el frontend
        console.log('⚠️ No reservation found after wait - frontend may have failed, not creating from webhook');
        return;
    }

    // Solo para pagos asíncronos (OXXO) creamos la reserva desde el webhook
    console.log('🏪 Async payment (OXXO) - creating reservation from webhook...');
    
    if (!metadata.reservationData) {
        console.log('⚠️ No reservation data in metadata, cannot create reservation');
        return;
    }
    
    try {
        const storedReservationData = JSON.parse(metadata.reservationData);
        const storedCustomerData = metadata.customerData ? JSON.parse(metadata.customerData) : {};
        const storedCuponInfo = payment?.paymentMethodData?.cuponInfo || (() => {
            try {
                return metadata.cuponInfo ? JSON.parse(metadata.cuponInfo) : null;
            } catch (error) {
                console.warn('⚠️ Invalid legacy cuponInfo metadata JSON in webhook:', error.message);
                return null;
            }
        })();
        
        const totalAmount = Number(storedReservationData.totalPrice || 0);
        const totalOriginalAmount = Number(storedReservationData.totalOriginalPrice || totalAmount);
        const depositAmount = paymentIntent.amount / 100;
        const remainingAmount = totalAmount - depositAmount;

        // Construir guestInfo desde customerData
        const guestInfo = {
            firstName: storedCustomerData.name || storedCustomerData.firstName || '',
            lastName: storedCustomerData.last_name || storedCustomerData.lastName || '',
            email: storedCustomerData.email,
            phone: storedCustomerData.phone_number || storedCustomerData.phone || '',
            address: storedCustomerData.address || 'Por definir'
        };

        // Crear la reserva con guestInfo incluido
        const fullReservationData = {
            cabinId: storedReservationData.cabinId,
            checkIn: storedReservationData.checkIn,
            checkOut: storedReservationData.checkOut,
            guests: storedReservationData.guests,
            nights: storedReservationData.nights || Math.ceil((new Date(storedReservationData.checkOut) - new Date(storedReservationData.checkIn)) / (1000 * 60 * 60 * 24)),
            guestInfo: guestInfo,
            pricing: {
                totalPrice: totalAmount,
                totalOriginalPrice: totalOriginalAmount,
                basePrice: Number(storedReservationData.basePrice || 0),
                costoBase: Number(storedReservationData.costoBase || storedReservationData.basePrice || 0),
                totalSinComisiones: Number(storedReservationData.totalSinComisiones || 0),
                comisionServicio: Number(storedReservationData.comisionServicio || 35),
                cuponInfo: storedCuponInfo
            },
            cuponInfo: storedCuponInfo
        };

        const nuevaReserva = await createReservationForClient(
            fullReservationData,
            'active', // Status de reserva
            'PARTIALLY_PAID', // Payment status (50%)
            remainingAmount, // Balance pendiente
            metadata.clienteWebId || null,
            null // No hay request en webhook
        );

        if (nuevaReserva) {
            // Actualizar Payment
            payment.reservation = nuevaReserva._id;
            payment.orderId = `res_${nuevaReserva._id}_${Math.floor(Date.now() / 1000)}`;
            payment.status = 'SUCCEEDED';
            payment.capturedAmountMx = depositAmount;
            payment.paymentMethodData = {
                ...payment.paymentMethodData,
                totalAmount: totalAmount,
                totalOriginalAmount: totalOriginalAmount,
                remainingAmount: remainingAmount
            };
            payment.raw = paymentIntent;
            await payment.save();

            // Crear pago en tabla Pagos
            const pagos = new Pagos({
                fechaPago: moment().toDate(),
                importe: depositAmount,
                metodoPago: 'OXXO',
                codigoOperacion: paymentIntent.id,
                reservacionId: nuevaReserva._id,
                notas: `Depósito 50% (via webhook OXXO) - Pendiente: $${remainingAmount.toFixed(2)} MXN al llegar`
            });
            await pagos.save();

            // Vincular a reserva
            nuevaReserva.payments.push(payment._id);
            nuevaReserva.depositPaid = depositAmount;
            nuevaReserva.balanceDue = remainingAmount;
            await nuevaReserva.save();

            console.log(`✅ Reservation created from webhook (OXXO): ${nuevaReserva._id}`);
        }
    } catch (parseError) {
        console.error('Error parsing metadata or creating reservation:', parseError);
    }
}

/**
 * Maneja payment_intent.payment_failed
 */
async function handlePaymentIntentFailed(paymentIntent) {
    console.log('❌ PaymentIntent failed:', paymentIntent.id);

    const payment = await Payment.findOne({ providerPaymentId: paymentIntent.id });
    
    if (payment) {
        payment.status = 'FAILED';
        payment.raw = paymentIntent;
        await payment.save();
    }
}

/**
 * Maneja payment_intent.canceled
 */
async function handlePaymentIntentCanceled(paymentIntent) {
    console.log('🚫 PaymentIntent canceled:', paymentIntent.id);

    const payment = await Payment.findOne({ providerPaymentId: paymentIntent.id });
    
    if (payment) {
        payment.status = 'CANCELED';
        payment.raw = paymentIntent;
        await payment.save();

        // Si tiene reserva, actualizar estado
        if (payment.reservation) {
            const reserva = await Reserva.findById(payment.reservation);
            if (reserva) {
                reserva.paymentStatus = 'CANCELED';
                await reserva.save();
            }
        }
    }
}

/**
 * Maneja charge.refunded
 */
async function handleChargeRefunded(charge) {
    console.log('💸 Charge refunded:', charge.id);

    // El charge tiene payment_intent
    const paymentIntentId = charge.payment_intent;
    
    const payment = await Payment.findOne({ providerPaymentId: paymentIntentId });
    
    if (payment) {
        const refundedAmount = charge.amount_refunded / 100;
        const originalAmount = charge.amount / 100;
        
        if (refundedAmount >= originalAmount) {
            payment.status = 'REFUNDED';
            payment.capturedAmountMx = 0;
        } else {
            // Reembolso parcial
            payment.capturedAmountMx = originalAmount - refundedAmount;
        }
        
        payment.raw = { ...payment.raw, lastRefund: charge };
        await payment.save();

        // Recalcular balance de la reserva
        if (payment.reservation) {
            const reserva = await Reserva.findById(payment.reservation);
            if (reserva) {
                await reserva.recalcBalance();
            }
        }
    }
}

/**
 * Maneja charge.dispute.created (Chargeback)
 */
async function handleDisputeCreated(dispute) {
    console.log('⚠️ Dispute created:', dispute.id);

    // El dispute tiene el charge
    const chargeId = dispute.charge;
    
    // Buscar el charge para obtener el payment_intent
    try {
        const charge = await stripe.charges.retrieve(chargeId);
        const paymentIntentId = charge.payment_intent;

        const payment = await Payment.findOne({ providerPaymentId: paymentIntentId });
        
        if (payment) {
            payment.status = 'CHARGEBACK';
            payment.raw = { ...payment.raw, dispute };
            await payment.save();

            // Notificar (aquí podrías enviar un email al admin)
            console.log(`⚠️ CHARGEBACK on reservation ${payment.reservation}`);
        }
    } catch (error) {
        console.error('Error handling dispute:', error);
    }
}

// ============================================
// LEGACY: Mantener endpoint de OpenPay por compatibilidad
// (Puedes eliminarlo después de migrar completamente)
// ============================================

function mapOpenPayStatus(s) {
    const st = String(s || '').toUpperCase();
    if (st === 'COMPLETED') return 'SUCCEEDED';
    if (st === 'IN_PROGRESS' || st === 'CHARGE_PENDING') return 'IN_PROGRESS';
    if (st === 'CANCELLED') return 'CANCELED';
    if (st === 'REFUNDED') return 'REFUNDED';
    if (st.startsWith('CHARGEBACK')) return 'CHARGEBACK';
    if (st === 'FAILED') return 'FAILED';
    return 'PENDING';
}

function checkBasicAuth(req, res, next) {
    const u = process.env.OPENPAY_WEBHOOK_USER;
    const p = process.env.OPENPAY_WEBHOOK_PASS;
    if (!u || !p) return next();
    const hdr = req.headers.authorization || '';
    const token = hdr.split(' ')[1] || '';
    const decoded = Buffer.from(token, 'base64').toString();
    if (decoded === `${u}:${p}`) return next();
    return res.status(401).send('Unauthorized');
}

router.post('/openpay', checkBasicAuth, async (req, res) => {
    // Mantener por compatibilidad con pagos antiguos de OpenPay
    const payload = req.body || {};
    const tx = payload.transaction || {};
    const eventId = String(tx.id || payload.id || Date.now());
    const type = `charge.${(tx.status || 'unknown').toLowerCase()}`;

    try {
        const already = await WebhookEvent.findOne({ eventId });
        if (already?.processedAt) return res.status(200).send('OK');

        const evt = already || await WebhookEvent.create({
            provider: 'openpay',
            eventId,
            type,
            payload
        });

        const providerPaymentId = tx.id;
        const orderId = tx.order_id;

        let payment = await Payment.findOne({
            $or: [{ providerPaymentId }, { orderId }]
        });

        if (payment) {
            const newStatus = mapOpenPayStatus(tx.status);
            payment.status = newStatus;
            if (newStatus === 'SUCCEEDED') {
                payment.capturedAmountMx = payment.amountMx;
            }
            payment.raw = tx;
            await payment.save();

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
        return res.status(200).send('OK');
    }
});

module.exports = router;
