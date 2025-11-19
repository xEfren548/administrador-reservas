// routes/payments.routes.js
const router = require('express').Router();
const moment = require('moment');
const openpay = require('../lib/openpay');
const Payment = require('../models/Payment');
const Pagos = require('../models/Pago');
const Reserva = require('../models/Evento');
const { createReservationForClient, cotizarReserva } = require('../controllers/webClientes/generalController');

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
// body: { reservationData, method: 'card'|'bank_account'|'store', token_id?, device_session_id?, customerData? }
router.post('/charge', async (req, res) => {
    try {
        // La solicitud llega a este endpoint desde el frontend web cliente
        // Ahora recibe los datos para crear la reserva + procesar el pago en un solo flujo
        const { reservationData, method, token_id, device_session_id, customerData, clienteWebId } = req.body;
        console.log('Payment charge request:', { reservationData, method, token_id, device_session_id, customerData });
        
        if (!reservationData || !method) {
            return res.status(400).json({ error: 'reservationData y method son requeridos' });
        }

        const amountMx = Number(reservationData.pricing.totalPrice || 0);
        if (!amountMx || amountMx <= 0) {
            return res.status(400).json({ error: 'Monto inválido en reservationData.pricing.totalPrice' });
        }

        // Generar orderId temporal antes de crear la reserva
        const tempOrderId = `temp_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).substr(2, 5)}`;

        // Idempotencia "casera": si existe Payment con orderId, responde ese
        const existing = await Payment.findOne({ orderId: tempOrderId });
        if (existing) {
            return res.json({ ok: true, reused: true, paymentId: existing._id, status: existing.status });
        }

        // Construir request de pago
        // Para cargos directos sin cliente (Without Customer) usando token
        const chargeReq = {
            method: 'card',
            source_id: token_id, // Token de la tarjeta
            amount: amountMx,
            currency: 'MXN',
            description: `Reserva - ${customerData?.name || 'Cliente'} - ${new Date().toISOString()}`,
            order_id: tempOrderId,
            device_session_id: device_session_id,
            customer: {
                name: customerData?.name || 'Cliente',
                last_name: customerData?.last_name || '',
                email: customerData?.email,
                phone_number: customerData?.phone_number || customerData?.phone,
                requires_account: false // Importante: no requiere cuenta de cliente
            }
        };

        // Validación de campos requeridos para tarjeta
        if (method === 'card') {
            if (!token_id || !device_session_id) {
                return res.status(400).json({ error: 'Para método card requiere token_id y device_session_id' });
            }
            // Debug: Verificar que el token es válido
            console.log('Token ID recibido:', token_id);
            console.log('Device Session ID:', device_session_id);
            console.log('Token ID length:', token_id?.length);
            console.log('Token ID type:', typeof token_id);
            
            if (!token_id || token_id === 'undefined' || token_id === 'null' || token_id.trim() === '') {
                return res.status(400).json({ 
                    error: 'Token ID inválido o vacío', 
                    received: { token_id, type: typeof token_id } 
                });
            }
        }

        // Validar que la habitación esté disponible en las fechas solicitadas
        const validarDisponibilidadYPrecio = await cotizarReserva(reservationData.cabinId, reservationData.checkIn, reservationData.checkOut, reservationData.guests, req);
        console.log('validarDisponibilidadYPrecio:', validarDisponibilidadYPrecio);

        // Validar que los precios dados sean los mismos que los actuales (evitar manipulación)
        if (!validarDisponibilidadYPrecio?.success) {
            return res.status(400).json({ error: 'Habitación no disponible en las fechas solicitadas, por favor recarga la página e intenta de nuevo' });
        }

        if (validarDisponibilidadYPrecio.pricing.totalPrice !== amountMx) {
            return res.status(400).json({ error: 'El precio ha cambiado, por favor recarga la página e intenta de nuevo' });
        }

        console.log('Iniciando proceso de pago con OpenPay...');
        console.log('OpenPay Merchant ID:', process.env.DEV_OPENPAY_ID);
        console.log('Token recibido:', token_id);
        console.log('Token length:', token_id?.length);
        console.log('Device Session ID:', device_session_id);
        console.log('Email del cliente:', customerData?.email);
        console.log('Ambiente OpenPay:', process.env.NODE_ENV, 'Sandbox URL:', process.env.DEV_OPENPAY_URL);

        // IMPORTANTE: Validar que el token fue generado para este merchant
        // Los tokens de OpenPay tienen el formato: [merchant_id]_[random_string]
        // Verificar si el merchant ID coincide
        if (!token_id || token_id.length < 10) {
            return res.status(400).json({ 
                error: 'Token inválido o vacío',
                detail: 'El token recibido no tiene el formato esperado' 
            });
        }

        // Paso 1: Buscar o crear cliente en OpenPay
        // Usamos el email como identificador único
        const searchEmail = customerData?.email;
        
        console.log('Buscando cliente existente por email...');
        
        // Intentar obtener lista de clientes (limitada) y buscar por email
        openpay.customers.list({}, (listError, customers) => {
            let existingCustomer = null;
            
            if (!listError && customers && customers.length > 0) {
                existingCustomer = customers.find((c) => c.email === searchEmail);
                if (existingCustomer) {
                    console.log('Cliente existente encontrado:', existingCustomer.id);
                }
            }

            if (existingCustomer) {
                // Cliente existe, proceder a agregar tarjeta y hacer cargo
                processWithExistingCustomer(existingCustomer.id);
            } else {
                // Cliente no existe, crear uno nuevo
                console.log('Cliente no encontrado, creando nuevo cliente...');
                createNewCustomerAndCharge();
            }
        });

        // Función para procesar con cliente existente
        function processWithExistingCustomer(customerId) {
            console.log('Agregando tarjeta a cliente existente:', customerId);
            
            const cardReq = { 
                token_id,
                device_session_id 
            };
            
            openpay.customers.cards.create(customerId, cardReq, (cardError, card) => {
                if (cardError) {
                    console.error('Error agregando tarjeta a cliente existente:', cardError);
                    
                    // Si falla, intentar crear cliente nuevo (puede que el cliente anterior esté corrupto)
                    console.log('Fallback: intentando crear nuevo cliente...');
                    createNewCustomerAndCharge();
                    return;
                }
                
                console.log('Tarjeta agregada exitosamente:', card.id);
                
                // Hacer cargo con el cliente y tarjeta
                makeChargeWithCustomer(customerId, card.id);
            });
        }

        // Función para crear nuevo cliente y hacer cargo
        function createNewCustomerAndCharge() {
            const customerReq = {
                name: customerData?.name || 'Cliente',
                last_name: customerData?.last_name || '',
                email: customerData?.email,
                phone_number: customerData?.phone_number || customerData?.phone,
                requires_account: false
            };
            
            openpay.customers.create(customerReq, (custError, customer) => {
                if (custError) {
                    console.error('Error creando cliente:', custError);
                    return res.status(400).json({ 
                        error: 'Openpay error al crear cliente', 
                        detail: custError 
                    });
                }
                
                console.log('Cliente nuevo creado:', customer.id);
                
                // Agregar tarjeta al nuevo cliente
                const cardReq = { 
                    token_id,
                    device_session_id 
                };
                
                openpay.customers.cards.create(customer.id, cardReq, (cardError, card) => {
                    if (cardError) {
                        console.error('Error agregando tarjeta a nuevo cliente:', cardError);
                        return res.status(400).json({ 
                            error: 'Openpay error al agregar tarjeta', 
                            detail: cardError 
                        });
                    }
                    
                    console.log('Tarjeta agregada a nuevo cliente:', card.id);
                    
                    // Hacer cargo
                    makeChargeWithCustomer(customer.id, card.id);
                });
            });
        }

        // Función para hacer el cargo
        function makeChargeWithCustomer(customerId, cardId) {
            const chargeRequest = {
                method: 'card',
                source_id: cardId,
                amount: amountMx,
                currency: 'MXN',
                description: `Reserva - ${customerData?.name || 'Cliente'} - ${new Date().toISOString()}`,
                order_id: tempOrderId,
                device_session_id: device_session_id
            };
            
            console.log('Procesando cargo:', JSON.stringify(chargeRequest, null, 2));
            
            openpay.customers.charges.create(customerId, chargeRequest, async (chargeError, charge) => {
                if (chargeError) {
                    console.error('Error al procesar cargo:', chargeError);
                    return res.status(400).json({ 
                        error: 'Openpay error al procesar cargo', 
                        detail: chargeError 
                    });
                }
                
                console.log('Cargo procesado exitosamente:', charge.id);
                
                // Procesar el cargo exitoso
                await processSuccessfulCharge(charge, res, customerId);
            });
        }
        
        // Función helper para procesar cargo exitoso (evitar duplicar código)
        async function processSuccessfulCharge(charge, res, openPayCustomerId = null) {

            console.log('Charge processed:', charge);
            console.log('OpenPay Customer ID:', openPayCustomerId);

            const status = mapStatus(charge.status);
            
            try {
                console.log('Charge processed:', charge);
                console.log('Payment model schema:', Payment.schema.paths.paymentMethodData);
                // Si el pago fue exitoso o está en progreso, crear la reserva
                if (status === 'SUCCEEDED' || status === 'IN_PROGRESS' || status === 'PENDING') {
                    
                    // Crear la reserva ahora que el pago se procesó
                    // const nuevaReserva = await createReservationForClient({
                    //     ...reservationData,
                    //     status: status === 'SUCCEEDED' ? 'active' : 'pending',
                    //     paymentStatus: status === 'SUCCEEDED' ? 'PAID' : 'UNPAID',
                    //     balanceDue: status === 'SUCCEEDED' ? 0 : amountMx,
                    //     payments: [] // Se agregará el payment después
                    // });

                    const statusReserva = status === 'SUCCEEDED' ? 'active' : 'pending';
                    const paymentStatus = status === 'SUCCEEDED' ? 'PAID' : 'UNPAID';
                    const balanceDue = status === 'SUCCEEDED' ? 0 : amountMx;

                    const nuevaReserva = await createReservationForClient(
                        reservationData,
                        statusReserva,
                        paymentStatus,
                        balanceDue,
                        clienteWebId, // Pasar el ID del cliente web si está disponible
                        req // Pasar el request para detectar el dominio
                    );

                    if (!nuevaReserva) {
                        return res.status(500).json({ error: error.message || 'Error creando reserva después del pago', chargeId: charge.id });
                    }



                    // Actualizar orderId con el ID real de la reserva
                    const finalOrderId = `res_${nuevaReserva._id}_${Math.floor(Date.now() / 1000)}`;

                    // Preparar datos del método de pago
                    const paymentMethodInfo = {
                        brand: charge.card?.brand || method,
                        last4: charge.card?.card_number ? charge.card.card_number.slice(-4) : 'N/A',
                        holderName: charge.card?.holder_name || customerData?.name || 'N/A',
                        type: charge.card?.type || method
                    };

                    console.log('PaymentMethodInfo prepared:', paymentMethodInfo);

                    // Crear el registro de pago
                    const payment = await Payment.create({
                        reservation: nuevaReserva._id,
                        providerPaymentId: charge.id,
                        orderId: finalOrderId,
                        method,
                        status,
                        amountMx,
                        capturedAmountMx: status === 'SUCCEEDED' ? amountMx : 0,
                        currency: 'MXN',
                        paymentMethodData: paymentMethodInfo,
                        description: charge.description,
                        raw: charge
                    });

                    // Crear pago "ficticio" para relacionar con la reserva
                    
                    const pagos = await new Pagos({
                        fechaPago: moment().toDate(),
                        importe: amountMx,
                        metodoPago: "Pasarela de pago",
                        codigoOperacion: payment.providerPaymentId || '',
                        reservacionId: nuevaReserva._id,
                    });
                    
                    await pagos.save();

                    // Vincular pago a la reserva y recalcular balance
                    nuevaReserva.payments.push(payment._id);
                    if (status === 'SUCCEEDED') {
                        await nuevaReserva.recalcBalance();
                    } else {
                        await nuevaReserva.save();
                    }

                    // Respuesta exitosa con los datos de la reserva y pago
                    return res.json({
                        ok: true,
                        reservationId: nuevaReserva._id,
                        paymentId: payment._id,
                        status: payment.status,
                        charge,
                        message: status === 'SUCCEEDED' ? 'Pago exitoso y reserva creada' : 'Pago en proceso, reserva creada'
                    });
                    
                } else {
                    // Si el pago falló, no crear la reserva
                    const payment = await Payment.create({
                        reservation: null, // No hay reserva asociada
                        providerPaymentId: charge.id,
                        orderId: tempOrderId,
                        method,
                        status,
                        amountMx,
                        capturedAmountMx: 0,
                        currency: 'MXN',
                        paymentMethodData: {
                            brand: charge.card?.brand || method,
                            last4: charge.card?.card_number ? charge.card.card_number.slice(-4) : 'N/A',
                            holderName: charge.card?.holder_name || customerData?.name || 'N/A',
                            type: charge.card?.type || method
                        },
                        description: charge.description,
                        raw: charge
                    });

                    return res.status(402).json({
                        ok: false,
                        paymentId: payment._id,
                        status: payment.status,
                        charge,
                        error: 'Pago no exitoso, reserva no creada'
                    });
                }
                
            } catch (dbError) {
                console.error('Error creando reserva o pago:', dbError);
                return res.status(500).json({ 
                    error: 'Error creando reserva después del pago', 
                    detail: String(dbError),
                    chargeId: charge.id 
                });
            }
        } // Fin de processSuccessfulCharge
        
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Unexpected error', detail: String(e) });
    }
});

module.exports = router;