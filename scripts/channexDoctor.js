/**
 * Diagnóstico de la integración con Channex.
 *
 *   npm run channex:doctor
 *
 * Sale con código 1 si algo está mal, para poder colgarlo de CI o de un monitor.
 * No escribe nada: sólo lee el PMS y Channex y los compara.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const moment = require('moment');
const axios = require('axios');

const Habitacion = require('../models/Habitacion');
const Reservas = require('../models/Evento');
const BloqueoFechas = require('../models/BloqueoFechas');

const BASE_URL = process.env.NODE_ENV === 'development' ? process.env.DEV_CHANNEX_API_URL : process.env.CHANNEX_API_URL;
const DB_URL = process.env.NODE_ENV === 'development' ? process.env.DEV_DB : process.env.DB_URL;
const WEBHOOK_URL = process.env.CHANNEX_WEBHOOK_URL || `${process.env.URL}/api/channex/webhooks`;
const DIAS_A_REVISAR = 30;

const channex = axios.create({
    baseURL: BASE_URL,
    headers: { 'user-api-key': process.env.CHANNEX_USER_API_KEY },
    timeout: 30000
});

let fallas = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const fail = (msg) => { fallas++; console.log(`  FALLA ${msg}`); };
const warn = (msg) => console.log(`  aviso ${msg}`);
const titulo = (msg) => console.log(`\n${msg}`);

const detalle = (err) => {
    const d = err.response?.data;
    return d ? JSON.stringify(d.errors || d) : err.message;
};

async function revisarConfiguracion() {
    titulo('1. Configuración');
    const requeridas = {
        NODE_ENV: process.env.NODE_ENV,
        'URL base de Channex': BASE_URL,
        CHANNEX_USER_API_KEY: process.env.CHANNEX_USER_API_KEY,
        CHANNEX_GROUP_ID: process.env.CHANNEX_GROUP_ID,
        'URL de webhook': WEBHOOK_URL
    };
    for (const [nombre, valor] of Object.entries(requeridas)) {
        if (!valor) fail(`${nombre} sin definir`);
        else ok(`${nombre}: ${nombre.includes('KEY') ? valor.slice(0, 6) + '…' : valor}`);
    }
}

async function revisarCuenta() {
    titulo('2. Cuenta de Channex');
    let propiedadesChannex = [];
    try {
        const { data } = await channex.get('/api/v1/properties');
        propiedadesChannex = data.data;
        ok(`API alcanzable, ${propiedadesChannex.length} propiedad(es) en la cuenta`);
    } catch (err) {
        fail(`API no responde: ${detalle(err)}`);
        return { propiedadesChannex, canales: [] };
    }

    try {
        const { data } = await channex.get('/api/v1/groups');
        const grupos = data.data.map(g => g.id);
        if (grupos.includes(process.env.CHANNEX_GROUP_ID)) ok('CHANNEX_GROUP_ID existe en la cuenta');
        else fail(`CHANNEX_GROUP_ID no existe en esta cuenta. Disponibles: ${grupos.join(', ')}`);
    } catch (err) {
        fail(`No se pudieron leer los grupos: ${detalle(err)}`);
    }

    let canales = [];
    try {
        const { data } = await channex.get('/api/v1/channels');
        canales = data.data;
        if (canales.length === 0) fail('No hay ningún canal conectado');
        for (const c of canales) {
            const a = c.attributes;
            const etiqueta = `${a.channel} (${c.id})`;
            if (a.is_active) ok(`Canal activo: ${etiqueta}`);
            else fail(`Canal INACTIVO: ${etiqueta} — no sincroniza nada`);

            const tokens = a.settings?.tokens;
            if (a.settings?.token_invalid) {
                fail(`${etiqueta}: token inválido, hay que reconectar`);
            } else if (tokens?.expires_at) {
                // Los tokens de Airbnb duran ~24h y Channex los renueva solo, así que
                // "expira mañana" es lo normal: sólo avisamos si ya no le da tiempo.
                const expira = moment.unix(tokens.expires_at);
                const horas = expira.diff(moment(), 'hours');
                if (horas < 0) fail(`${etiqueta}: token vencido el ${expira.format('YYYY-MM-DD HH:mm')}`);
                else if (horas < 1) warn(`${etiqueta}: token expira en menos de 1 hora y no se ha renovado (${expira.format('YYYY-MM-DD HH:mm')})`);
                else ok(`${etiqueta}: token vigente (renueva ${expira.format('YYYY-MM-DD HH:mm')})`);
            }
        }
    } catch (err) {
        fail(`No se pudieron leer los canales: ${detalle(err)}`);
    }

    return { propiedadesChannex, canales };
}

async function revisarWebhooks() {
    titulo('3. Webhooks');
    try {
        const { data } = await channex.get('/api/v1/webhooks');
        if (data.data.length === 0) {
            fail('No hay webhooks registrados — las reservas sólo llegarían por el poller del feed');
            return;
        }
        for (const w of data.data) {
            const a = w.attributes;
            const estado = a.is_active ? 'activo' : 'INACTIVO';
            if (!a.is_active) fail(`Webhook ${estado}: ${a.callback_url}`);
            else if (a.callback_url !== WEBHOOK_URL) warn(`Webhook ${estado} apunta a ${a.callback_url}, distinto de CHANNEX_WEBHOOK_URL`);
            else ok(`Webhook ${estado}: ${a.callback_url}`);

            if (!a.event_mask.includes(';') && a.event_mask !== '*' && a.event_mask.includes(',')) {
                fail(`event_mask con comas: "${a.event_mask}" — Channex usa punto y coma`);
            }
        }
    } catch (err) {
        fail(`No se pudieron leer los webhooks: ${detalle(err)}`);
    }
}

async function revisarFeed() {
    titulo('4. Feed de reservas');
    try {
        const { data } = await channex.get('/api/v1/booking_revisions/feed');
        const pendientes = data.meta?.total ?? data.data.length;
        if (pendientes === 0) ok('Sin revisiones pendientes de ack');
        else fail(`${pendientes} revisión(es) sin ack — expiran a los 30 min y se pierden`);
    } catch (err) {
        fail(`Feed inalcanzable: ${detalle(err)}`);
    }
}

/** Fechas que el PMS considera ocupadas (bloqueos + reservas vivas). */
async function fechasOcupadasPms(habitacionId, desde, hasta) {
    const ocupadas = new Set();

    const bloqueos = await BloqueoFechas.find({
        habitacionId,
        type: 'bloqueo',
        date: { $gte: desde.toDate(), $lte: hasta.toDate() }
    }).lean();
    bloqueos.forEach(b => ocupadas.add(moment.utc(b.date).format('YYYY-MM-DD')));

    const reservas = await Reservas.find({
        resourceId: habitacionId,
        arrivalDate: { $lte: hasta.toDate() },
        departureDate: { $gte: desde.toDate() },
        status: { $nin: ['cancelled', 'no-show'] }
    }).lean();
    for (const r of reservas) {
        const cursor = moment.utc(r.arrivalDate).startOf('day');
        const fin = moment.utc(r.departureDate).startOf('day').subtract(1, 'day');
        while (cursor.isSameOrBefore(fin)) {
            ocupadas.add(cursor.format('YYYY-MM-DD'));
            cursor.add(1, 'day');
        }
    }
    return ocupadas;
}

async function revisarHabitaciones(propiedadesChannex) {
    titulo(`5. Habitaciones mapeadas (readback de ${DIAS_A_REVISAR} días)`);

    const habitaciones = await Habitacion.find({
        channexPropertyId: { $exists: true, $nin: [null, ''] }
    }).lean();

    if (habitaciones.length === 0) {
        warn('Ninguna habitación del PMS está mapeada a Channex todavía');
        return;
    }

    const idsChannex = propiedadesChannex.map(p => p.id);
    const desde = moment().startOf('day');
    const hasta = moment().startOf('day').add(DIAS_A_REVISAR, 'days');

    for (const hab of habitaciones) {
        const nombre = hab.propertyDetails?.name || hab._id;
        console.log(`\n  · ${nombre}`);

        if (!idsChannex.includes(hab.channexPropertyId)) {
            fail(`${nombre}: apunta a la propiedad ${hab.channexPropertyId}, que ya no existe en Channex`);
            continue;
        }
        if (!hab.channexRoomId) { fail(`${nombre}: sin room type (channexRoomId)`); continue; }
        if (!hab.channels?.length) { fail(`${nombre}: sin canales`); continue; }

        try {
            await channex.get(`/api/v1/room_types/${hab.channexRoomId}`);
            ok(`${nombre}: room type existe`);
        } catch (err) {
            fail(`${nombre}: el room type ${hab.channexRoomId} no existe en Channex`);
            continue;
        }

        for (const canal of hab.channels) {
            if (!canal.rateListingId) { fail(`${nombre} / ${canal.ota_name}: sin rate plan`); continue; }
            try {
                await channex.get(`/api/v1/rate_plans/${canal.rateListingId}`);
            } catch (err) {
                fail(`${nombre} / ${canal.ota_name}: el rate plan ${canal.rateListingId} no existe en Channex`);
                continue;
            }
            if (!canal.listingId) warn(`${nombre} / ${canal.ota_name}: sin listing mapeado`);
            else ok(`${nombre} / ${canal.ota_name}: rate plan y listing ${canal.listingId}`);
        }

        // Rate plans que quedaron en Channex y el PMS ya no sigue: reciben precios de
        // nadie y ensucian el mapeo del canal.
        try {
            const { data } = await channex.get('/api/v1/rate_plans', { params: { 'filter[property_id]': hab.channexPropertyId } });
            const seguidos = hab.channels.map(c => c.rateListingId);
            const huerfanos = data.data.filter(r => !seguidos.includes(r.id));
            if (huerfanos.length) warn(`${nombre}: ${huerfanos.length} rate plan(s) huérfanos en Channex → ${huerfanos.map(r => `${r.attributes.title} (${r.id})`).join(', ')}`);
        } catch (err) {
            warn(`${nombre}: no se pudieron listar los rate plans: ${detalle(err)}`);
        }

        // Readback: lo que Channex tiene publicado contra lo que el PMS cree.
        // Un día ocupado en el PMS y vendible en la OTA es un overbooking esperando pasar.
        try {
            const { data } = await channex.get('/api/v1/availability', {
                params: {
                    'filter[property_id]': hab.channexPropertyId,
                    'filter[date][gte]': desde.format('YYYY-MM-DD'),
                    'filter[date][lte]': hasta.format('YYYY-MM-DD')
                }
            });

            const porFecha = data.data?.[hab.channexRoomId];
            if (!porFecha || Object.keys(porFecha).length === 0) {
                fail(`${nombre}: Channex no tiene disponibilidad publicada`);
            } else {
                const ocupadas = await fechasOcupadasPms(hab._id, desde, hasta);
                const riesgo = [];
                const sobra = [];
                for (const [fecha, disponible] of Object.entries(porFecha)) {
                    const ocupadaEnPms = ocupadas.has(fecha);
                    if (ocupadaEnPms && Number(disponible) > 0) riesgo.push(fecha);
                    if (!ocupadaEnPms && Number(disponible) === 0) sobra.push(fecha);
                }
                if (riesgo.length) fail(`${nombre}: ${riesgo.length} día(s) ocupados en el PMS pero vendibles en Channex → ${riesgo.slice(0, 5).join(', ')}${riesgo.length > 5 ? '…' : ''}`);
                else ok(`${nombre}: disponibilidad coincide con el PMS`);
                if (sobra.length) warn(`${nombre}: ${sobra.length} día(s) cerrados en Channex y libres en el PMS → ${sobra.slice(0, 5).join(', ')}${sobra.length > 5 ? '…' : ''}`);
            }
        } catch (err) {
            fail(`${nombre}: no se pudo leer la disponibilidad: ${detalle(err)}`);
        }

        try {
            const { data } = await channex.get('/api/v1/restrictions', {
                params: {
                    'filter[property_id]': hab.channexPropertyId,
                    'filter[date][gte]': desde.format('YYYY-MM-DD'),
                    'filter[date][lte]': hasta.format('YYYY-MM-DD'),
                    'filter[restrictions]': 'rate'
                }
            });
            for (const canal of hab.channels.filter(c => c.rateListingId)) {
                // Ojo: Channex recibe las tarifas en centavos pero las devuelve en pesos ("286.00")
                const tarifas = data.data?.[canal.rateListingId];
                const valores = tarifas ? Object.values(tarifas).map(v => Number(v.rate ?? v)) : [];
                if (valores.length === 0) fail(`${nombre} / ${canal.ota_name}: sin tarifas publicadas`);
                else if (valores.some(v => !v)) fail(`${nombre} / ${canal.ota_name}: hay días con tarifa en 0`);
                else ok(`${nombre} / ${canal.ota_name}: tarifas publicadas (${Math.min(...valores)} – ${Math.max(...valores)} MXN)`);
            }
        } catch (err) {
            fail(`${nombre}: no se pudieron leer las tarifas: ${detalle(err)}`);
        }
    }
}

(async () => {
    console.log(`Channex doctor — ${BASE_URL} — ${moment().format('YYYY-MM-DD HH:mm')}`);
    await mongoose.connect(DB_URL);

    await revisarConfiguracion();
    const { propiedadesChannex } = await revisarCuenta();
    await revisarWebhooks();
    await revisarFeed();
    await revisarHabitaciones(propiedadesChannex);

    await mongoose.disconnect();

    console.log(`\n${fallas === 0 ? 'Todo en orden.' : `${fallas} problema(s) encontrados.`}`);
    process.exit(fallas === 0 ? 0 : 1);
})().catch(async (err) => {
    console.error('\nEl doctor se cayó:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
