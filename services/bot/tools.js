// Herramientas del bot de WhatsApp. Llaman a los mismos endpoints que usa el panel de Vendedores,
// autenticadas con un JWT del usuario técnico de la marca (authMiddleware ya acepta Bearer).
const jwt = require('jsonwebtoken');

// Defaults; cada marca puede definir los suyos en BOT_BRANDS (imagesUrl, cabinUrl).
const IMAGES_URL = 'https://navarro.integradev.site/navarro/';
const CABIN_URL = 'https://rentravel.com.mx/cabin/'; // mismo link que comparte la app móvil al cotizar
const TZ = 'America/Mexico_City';

const money = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n); // $6,235.00

// '2026-11-14','2026-11-16' -> '14 al 16 de noviembre'; meses distintos -> '30 de noviembre al 2 de diciembre'
function dateRange(llegada, salida) {
    const parts = (iso) => {
        const d = new Date(iso + 'T12:00:00Z');
        return { day: d.getUTCDate(), month: d.toLocaleDateString('es-MX', { month: 'long', timeZone: 'UTC' }) };
    };
    const a = parts(llegada);
    const b = parts(salida);
    return a.month === b.month ? `${a.day} al ${b.day} de ${b.month}` : `${a.day} de ${a.month} al ${b.day} de ${b.month}`;
}

// Mismo formato que la cotización de la app móvil.
function quoteMessage({ fecha_llegada, fecha_salida, huespedes, noches, rooms }, cabinUrl = CABIN_URL) {
    const lines = rooms.map((c) => `${c.displayName} - ${money(c.totalPrice)}\n${cabinUrl}${c.id}?view=1`);
    return `Cotizacion ${dateRange(fecha_llegada, fecha_salida)} - \n${noches} noches · ${huespedes} huespedes\n\n${lines.join('\n')}`;
}

async function api(conv, method, path, body) {
    const token = jwt.sign({ id: String(conv.brand.userId) }, process.env.JWT_SECRET, { expiresIn: '10m', algorithm: 'HS256' });
    const isForm = body instanceof FormData;
    const res = await fetch((process.env.BOT_API_URL || process.env.URL) + path, {
        method,
        headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        },
        body: isForm ? body : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.mensaje || data.error?.[0]?.message || `HTTP ${res.status} en ${path}`);
    }
    return data;
}

const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

function checkDates(llegada, salida) {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(llegada) || !re.test(salida)) throw new Error('Fechas deben ir en formato YYYY-MM-DD');
    if (llegada < todayISO()) throw new Error('La fecha de llegada no puede ser anterior a hoy');
    if (salida <= llegada) throw new Error('La fecha de salida debe ser posterior a la de llegada');
}

const toES = (iso) => iso.split('-').reverse().join('/'); // YYYY-MM-DD -> DD/MM/YYYY (formato del cotizador)

// accommodationFeatures es { grupo: { amenidad: Boolean } } -> ['wifi', 'jacuzzi', ...]
function amenities(features = {}) {
    return Object.values(features)
        .filter((group) => group && typeof group === 'object')
        .flatMap((group) => Object.keys(group).filter((k) => group[k] === true));
}

// Algunas coordenadas están guardadas ×10,000; se normalizan igual que en eventController.
const coord = (n) => (Math.abs(n) > 1000 ? n / 10000 : n);
function mapsLink(room) {
    if (!Number.isFinite(room.latitude) || !Number.isFinite(room.longitude)) return undefined;
    const [lat, lng] = [coord(room.latitude), coord(room.longitude)];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined; // coordenadas de relleno o mal capturadas
    return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Lo que más filtran los clientes ("con alberca", "pet friendly"), para no consultar cabaña por cabaña.
// Solo lo que está marcado: una casilla sin marcar puede ser dato faltante, no un "no".
function keyFeatures(f = {}) {
    const a = f.activities || {};
    return [
        (a.privatePool || a.heatedPool || a.indoorPool || a.outdoorPool) && (a.heatedPool ? 'alberca climatizada' : 'alberca'),
        (a.jacuzzi || f.restroomFeatures?.jacuzzi) && 'jacuzzi',
        f.generalFeatures?.petsAllowed && 'acepta mascotas',
    ].filter(Boolean);
}

function quotedRoom(conv, habitacionId) {
    const room = conv.quote?.rooms.find((r) => String(r.id) === String(habitacionId));
    if (!room) throw new Error('Esa habitación no está en la última búsqueda; vuelve a buscar disponibilidad');
    return room;
}

const handlers = {
    async buscar_disponibilidad(conv, { fecha_llegada, fecha_salida, huespedes }) {
        checkDates(fecha_llegada, fecha_salida);
        const pax = Number(huespedes);
        if (!Number.isInteger(pax) || pax < 1) throw new Error('huespedes debe ser un entero mayor a 0');

        const data = await api(conv, 'POST', '/api/eventos/cotizaciones', {
            categorias: ['all'],
            fechaLlegada: toES(fecha_llegada),
            fechaSalida: toES(fecha_salida),
            huespedes: pax,
            soloDisponibles: true,
        });

        // La cotización completa (con costo y comisiones) se queda en el servidor; el LLM solo ve lo público.
        const rooms = data.chalets.sort((a, b) => b.totalPrice - a.totalPrice); // de mayor a menor, como la app móvil
        conv.quote = { fecha_llegada, fecha_salida, huespedes: pax, noches: data.evento.nights, rooms };
        // La cotización la envía el código como mensaje propio; el LLM no la reescribe (cambiaba formato y podría cambiar precios).
        if (rooms.length) (conv.outbox ??= []).push(quoteMessage(conv.quote, conv.brand.cabinUrl));
        return {
            noches: data.evento.nights,
            cotizacion_enviada_al_cliente: rooms.length > 0,
            opciones: rooms.map((c) => ({
                    habitacion_id: String(c.id),
                    nombre: c.displayName,
                    capacidad: `${c.minPax}-${c.maxPax} personas`,
                    camas: c.nBeds,
                    banos: c.nRestrooms,
                    precio_total_mxn: c.totalPrice,
                    destacados: keyFeatures(c.accomodationFeatures),
                })),
        };
    },

    async detalle_propiedad(conv, { habitacion_id }) {
        const room = quotedRoom(conv, habitacion_id);
        // Horarios e "Información para ventas" no vienen en la cotización. Si la consulta falla, se responde con lo que hay.
        const hab = await api(conv, 'GET', `/api/habitaciones/${room.id}`).catch(() => null);
        return {
            nombre: room.displayName,
            descripcion: room.accomodationDescription || '',
            informacion_para_ventas: hab?.salesInfo || undefined,
            amenidades: amenities(room.accomodationFeatures),
            camas: room.nBeds,
            banos: room.nRestrooms,
            hora_entrada: hab?.others?.arrivalTime || undefined,
            hora_salida: hab?.others?.departureTime || undefined,
            ubicacion_google_maps: mapsLink(room),
            fotos: (room.images || []).slice(0, 5).map((img) => (conv.brand.imagesUrl || IMAGES_URL) + img),
        };
    },

    async crear_reserva(conv, { habitacion_id, nombre, apellido }) {
        if (conv.reservation) {
            throw new Error(`Ya se creó la reserva ${conv.reservation.id} en esta conversación; para otra reserva escala a humano`);
        }
        if (!nombre?.trim() || !apellido?.trim()) throw new Error('Se requiere nombre y apellido del cliente');
        const room = quotedRoom(conv, habitacion_id);
        const q = conv.quote;
        checkDates(q.fecha_llegada, q.fecha_salida);

        // Sin cuenta financiera, createReservation no le manda instrucciones de pago al cliente
        // (solo avisa al vendedor) y registrarPago rechaza el comprobante: se reserva y pasa a humano.
        const habitacion = await api(conv, 'GET', `/api/habitaciones/${room.id}`);
        const pagoAutomatico = !!habitacion?.others?.cuentaFinanciera;

        // El total sale de la cotización guardada, nunca de lo que diga el LLM o el cliente.
        const total = room.totalPrice;
        const reserva = await api(conv, 'POST', '/api/eventos', {
            clientFirstName: nombre.trim(),
            clientLastName: apellido.trim(),
            clientPhone: conv.customerPhone,
            arrivalDate: q.fecha_llegada,
            departureDate: q.fecha_salida,
            nNights: q.noches,
            habitacionId: String(room.id),
            maxOccupation: room.maxPax,
            pax: q.huespedes,
            total,
            isDeposit: true, // tentativa: el sistema actual manda instrucciones de pago por Meta y la cancela si no se paga
            comisionVendedor: total - room.totalPriceNoComs,
            totalOriginal: total,
            totalSinComisiones: room.totalPriceNoComs,
            costoBase: room.totalCost,
        });

        // Mismo paso que hace el panel después de crear la reserva.
        try {
            await api(conv, 'POST', '/api/utilidades/reserva', {
                precioMinimo: total,
                precioMaximo: total,
                costoBase: room.totalCost,
                totalSinComisiones: room.totalPriceNoComs,
                precioAsignado: total,
                chaletName: reserva.assignedChaletName,
                habitacionId: String(room.id),
                idReserva: reserva.reservationId,
                arrivalDate: q.fecha_llegada,
                departureDate: q.fecha_salida,
                nNights: q.noches,
            });
        } catch (err) {
            // ponytail: la reserva ya existe; no se revierte, se deja rastro para corregir comisiones desde el panel
            console.error(`[bot] Reserva ${reserva.reservationId} creada pero fallaron comisiones:`, err.message);
        }

        conv.reservation = { id: reserva.reservationId, total, habitacion: room.displayName };
        const result = {
            reserva_id: reserva.reservationId,
            mensaje_sistema: reserva.message,
            total_mxn: total,
            anticipo_mxn: Number((total / 2).toFixed(2)),
        };
        if (!pagoAutomatico) {
            conv.escalated = true;
            conv.escalationReason = `Reserva ${reserva.reservationId} sin cuenta financiera: enviar datos de pago al cliente. ${reserva.message}`;
            result.pago = 'manual';
            result.nota = 'Esta propiedad no tiene pago automático. Dile al cliente que su reserva quedó apartada hasta la hora límite y que un asesor le enviará por este chat los datos para pagar en breve. No le pidas el comprobante todavía.';
        }
        return result;
    },

    async registrar_pago(conv, { importe, codigo_operacion }) {
        if (!conv.reservation) throw new Error('No hay reserva creada en esta conversación; escala a humano');
        if (!conv.receipt) throw new Error('Aún no hay comprobante; pide al cliente que envíe la foto o PDF aquí');
        const monto = Number(importe);
        if (!(monto > 0)) throw new Error('importe debe ser un número mayor a 0');

        const form = new FormData();
        form.append('fechaPago', new Date().toISOString());
        form.append('importe', String(monto));
        form.append('metodoPago', 'Transferencia'); // depósito OXXO recibe el mismo trato
        form.append('codigoOperacion', codigo_operacion || '');
        form.append('reservacionId', conv.reservation.id);
        form.append('notas', `Registrado por bot de WhatsApp (${conv.brand.name}). Importe declarado por el cliente ${conv.customerPhone}; validar contra comprobante.`);
        form.append('comprobante', new Blob([conv.receipt.buffer], { type: conv.receipt.mimeType }), conv.receipt.filename);

        await api(conv, 'POST', '/api/pagos', form);
        conv.escalated = true;
        conv.escalationReason = 'Comprobante recibido';
        return { ok: true, nota: 'Pago registrado como pendiente de validación. La conversación pasa al equipo humano.' };
    },

    async escalar_a_humano(conv, { motivo }) {
        conv.escalated = true;
        conv.escalationReason = motivo || 'Sin motivo';
        return { ok: true };
    },
};

const definitions = [
    {
        name: 'buscar_disponibilidad',
        description: 'Busca propiedades disponibles y su precio total. Úsala solo cuando el cliente ya te dio fecha de llegada, fecha de salida y número de personas.',
        input_schema: {
            type: 'object',
            properties: {
                fecha_llegada: { type: 'string', description: 'YYYY-MM-DD' },
                fecha_salida: { type: 'string', description: 'YYYY-MM-DD' },
                huespedes: { type: 'integer', description: 'Número exacto de personas que dijo el cliente. Si no lo ha dicho, no uses esta herramienta: pregúntale.' },
            },
            required: ['fecha_llegada', 'fecha_salida', 'huespedes'],
        },
    },
    {
        name: 'detalle_propiedad',
        description: 'Información de una propiedad de la última búsqueda de disponibilidad: descripción, información para ventas (distribución, acceso, ubicación, mascotas, etc.), amenidades, horas de entrada y salida, enlace de Google Maps y fotos.',
        input_schema: {
            type: 'object',
            properties: { habitacion_id: { type: 'string' } },
            required: ['habitacion_id'],
        },
    },
    {
        name: 'crear_reserva',
        description: 'Crea la reserva tentativa de una propiedad de la última búsqueda. Solo después de que el cliente confirmó explícitamente propiedad, fechas, personas y total.',
        input_schema: {
            type: 'object',
            properties: {
                habitacion_id: { type: 'string' },
                nombre: { type: 'string' },
                apellido: { type: 'string' },
            },
            required: ['habitacion_id', 'nombre', 'apellido'],
        },
    },
    {
        name: 'registrar_pago',
        description: 'Registra el comprobante de pago (transferencia o depósito OXXO) que el cliente ya envió, para validación humana.',
        input_schema: {
            type: 'object',
            properties: {
                importe: { type: 'number', description: 'Monto que el cliente dice haber pagado, en MXN' },
                codigo_operacion: { type: 'string', description: 'Referencia o folio, si el cliente lo dio' },
            },
            required: ['importe'],
        },
    },
    {
        name: 'escalar_a_humano',
        description: 'Pasa la conversación al equipo humano. Después de usarla, el bot ya no responde.',
        input_schema: {
            type: 'object',
            properties: { motivo: { type: 'string' } },
            required: ['motivo'],
        },
    },
];

async function run(conv, name, input) {
    const handler = handlers[name];
    if (!handler) throw new Error(`Herramienta desconocida: ${name}`);
    return handler(conv, input || {});
}

module.exports = { definitions, run, todayISO, TZ };
