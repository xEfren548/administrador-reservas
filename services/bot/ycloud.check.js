// Verificación rápida del canal YCloud (firma, ruteo de eventos, comprobantes, echoes) con Mongo, engine y fetch simulados.
// node services/bot/ycloud.check.js
const assert = require('assert');
const crypto = require('crypto');
process.env.BOT_BRANDS = JSON.stringify([{ key: 'rt', name: 'Rentravel', phone: '523300000001', userId: 'u1' }]);
process.env.BOT_IGNORE_PHONES = '+52 33 9999 9999';
process.env.YCLOUD_API_KEY = 'key';
process.env.BOT_DEBOUNCE_MS = '30';

const engine = require('./engine');
const BotConversation = require('../../models/BotConversation');
const { verifySignature, normPhone, handleEvent } = require('./ycloud');

// Mongo en memoria: lo mínimo que usa ycloud.js.
const db = new Map();
BotConversation.findOneAndUpdate = async ({ brandKey, customerPhone }, { $setOnInsert }) => {
    const key = `${brandKey}:${customerPhone}`;
    if (!db.has(key)) db.set(key, { _id: key, brandKey, customerPhone, ...$setOnInsert, messages: [], quote: null, reservation: null, receipt: null, escalated: false, escalationReason: null, sentIds: [] });
    const raw = db.get(key);
    return { ...raw, toObject: () => structuredClone(raw) };
};
BotConversation.updateOne = async ({ _id }, { $set }) => Object.assign(db.get(_id), $set, { updatedAt: new Date() });

const sent = [];
const downloads = [];
global.fetch = async (url, opts) => {
    if (url.endsWith('/sendDirectly')) {
        sent.push(JSON.parse(opts.body));
        return { ok: true, json: async () => ({ id: `y${sent.length}`, wamid: `w${sent.length}`, status: 'accepted' }) };
    }
    downloads.push({ url, headers: opts.headers });
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode('PDF').buffer };
};

const replies = [];
engine.reply = async (conv, text) => {
    replies.push({ text, receipt: conv.receipt });
    conv.messages.push({ role: 'user', content: text });
    return ['hola', 'segunda'];
};

const inbound = (id, from, message) => ({
    id, type: 'whatsapp.inbound_message.received',
    whatsappInboundMessage: { id: 'm' + id, from, to: '+523300000001', ...message },
});

(async () => {
    // Firma
    const body = Buffer.from('{"id":"e1"}');
    const t = Math.floor(Date.now() / 1000);
    const sig = (ts, b = body) => crypto.createHmac('sha256', 'sec').update(`${ts}.`).update(b).digest('hex');
    assert.ok(verifySignature(body, `t=${t},s=${sig(t)}`, 'sec'));
    assert.ok(verifySignature(body, `t=${t},s=${'0'.repeat(64)},s=${sig(t)}`, 'sec'), 'acepta varias firmas (rotación de secreto)');
    assert.ok(!verifySignature(Buffer.from('{"id":"e2"}'), `t=${t},s=${sig(t)}`, 'sec'), 'body alterado');
    assert.ok(!verifySignature(body, `t=${t - 600},s=${sig(t - 600)}`, 'sec'), 'timestamp viejo');
    assert.ok(!verifySignature(body, `t=${t},s=${sig(t)}`, undefined), 'sin secreto configurado no pasa nada');

    assert.strictEqual(normPhone('+5213312345678'), '523312345678');
    assert.strictEqual(normPhone('+523312345678'), '523312345678');

    // Texto del cliente -> engine -> respuestas por sendDirectly desde el número de la marca
    await handleEvent(inbound('1', '+5213312345678', { type: 'text', text: { body: 'hola' } }));
    assert.deepStrictEqual(replies.map((r) => r.text), ['hola']);
    assert.deepStrictEqual(sent.map((s) => [s.from, s.to, s.text.body]), [
        ['+523300000001', '+5213312345678', 'hola'],
        ['+523300000001', '+5213312345678', 'segunda'],
    ]);
    const conv = db.get('rt:523312345678');
    assert.strictEqual(conv.messages.length, 1, 'historial guardado');
    assert.deepStrictEqual(conv.sentIds, ['y1', 'w1', 'y2', 'w2']);

    // Comprobante: se descarga con X-API-Key y queda como Buffer en la conversación
    await handleEvent(inbound('2', '+5213312345678', { type: 'document', document: { link: 'https://ycloud/f', mime_type: 'application/pdf', filename: 'pago.pdf' } }));
    assert.strictEqual(downloads[0].headers['X-API-Key'], 'key');
    assert.match(replies[1].text, /pago\.pdf/);
    assert.ok(Buffer.isBuffer(replies[1].receipt.buffer));
    assert.ok(Buffer.isBuffer(db.get('rt:523312345678').receipt.buffer), 'comprobante guardado');

    // Número ignorado (copia de la plantilla desde el número oficial de Meta) y número sin marca
    await handleEvent(inbound('3', '+523399999999', { type: 'text', text: { body: 'Nueva reserva...' } }));
    await handleEvent({ ...inbound('4', '+523312345678', { type: 'text', text: { body: 'x' } }), whatsappInboundMessage: { from: '+523312345678', to: '+520000000000', type: 'text', text: { body: 'x' } } });
    assert.strictEqual(replies.length, 2);

    // Echo de un mensaje del propio bot: no escala. Echo de un humano desde la app: escala y el bot se calla.
    const echo = (id) => ({ id: 'e' + id, type: 'whatsapp.smb.message.echoes', whatsappMessage: { id, from: '+523300000001', to: '+5213312345678', type: 'text', text: { body: '...' } } });
    await handleEvent(echo('y1'));
    assert.strictEqual(conv.escalated, false);
    await handleEvent(echo('humano'));
    assert.strictEqual(conv.escalated, true);
    await handleEvent(inbound('5', '+5213312345678', { type: 'text', text: { body: '¿sigues ahí?' } }));
    assert.strictEqual(replies.length, 2, 'escalada: el bot ya no responde');

    // Mensajes seguidos se agrupan en un solo turno (en orden de sendTime); lo que llega mientras contesta, en el siguiente.
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let active = 0;
    let maxActive = 0;
    engine.reply = async (c, text) => {
        maxActive = Math.max(maxActive, ++active);
        await sleep(60);
        c.messages.push({ role: 'user', content: text });
        active--;
        return ['ok'];
    };
    const msg = (id, body, sendTime) => handleEvent(inbound(id, '+523311111111', { type: 'text', text: { body }, sendTime }));
    const first = [msg('a', 'hola', '2026-10-25T10:00:01Z'), msg('c', 'reservar', '2026-10-25T10:00:03Z'), msg('b', 'quiero', '2026-10-25T10:00:02Z')];
    await sleep(50); // primer grupo ya en el engine
    const second = [msg('d', 'para 4', '2026-10-25T10:00:04Z'), msg('e', 'personas', '2026-10-25T10:00:05Z')];
    await Promise.all([...first, ...second]);
    assert.strictEqual(maxActive, 1, 'un turno a la vez por conversación');
    assert.deepStrictEqual(db.get('rt:523311111111').messages.map((m) => m.content), ['hola\nquiero\nreservar', 'para 4\npersonas']);

    // Si el engine falla, el cliente recibe el mensaje de traspaso y la conversación pasa a humano
    engine.reply = async () => { throw new Error('Anthropic caído'); };
    await handleEvent(inbound('6', '+523322222222', { type: 'text', text: { body: 'hola' } }));
    assert.strictEqual(sent.at(-1).text.body, engine.HANDOFF_MSG);
    assert.match(db.get('rt:523322222222').escalationReason, /Anthropic caído/);

    console.log('ycloud.check OK');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
