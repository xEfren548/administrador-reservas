// routes/paymentsRoutes.js
// Migrado de OpenPay a Stripe
const router = require('express').Router();
const moment = require('moment');
const stripe = require('../lib/stripe');
const Payment = require('../models/Payment');
const Pagos = require('../models/Pago');
const Reserva = require('../models/Evento');
const { createReservationForClient, cotizarReserva } = require('../controllers/webClientes/generalController');

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
 * GET /api/payments/config
 * Retorna la clave pública de Stripe para el frontend
 */
router.get('/config', (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const publishableKey = isProduction 
        ? process.env.STRIPE_PUBLISHABLE_KEY 
        : process.env.DEV_STRIPE_PUBLISHABLE_KEY;
    
    res.json({
        publishableKey,
        // Métodos de pago habilitados
        paymentMethods: ['card', 'oxxo'],
        // Porcentaje requerido para reservar (50%)
        depositPercentage: 50
    });
});

/**
 * POST /api/payments/create-payment-intent
 * Crea un PaymentIntent para Stripe Elements
 * El cliente usará este para completar el pago
 * 
 * body: { 
 *   reservationData,
 *   customerData,
 *   clienteWebId?,
 *   paymentMethodTypes?: ['card', 'oxxo'] // opcional, default ['card']
 * }
 */
router.post('/create-payment-intent', async (req, res) => {
    try {
        const { reservationData, customerData, clienteWebId, paymentMethodTypes } = req.body;
        
        console.log('Create PaymentIntent request:', { reservationData, customerData });
        
        if (!reservationData) {
            return res.status(400).json({ error: 'reservationData es requerido' });
        }

        if (!customerData?.email) {
            return res.status(400).json({ error: 'El email del cliente es requerido' });
        }

        const totalAmount = Number(reservationData.pricing?.totalPrice || 0);
        if (!totalAmount || totalAmount <= 0) {
            return res.status(400).json({ error: 'Monto inválido en reservationData.pricing.totalPrice' });
        }

        // Calcular el 50% para el depósito
        const depositAmount = Math.ceil(totalAmount * 0.50);
        const remainingAmount = totalAmount - depositAmount;

        // Validar que la habitación esté disponible en las fechas solicitadas
        const validarDisponibilidadYPrecio = await cotizarReserva(
            reservationData.cabinId, 
            reservationData.checkIn, 
            reservationData.checkOut, 
            reservationData.guests, 
            req
        );
        
        console.log('validarDisponibilidadYPrecio:', validarDisponibilidadYPrecio);

        if (!validarDisponibilidadYPrecio?.success) {
            return res.status(400).json({ 
                error: 'Habitación no disponible en las fechas solicitadas, por favor recarga la página e intenta de nuevo' 
            });
        }

        // Validar que los precios sean los mismos (evitar manipulación)
        if (validarDisponibilidadYPrecio.pricing.totalPrice !== totalAmount) {
            return res.status(400).json({ 
                error: 'El precio ha cambiado, por favor recarga la página e intenta de nuevo' 
            });
        }

        // Generar orderId temporal
        const tempOrderId = `temp_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).substr(2, 5)}`;

        // Idempotencia: si existe Payment con orderId pendiente, retornar ese
        const existing = await Payment.findOne({ 
            orderId: tempOrderId,
            status: { $in: ['PENDING', 'IN_PROGRESS'] }
        });
        if (existing && existing.providerPaymentId) {
            // Recuperar el PaymentIntent existente
            try {
                const existingIntent = await stripe.paymentIntents.retrieve(existing.providerPaymentId);
                return res.json({
                    ok: true,
                    reused: true,
                    clientSecret: existingIntent.client_secret,
                    paymentIntentId: existingIntent.id,
                    depositAmount,
                    remainingAmount,
                    totalAmount
                });
            } catch (e) {
                // Si falla, continuar y crear uno nuevo
                console.log('PaymentIntent existente no válido, creando nuevo...');
            }
        }

        // Buscar o crear cliente en Stripe
        let customer;
        const existingCustomers = await stripe.customers.list({ 
            email: customerData.email, 
            limit: 1 
        });
        
        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
            console.log('Cliente existente encontrado:', customer.id);
            
            // Actualizar datos del cliente si es necesario
            await stripe.customers.update(customer.id, {
                name: `${customerData.name || ''} ${customerData.last_name || ''}`.trim(),
                phone: customerData.phone_number || customerData.phone
            });
        } else {
            customer = await stripe.customers.create({
                name: `${customerData.name || ''} ${customerData.last_name || ''}`.trim(),
                email: customerData.email,
                phone: customerData.phone_number || customerData.phone,
                metadata: {
                    clienteWebId: clienteWebId || ''
                }
            });
            console.log('Cliente nuevo creado:', customer.id);
        }

        // Crear el PaymentIntent con el 50% del total
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(depositAmount * 100), // Stripe usa centavos
            currency: 'mxn',
            customer: customer.id,
            description: `Depósito 50% - Reserva ${reservationData.cabinId} - ${customerData.name || 'Cliente'}`,
            metadata: {
                orderId: tempOrderId,
                reservationData: JSON.stringify({
                    cabinId: reservationData.cabinId,
                    checkIn: reservationData.checkIn,
                    checkOut: reservationData.checkOut,
                    guests: reservationData.guests,
                    totalPrice: totalAmount,
                    depositAmount: depositAmount,
                    remainingAmount: remainingAmount
                }),
                customerData: JSON.stringify({
                    name: customerData.name,
                    last_name: customerData.last_name,
                    email: customerData.email,
                    phone: customerData.phone_number || customerData.phone
                }),
                clienteWebId: clienteWebId || '',
                depositPercentage: '50'
            },
            // Métodos de pago permitidos
            payment_method_types: paymentMethodTypes || ['card'],
            // Para OXXO, necesitamos configuración especial
            payment_method_options: {
                card: {
                    request_three_d_secure: 'automatic'
                },
                oxxo: {
                    expires_after_days: 3 // El voucher expira en 3 días
                }
            }
        });

        console.log('PaymentIntent creado:', paymentIntent.id);

        // Guardar el Payment en estado PENDING
        await Payment.create({
            reservation: null, // Se asignará cuando se confirme el pago
            provider: 'stripe',
            providerPaymentId: paymentIntent.id,
            orderId: tempOrderId,
            method: 'card', // Se actualizará con el método real
            status: 'PENDING',
            amountMx: depositAmount,
            capturedAmountMx: 0,
            currency: 'MXN',
            paymentMethodData: {
                depositPercentage: 50,
                totalAmount: totalAmount,
                remainingAmount: remainingAmount
            },
            description: paymentIntent.description,
            raw: { paymentIntentId: paymentIntent.id }
        });

        return res.json({
            ok: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            customerId: customer.id,
            depositAmount,
            remainingAmount,
            totalAmount,
            orderId: tempOrderId
        });

    } catch (error) {
        console.error('Error creando PaymentIntent:', error);
        return res.status(500).json({ 
            error: 'Error al iniciar el proceso de pago',
            detail: error.message 
        });
    }
});

/**
 * POST /api/payments/confirm-payment
 * Confirma el pago después de que Stripe Elements lo procese
 * Este endpoint se llama después de que el frontend confirme el pago exitoso
 * 
 * body: { 
 *   paymentIntentId,
 *   reservationData,
 *   customerData,
 *   clienteWebId?
 * }
 */
router.post('/confirm-payment', async (req, res) => {
    try {
        const { paymentIntentId, reservationData, customerData, clienteWebId } = req.body;
        
        if (!paymentIntentId) {
            return res.status(400).json({ error: 'paymentIntentId es requerido' });
        }

        console.log('Confirming payment:', paymentIntentId);

        // Obtener el PaymentIntent de Stripe con charges expandidos
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ['payment_method', 'customer', 'latest_charge']
        });

        console.log('PaymentIntent status:', paymentIntent.status);

        const status = mapStripeStatus(paymentIntent.status);

        // Buscar el Payment en nuestra BD
        let payment = await Payment.findOne({ providerPaymentId: paymentIntentId });
        
        if (!payment) {
            return res.status(404).json({ error: 'Payment no encontrado' });
        }

        // Si ya tiene reserva asociada, significa que ya fue procesado
        if (payment.reservation) {
            const reserva = await Reserva.findById(payment.reservation);
            return res.json({
                ok: true,
                alreadyProcessed: true,
                reservationId: payment.reservation,
                paymentId: payment._id,
                status: payment.status,
                reservaFolio: reserva?.folio
            });
        }

        // Extraer metadata
        const metadata = paymentIntent.metadata || {};
        const storedReservationData = metadata.reservationData ? JSON.parse(metadata.reservationData) : {};
        const storedCustomerData = metadata.customerData ? JSON.parse(metadata.customerData) : {};
        
        // Usar reservationData del body si está disponible (tiene datos más completos)
        // El metadata de Stripe tiene límite de caracteres, así que solo guardamos lo esencial
        const fullPricing = reservationData?.pricing || storedReservationData.pricing || {};
        const totalAmount = fullPricing.totalPrice || storedReservationData.totalPrice;
        const depositAmount = paymentIntent.amount / 100; // Convertir de centavos
        const remainingAmount = totalAmount - depositAmount;
        
        // Combinar datos: priorizar los del body sobre los del metadata
        const mergedReservationData = {
            ...storedReservationData,
            ...reservationData,
            pricing: {
                basePrice: fullPricing.basePrice || 0,
                totalPrice: totalAmount,
                cleaningFee: fullPricing.cleaningFee || 0,
                serviceFee: fullPricing.serviceFee || 0,
                comisionServicio: fullPricing.comisionServicio || 0,
                taxes: fullPricing.taxes || 0,
                ...fullPricing
            }
        };
        
        const mergedCustomerData = {
            ...storedCustomerData,
            ...customerData
        };

        // Extraer datos del método de pago desde el charge (más confiable)
        // Los datos de la tarjeta están en charges.data[0].payment_method_details
        // o en latest_charge cuando está expandido
        const latestCharge = paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'object'
            ? paymentIntent.latest_charge 
            : paymentIntent.charges?.data?.[0];
        const paymentMethodDetails = latestCharge?.payment_method_details || {};
        
        // El tipo puede venir del charge o del payment_method expandido
        const paymentMethodType = paymentMethodDetails.type || 
                                  paymentIntent.payment_method?.type || 
                                  paymentIntent.payment_method_types?.[0] || 
                                  'card';
        
        // Para tarjetas, obtener brand y last4 del charge
        const cardDetails = paymentMethodDetails.card || paymentIntent.payment_method?.card || {};
        const cardBrand = cardDetails.brand || paymentMethodType;
        const cardLast4 = cardDetails.last4 || 'N/A';

        // Si el pago fue exitoso o está en progreso, crear la reserva
        if (status === 'SUCCEEDED' || status === 'IN_PROGRESS') {
            const statusReserva = status === 'SUCCEEDED' ? 'active' : 'pending';
            const paymentStatus = 'PARTIALLY_PAID'; // El pago es parcial (50%)
            const balanceDue = remainingAmount; // El resto se paga al llegar

            // Construir guestInfo desde customerData (usar merged)
            const guestInfo = {
                firstName: mergedCustomerData.name || mergedCustomerData.firstName || '',
                lastName: mergedCustomerData.last_name || mergedCustomerData.lastName || '',
                email: mergedCustomerData.email,
                phone: mergedCustomerData.phone_number || mergedCustomerData.phone || '',
                address: mergedCustomerData.address || 'Por definir'
            };

            // Construir reservationData completo para la función (usar merged)
            const fullReservationData = {
                cabinId: mergedReservationData.cabinId,
                checkIn: mergedReservationData.checkIn,
                checkOut: mergedReservationData.checkOut,
                guests: mergedReservationData.guests,
                nights: mergedReservationData.nights || Math.ceil((new Date(mergedReservationData.checkOut) - new Date(mergedReservationData.checkIn)) / (1000 * 60 * 60 * 24)),
                guestInfo: guestInfo,
                pricing: mergedReservationData.pricing,
                ...mergedReservationData
            };

            const nuevaReserva = await createReservationForClient(
                fullReservationData,
                statusReserva,
                paymentStatus,
                balanceDue,
                metadata.clienteWebId || clienteWebId,
                req
            );

            if (!nuevaReserva) {
                return res.status(500).json({ 
                    error: 'Error creando reserva después del pago', 
                    paymentIntentId 
                });
            }

            // Actualizar orderId con el ID real de la reserva
            const finalOrderId = `res_${nuevaReserva._id}_${Math.floor(Date.now() / 1000)}`;

            // Actualizar el Payment
            payment.reservation = nuevaReserva._id;
            payment.orderId = finalOrderId;
            payment.method = mapPaymentMethodType(paymentMethodType);
            payment.status = status;
            payment.capturedAmountMx = status === 'SUCCEEDED' ? depositAmount : 0;
            payment.paymentMethodData = {
                brand: cardBrand,
                last4: cardLast4,
                type: paymentMethodType,
                depositPercentage: 50,
                totalAmount: totalAmount,
                remainingAmount: remainingAmount,
                holderName: mergedCustomerData?.name || 'N/A'
            };
            payment.raw = paymentIntent;
            await payment.save();

            // Crear pago en la tabla Pagos
            const pagos = await new Pagos({
                fechaPago: moment().toDate(),
                importe: depositAmount,
                metodoPago: paymentMethodType === 'oxxo' ? 'OXXO' : 'Pasarela de pago (Stripe)',
                codigoOperacion: paymentIntent.id,
                reservacionId: nuevaReserva._id,
                notas: `Depósito 50% - Pendiente: $${remainingAmount.toFixed(2)} MXN al llegar`
            });
            await pagos.save();

            // Vincular pago a la reserva
            nuevaReserva.payments.push(payment._id);
            nuevaReserva.depositPaid = depositAmount;
            nuevaReserva.balanceDue = remainingAmount;
            await nuevaReserva.save();

            return res.json({
                ok: true,
                reservationId: nuevaReserva._id,
                reservaFolio: nuevaReserva.folio,
                paymentId: payment._id,
                status: payment.status,
                depositPaid: depositAmount,
                remainingAmount: remainingAmount,
                message: `Depósito de $${depositAmount.toFixed(2)} MXN pagado. Pendiente: $${remainingAmount.toFixed(2)} MXN al llegar al alojamiento`
            });

        } else if (status === 'PENDING') {
            // Para OXXO u otros métodos que requieren acción
            payment.status = status;
            payment.method = mapPaymentMethodType(paymentMethodType);
            payment.raw = paymentIntent;
            await payment.save();

            return res.json({
                ok: true,
                pending: true,
                paymentIntentId: paymentIntent.id,
                status: payment.status,
                nextAction: paymentIntent.next_action,
                message: 'Pago pendiente de completar'
            });

        } else {
            // Pago fallido
            payment.status = status;
            payment.method = mapPaymentMethodType(paymentMethodType);
            payment.raw = paymentIntent;
            await payment.save();

            return res.status(402).json({
                ok: false,
                paymentId: payment._id,
                status: payment.status,
                error: 'El pago no fue exitoso'
            });
        }

    } catch (error) {
        console.error('Error confirmando pago:', error);
        return res.status(500).json({ 
            error: 'Error al confirmar el pago',
            detail: error.message 
        });
    }
});

/**
 * POST /api/payments/create-oxxo-payment
 * Crea un pago para OXXO (genera el voucher)
 */
router.post('/create-oxxo-payment', async (req, res) => {
    try {
        const { reservationData, customerData, clienteWebId } = req.body;
        
        if (!reservationData || !customerData?.email) {
            return res.status(400).json({ error: 'reservationData y email son requeridos' });
        }

        const totalAmount = Number(reservationData.pricing?.totalPrice || 0);
        if (!totalAmount || totalAmount <= 0) {
            return res.status(400).json({ error: 'Monto inválido' });
        }

        const depositAmount = Math.ceil(totalAmount * 0.50);
        const remainingAmount = totalAmount - depositAmount;

        // Validar disponibilidad
        const validarDisponibilidadYPrecio = await cotizarReserva(
            reservationData.cabinId, 
            reservationData.checkIn, 
            reservationData.checkOut, 
            reservationData.guests, 
            req
        );

        if (!validarDisponibilidadYPrecio?.success) {
            return res.status(400).json({ 
                error: 'Habitación no disponible en las fechas solicitadas' 
            });
        }

        if (validarDisponibilidadYPrecio.pricing.totalPrice !== totalAmount) {
            return res.status(400).json({ 
                error: 'El precio ha cambiado, por favor recarga la página' 
            });
        }

        const tempOrderId = `oxxo_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).substr(2, 5)}`;

        // Buscar o crear cliente
        let customer;
        const existingCustomers = await stripe.customers.list({ 
            email: customerData.email, 
            limit: 1 
        });
        
        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
        } else {
            customer = await stripe.customers.create({
                name: `${customerData.name || ''} ${customerData.last_name || ''}`.trim(),
                email: customerData.email,
                phone: customerData.phone_number || customerData.phone
            });
        }

        // Crear PaymentIntent para OXXO
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(depositAmount * 100),
            currency: 'mxn',
            customer: customer.id,
            payment_method_types: ['oxxo'],
            payment_method_options: {
                oxxo: {
                    expires_after_days: 3
                }
            },
            description: `Depósito 50% OXXO - Reserva ${reservationData.cabinId}`,
            metadata: {
                orderId: tempOrderId,
                reservationData: JSON.stringify({
                    cabinId: reservationData.cabinId,
                    checkIn: reservationData.checkIn,
                    checkOut: reservationData.checkOut,
                    guests: reservationData.guests,
                    totalPrice: totalAmount,
                    depositAmount: depositAmount,
                    remainingAmount: remainingAmount
                }),
                customerData: JSON.stringify(customerData),
                clienteWebId: clienteWebId || '',
                paymentMethod: 'oxxo'
            }
        });

        // Guardar el Payment
        await Payment.create({
            provider: 'stripe',
            providerPaymentId: paymentIntent.id,
            orderId: tempOrderId,
            method: 'store',
            status: 'PENDING',
            amountMx: depositAmount,
            currency: 'MXN',
            paymentMethodData: {
                type: 'oxxo',
                depositPercentage: 50,
                totalAmount: totalAmount,
                remainingAmount: remainingAmount
            },
            description: paymentIntent.description
        });

        return res.json({
            ok: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            depositAmount,
            remainingAmount,
            totalAmount,
            expiresInDays: 3
        });

    } catch (error) {
        console.error('Error creando pago OXXO:', error);
        return res.status(500).json({ 
            error: 'Error al crear pago OXXO',
            detail: error.message 
        });
    }
});

/**
 * GET /api/payments/:paymentIntentId/status
 * Obtiene el estado actual de un PaymentIntent
 */
router.get('/:paymentIntentId/status', async (req, res) => {
    try {
        const { paymentIntentId } = req.params;

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const payment = await Payment.findOne({ providerPaymentId: paymentIntentId });

        return res.json({
            ok: true,
            status: mapStripeStatus(paymentIntent.status),
            stripeStatus: paymentIntent.status,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            paymentId: payment?._id,
            reservationId: payment?.reservation
        });

    } catch (error) {
        console.error('Error obteniendo estado de pago:', error);
        return res.status(500).json({ 
            error: 'Error al obtener estado del pago',
            detail: error.message 
        });
    }
});

/**
 * POST /api/payments/refund
 * Procesa un reembolso (total o parcial)
 */
router.post('/refund', async (req, res) => {
    try {
        const { paymentIntentId, amount, reason } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ error: 'paymentIntentId es requerido' });
        }

        const refundParams = {
            payment_intent: paymentIntentId,
            reason: reason || 'requested_by_customer'
        };

        // Si se especifica monto, es reembolso parcial
        if (amount) {
            refundParams.amount = Math.round(amount * 100);
        }

        const refund = await stripe.refunds.create(refundParams);

        // Actualizar el Payment
        const payment = await Payment.findOne({ providerPaymentId: paymentIntentId });
        if (payment) {
            if (amount) {
                payment.capturedAmountMx -= amount;
            } else {
                payment.capturedAmountMx = 0;
            }
            payment.status = payment.capturedAmountMx > 0 ? 'SUCCEEDED' : 'REFUNDED';
            payment.raw = { ...payment.raw, lastRefund: refund };
            await payment.save();

            // Recalcular balance de la reserva
            if (payment.reservation) {
                const reserva = await Reserva.findById(payment.reservation);
                if (reserva) {
                    await reserva.recalcBalance();
                }
            }
        }

        return res.json({
            ok: true,
            refundId: refund.id,
            status: refund.status,
            amount: refund.amount / 100
        });

    } catch (error) {
        console.error('Error procesando reembolso:', error);
        return res.status(500).json({ 
            error: 'Error al procesar reembolso',
            detail: error.message 
        });
    }
});

module.exports = router;