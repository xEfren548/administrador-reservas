// Canal YCloud del bot: firma del webhook, envío por sendDirectly, descarga de comprobantes y
// procesamiento de cada evento. Dos eventos importan:
// - whatsapp.inbound_message.received: escribió un cliente -> responde el engine.
// - whatsapp.smb.message.echoes: alguien escribió desde la app WhatsApp Business (coexistence) -> la torre de control
//   tomó la conversación y el bot se calla.
const crypto = require('crypto');
const engine = require('./engine');
const BotConversation = require('../../models/BotConversation');

const API = 'https://api.ycloud.com/v2';
const IDLE_RESET_MS = 7 * 24 * 60 * 60 * 1000; // tras 7 días sin actividad, el cliente empieza conversación nueva
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const PERSISTED = ['messages', 'quote', 'reservation', 'receipt', 'escalated', 'escalationReason', 'sentIds'];

// YCloud-Signature: "t=<unix seg>,s=<hex>"; firma = HMAC-SHA256(secreto, `${t}.${body crudo}`).
function verifySignature(rawBody, header, secret, now = Date.now()) {
    if (!Buffer.isBuffer(rawBody) || typeof header !== 'string' || !secret) return false;
    const pairs = header.split(',').map((p) => p.trim().split('='));
    const t = pairs.find(([k]) => k === 't')?.[1];
    if (!/^\d+$/.test(t ?? '') || Math.abs(now / 1000 - Number(t)) > 300) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
    return pairs.some(([k, s]) => k === 's' && /^[a-f0-9]{64}$/i.test(s) && crypto.timingSafeEqual(expected, Buffer.from(s, 'hex')));
}

// '+52 1 33 1234 5678' -> '523312345678': mismo formato que normalizeClientPhone, para no duplicar clientes.
function normPhone(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    return /^521\d{10}$/.test(d) ? '52' + d.slice(3) : d;
}

const brands = () => JSON.parse(process.env.BOT_BRANDS || '[]');
const ignored = (phone) => (process.env.BOT_IGNORE_PHONES || '').split(',').map(normPhone).filter(Boolean).includes(normPhone(phone));

async function sendText(from, to, body) {
    const res = await fetch(`${API}/whatsapp/messages/sendDirectly`, {
        method: 'POST',
        headers: { 'X-API-Key': process.env.YCLOUD_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: '+' + normPhone(from), to, type: 'text', text: { body } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === 'failed') {
        throw new Error(`YCloud sendDirectly ${res.status}: ${data.error?.message || data.errorMessage || JSON.stringify(data)}`);
    }
    return data;
}

// Texto que recibe el engine por cada mensaje del cliente. Imagen/PDF se descarga y queda como comprobante.
async function inboundText(conv, msg) {
    if (msg.type === 'text') return msg.text?.body;
    if (msg.type === 'reaction') return null;
    if (msg.type !== 'image' && msg.type !== 'document') {
        return `[El cliente envió un mensaje de tipo "${msg.type}" que no puedes ver ni escuchar; pídele que te lo escriba]`;
    }
    const media = msg[msg.type];
    const mimeType = String(media.mime_type || '').split(';')[0];
    const filename = media.filename || `comprobante.${mimeType.split('/')[1] || 'bin'}`;
    const caption = media.caption ? ` con el texto "${media.caption}"` : '';
    if (!RECEIPT_TYPES.includes(mimeType)) {
        return `[El cliente envió un archivo ${mimeType}${caption} que no se puede usar como comprobante; si es su comprobante, pídele una foto o PDF]`;
    }
    const res = await fetch(media.link, { headers: { 'X-API-Key': process.env.YCLOUD_API_KEY } });
    if (!res.ok) throw new Error(`No se pudo descargar el archivo de YCloud (HTTP ${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_RECEIPT_BYTES) {
        return `[El cliente envió un archivo demasiado pesado${caption}; si es su comprobante, pídele una captura de pantalla]`;
    }
    conv.receipt = { buffer, mimeType, filename };
    return `[El cliente envió un archivo: ${filename}]${caption}`;
}

async function load(brand, waId) {
    const customerPhone = normPhone(waId);
    const doc = await BotConversation.findOneAndUpdate(
        { brandKey: brand.key, customerPhone },
        { $setOnInsert: { waId } },
        { upsert: true, new: true, timestamps: false }, // leer no cuenta como actividad: updatedAt solo cambia en save()
    );
    const conv = { ...doc.toObject(), brand };
    if (conv.receipt) conv.receipt.buffer = doc.receipt.buffer; // toObject() lo deja como bson Binary; tools necesita Buffer
    if (Date.now() - doc.updatedAt > IDLE_RESET_MS) {
        Object.assign(conv, engine.newConversation(brand, customerPhone), { escalationReason: null, sentIds: [] });
    }
    return conv;
}

const save = (conv) => BotConversation.updateOne(
    { _id: conv._id },
    { $set: Object.fromEntries(PERSISTED.map((k) => [k, conv[k] ?? null])) },
);

// msgs: mensajes seguidos del cliente agrupados por enqueueInbound; el engine los recibe como un solo turno.
async function onInbound(conv, msgs) {
    if (conv.escalated) return; // la torre de control ya tiene la conversación
    let out;
    try {
        const texts = [];
        for (const msg of msgs) {
            const text = await inboundText(conv, msg);
            if (text) texts.push(text);
        }
        if (!texts.length) return;
        out = await engine.reply(conv, texts.join('\n'));
    } catch (err) {
        console.error(`[bot] Error con ${conv.customerPhone} (${conv.brand.key}):`, err.message);
        conv.escalated = true;
        conv.escalationReason = `Error del bot: ${err.message}`;
        out = [engine.HANDOFF_MSG];
    }
    try {
        for (const text of out) {
            const sent = await sendText(conv.brand.phone, conv.waId, text);
            conv.sentIds = [...(conv.sentIds || []), sent.id, sent.wamid].filter(Boolean).slice(-40);
        }
    } finally {
        await save(conv);
    }
}

async function onEcho(conv, msg) {
    const ours = [msg.id, msg.wamid].some((id) => id && conv.sentIds?.includes(id));
    if (ours || conv.escalated) return;
    conv.escalated = true;
    conv.escalationReason = 'Un humano respondió desde la app WhatsApp Business';
    await save(conv);
}

// ponytail: cola en memoria por conversación (un mensaje a la vez); con varias instancias del servidor hace falta un lock en Mongo
const queues = new Map();

// Marca + cliente del evento, o null si no le toca al bot.
function route(brandPhone, waId) {
    const brand = brands().find((b) => normPhone(b.phone) === normPhone(brandPhone));
    if (!brand) {
        console.warn(`[bot] Evento para ${brandPhone}, que no está en BOT_BRANDS`);
        return null;
    }
    if (ignored(waId)) return null; // p. ej. la copia de la plantilla que manda el número oficial de Meta
    return { brand, waId, key: `${brand.key}:${normPhone(waId)}` };
}

function withConversation({ brand, waId, key }, fn) {
    const run = (queues.get(key) || Promise.resolve()).then(async () => fn(await load(brand, waId)));
    const tail = run.catch(() => {});
    queues.set(key, tail);
    tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
    return run;
}

// Agrupa mensajes seguidos ("hola" / "quiero" / "reservar") en un solo turno: cada mensaje reinicia la espera
// de DEBOUNCE_MS, hasta MAX_WAIT_MS desde el primero. Lo que llega mientras el bot contesta forma el siguiente grupo.
// ponytail: grupos en memoria; si el servidor se reinicia durante la espera, esos mensajes se pierden
const DEBOUNCE_MS = Number(process.env.BOT_DEBOUNCE_MS ?? 5000);
const MAX_WAIT_MS = 20000;
const pending = new Map();

function enqueueInbound(r, msg) {
    let batch = pending.get(r.key);
    if (!batch) {
        batch = { msgs: [], first: Date.now() };
        batch.done = new Promise((resolve, reject) => Object.assign(batch, { resolve, reject }));
        pending.set(r.key, batch);
    }
    batch.msgs.push(msg);
    clearTimeout(batch.timer);
    batch.timer = setTimeout(() => {
        pending.delete(r.key);
        // YCloud puede entregar fuera de orden; sendTime es ISO, se ordena como texto.
        batch.msgs.sort((a, b) => String(a.sendTime ?? '').localeCompare(String(b.sendTime ?? '')));
        withConversation(r, (conv) => onInbound(conv, batch.msgs)).then(batch.resolve, batch.reject);
    }, Math.max(0, Math.min(DEBOUNCE_MS, batch.first + MAX_WAIT_MS - Date.now())));
    return batch.done;
}

async function handleEvent(event) {
    if (event.type === 'whatsapp.inbound_message.received') {
        const msg = event.whatsappInboundMessage;
        const r = route(msg.to, msg.from);
        return r && enqueueInbound(r, msg);
    }
    if (event.type === 'whatsapp.smb.message.echoes') {
        const msg = event.whatsappMessage; // from = número del negocio, to = cliente
        const r = route(msg.from, msg.to);
        return r && withConversation(r, (conv) => onEcho(conv, msg));
    }
}

module.exports = { verifySignature, normPhone, handleEvent };
