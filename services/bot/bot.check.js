// Verificación rápida de services/bot (tools + loop del engine) con fetch simulado (no toca API ni base de datos).
// node services/bot/bot.check.js
const assert = require('assert');
process.env.JWT_SECRET = 'test';
process.env.URL = 'http://test';
const tools = require('./tools');

const calls = [];
global.fetch = async (url, opts) => {
    const body = opts.body instanceof FormData ? Object.fromEntries(opts.body) : opts.body && JSON.parse(opts.body);
    calls.push({ url, body });
    const replies = {
        'http://test/api/habitaciones/b': { others: { cuentaFinanciera: 'cta1' } },
        'http://test/api/habitaciones/a': { others: {} },
        'http://test/api/eventos/cotizaciones': {
            evento: { nights: 2 },
            chalets: [
                { id: 'b', displayName: 'Cabaña B', minPax: 2, maxPax: 6, totalPrice: 5000, totalPriceNoComs: 4500, totalCost: 3000, nBeds: 2, nRestrooms: 1, images: ['b1.jpg'], accomodationFeatures: { generalFeatures: { wifi: true, iron: false }, activities: { jacuzzi: true } } },
                { id: 'a', displayName: 'Cabaña A', minPax: 1, maxPax: 4, totalPrice: 3250, totalPriceNoComs: 3000, totalCost: 2000, nBeds: 1, nRestrooms: 1, images: [] },
            ],
        },
        'http://test/api/eventos': { reservationId: 'r1', message: 'ok', assignedChaletName: 'Cabaña B' },
        'http://test/api/utilidades/reserva': {},
        'http://test/api/pagos': { mensaje: 'ok' },
    };
    return { ok: true, json: async () => replies[url] };
};

(async () => {
    const conv = { brand: { name: 'Test', userId: 'u1' }, customerPhone: '523312345678', quote: null, reservation: null, receipt: null, escalated: false };
    const [y, m, d] = tools.todayISO().split('-').map(Number);
    const iso = (offset) => new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);

    await assert.rejects(tools.run(conv, 'buscar_disponibilidad', { fecha_llegada: iso(-1), fecha_salida: iso(1), huespedes: 2 }), /anterior a hoy/);

    const busq = await tools.run(conv, 'buscar_disponibilidad', { fecha_llegada: iso(10), fecha_salida: iso(12), huespedes: 4 });
    assert.deepStrictEqual(busq.opciones.map((o) => o.nombre), ['Cabaña B', 'Cabaña A'], 'de mayor a menor precio, como la app');
    assert.strictEqual(busq.cotizacion_enviada_al_cliente, true);
    assert.strictEqual(conv.outbox.length, 1, 'la cotización se envía como mensaje aparte');
    const lines = conv.outbox[0].split('\n');
    assert.match(lines[0], /^Cotizacion \d+ (de \S+ )?al \d+ de \S+ - $/);
    assert.strictEqual(lines[1], '2 noches · 4 huespedes');
    assert.deepStrictEqual(lines.slice(3), [
        'Cabaña B - $5,000.00', 'https://rentravel.com.mx/cabin/b?view=1',
        'Cabaña A - $3,250.00', 'https://rentravel.com.mx/cabin/a?view=1',
    ]);
    assert.ok(!JSON.stringify(busq).includes('3000') && !JSON.stringify(busq).includes('4500'), 'no expone costo ni precio sin comisiones');
    assert.strictEqual(calls[0].body.fechaLlegada, iso(10).split('-').reverse().join('/'));

    const det = await tools.run(conv, 'detalle_propiedad', { habitacion_id: 'b' });
    assert.deepStrictEqual(det.amenidades, ['wifi', 'jacuzzi']);
    assert.strictEqual(det.fotos[0], 'https://navarro.integradev.site/navarro/b1.jpg');

    await assert.rejects(tools.run(conv, 'crear_reserva', { habitacion_id: 'zzz', nombre: 'Ana', apellido: 'Paz' }), /última búsqueda/);
    const res = await tools.run(conv, 'crear_reserva', { habitacion_id: 'b', nombre: 'Ana', apellido: 'Paz', total: 1 });
    const body = calls.find((c) => c.url.endsWith('/api/eventos')).body;
    assert.strictEqual(body.total, 5000, 'total sale de la cotización, no del LLM');
    assert.strictEqual(body.isDeposit, true);
    assert.strictEqual(body.clientPhone, '523312345678');
    assert.strictEqual(res.anticipo_mxn, 2500);
    assert.strictEqual(res.pago, undefined, 'con cuenta financiera el flujo sigue automático');
    assert.strictEqual(conv.escalated, false);
    assert.ok(calls.some((c) => c.url.endsWith('/api/utilidades/reserva') && c.body.idReserva === 'r1'));
    await assert.rejects(tools.run(conv, 'crear_reserva', { habitacion_id: 'a', nombre: 'Ana', apellido: 'Paz' }), /Ya se creó/);

    await assert.rejects(tools.run(conv, 'registrar_pago', { importe: 2500 }), /comprobante/);
    conv.receipt = { buffer: Buffer.from('x'), mimeType: 'image/jpeg', filename: 'c.jpg' };
    await tools.run(conv, 'registrar_pago', { importe: 2500, codigo_operacion: 'ABC' });
    const pago = calls.find((c) => c.url.endsWith('/api/pagos')).body;
    assert.strictEqual(pago.reservacionId, 'r1');
    assert.strictEqual(pago.metodoPago, 'Transferencia');
    assert.strictEqual(conv.escalated, true);

    // Propiedad sin cuenta financiera: se reserva igual y pasa a humano.
    const conv3 = { ...conv, quote: conv.quote, reservation: null, receipt: null, escalated: false };
    const res3 = await tools.run(conv3, 'crear_reserva', { habitacion_id: 'a', nombre: 'Ana', apellido: 'Paz' });
    assert.strictEqual(res3.pago, 'manual');
    assert.strictEqual(conv3.escalated, true);
    assert.match(conv3.escalationReason, /sin cuenta financiera/);

    await engineCheck();
    console.log('bot.check OK');
})();

// Loop del engine con el SDK sustituido por respuestas guionadas.
async function engineCheck() {
    const scripted = [];
    const requests = [];
    const sdkPath = require.resolve('@anthropic-ai/sdk');
    require.cache[sdkPath] = {
        id: sdkPath, filename: sdkPath, loaded: true,
        exports: class { constructor() { this.messages = { create: async (req) => { requests.push(req); return scripted.shift(); } }; } },
    };
    const engine = require('./engine');
    const conv = engine.newConversation({ name: 'Test', userId: 'u1' }, '523312345678');

    scripted.push(
        { stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'tool_use', id: 't1', name: 'detalle_propiedad', input: { habitacion_id: 'x' } }] },
        { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'escalar_a_humano', input: { motivo: 'queja' } }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Te comunico con el equipo' }] },
    );
    assert.deepStrictEqual(await engine.reply(conv, 'quiero poner una queja'), ['Te comunico con el equipo']);
    const toolErr = conv.messages[2].content[0];
    assert.ok(toolErr.is_error && /última búsqueda/.test(toolErr.content), 'error de tool regresa al modelo');
    assert.strictEqual(conv.messages[1].content[0].type, 'thinking', 'bloques thinking se conservan');
    assert.strictEqual(conv.escalated, true);
    assert.deepStrictEqual(await engine.reply(conv, '¿hola?'), [], 'escalada: ya no responde');
    assert.strictEqual(requests.length, 3);

    const conv2 = engine.newConversation({ name: 'Test', userId: 'u1' }, '523312345678');
    scripted.push({ stop_reason: 'refusal', content: [] });
    assert.match((await engine.reply(conv2, 'x'))[0], /equipo/);
    assert.strictEqual(conv2.escalated, true);

    // Llamada escrita como texto: no se envía, se reintenta una vez con recordatorio.
    const conv4 = engine.newConversation({ name: 'Test', userId: 'u1' }, '523312345678');
    const leaked = { stop_reason: 'end_turn', content: [{ type: 'text', text: '[Tool call: buscar_disponibilidad with huespedes 2]' }] };
    scripted.push(leaked, { stop_reason: 'end_turn', content: [{ type: 'text', text: '¿Cuántas personas son?' }] });
    assert.deepStrictEqual(await engine.reply(conv4, 'hola'), ['¿Cuántas personas son?']);
    assert.deepStrictEqual(conv4.messages.map((m) => m.role), ['user', 'system', 'assistant'], 'turno filtrado descartado, recordatorio tras el user');
    scripted.push(leaked, leaked);
    assert.match((await engine.reply(conv4, '2'))[0], /equipo/, 'si se repite, pasa a humano');
    assert.strictEqual(conv4.escalated, true);
}
