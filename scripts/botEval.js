// Pruebas del bot con las preguntas del FAQ (Excel): cada variante se manda como primer mensaje de una conversación
// nueva y se califica. Grupos de faq_chatbot_clasificacion.md:
//   - "escalar" (D): pasa si el bot llamó a escalar_a_humano. Si no, lo califica el modelo: cada variante llega sin
//     contexto, y ante un mensaje ambiguo ("¿Qué hago?") pedir aclaración es correcto.
//   - "responder" (A, B, C): un modelo compara la respuesta con la "Respuesta sugerida" del Excel.
//   - "pendiente" (X): decisión del cliente sin definir; se omite salvo --pendientes.
// buscar_disponibilidad y detalle_propiedad consultan el servidor de verdad (npm run dev, base de desarrollo).
// crear_reserva y registrar_pago se simulan: nunca se crean reservas ni pagos.
//
// Uso:  node scripts/botEval.js <marca> <ruta.xlsx> [--ids C01,C03-05] [--limit 20] [--concurrency 4] [--pendientes]
// Requiere en .env: ANTHROPIC_API_KEY, JWT_SECRET, BOT_BRANDS y URL o BOT_API_URL. Modelo calificador: BOT_EVAL_MODEL.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const Anthropic = require('@anthropic-ai/sdk');
const engine = require('../services/bot/engine');
const tools = require('../services/bot/tools');

const JUDGE_MODEL = process.env.BOT_EVAL_MODEL || 'claude-opus-5-5';
const OUT_DIR = path.join(__dirname, '..', 'eval-resultados');

const range = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}-${String(from + i).padStart(2, '0')}`);
const ESCALAR = new Set([
    'C01-10', 'C01-19', 'C01-22', 'C01-26', 'C01-27', 'C02-06', 'C02-16', 'C03-12', 'C03-19',
    'C04-10', 'C04-17', 'C05-02', 'C05-05', 'C05-09', 'C06-06', ...range('C09', 1, 17),
    'C10-06', 'C10-07', 'C10-08', 'C10-09', 'C10-15',
]);
const PENDIENTES = new Set([
    'C01-02', 'C01-14', 'C01-25', 'C02-04', 'C02-08', 'C02-12', 'C02-13', 'C02-14', 'C02-15', 'C03-04', 'C03-07',
    'C03-10', 'C03-15', 'C03-21', 'C04-01', 'C04-04', 'C04-16', 'C06-07', 'C06-30', 'C07-02', 'C07-14', 'C08-07',
]);
const group = (id) => (ESCALAR.has(id) ? 'escalar' : PENDIENTES.has(id) ? 'pendiente' : 'responder');

// Variantes de la columna del Excel; si no hay, la pregunta misma (salvo plantillas con [fecha], [nombre]...).
function variants(row) {
    const list = String(row['Así la escriben los clientes (variantes)'] || '')
        .split(' / ').map((s) => s.trim()).filter((s) => s && s !== '—');
    if (list.length) return list;
    const q = String(row['Pregunta'] || '').trim();
    return q && !q.includes('[') ? [q] : [];
}

// Simula lo que escribe en la base; registra qué herramientas usó el bot.
const realRun = tools.run;
tools.run = async (conv, name, input) => {
    conv.toolCalls.push(name);
    if (name === 'crear_reserva') {
        conv.reservation = { id: 'EVAL', total: 0 };
        return { reserva_id: 'EVAL', mensaje_sistema: 'Reserva de prueba (simulada)', total_mxn: 0, anticipo_mxn: 0 };
    }
    if (name === 'registrar_pago') {
        conv.escalated = true;
        return { ok: true, nota: 'Pago registrado como pendiente de validación (simulado).' };
    }
    return realRun(conv, name, input);
};

// El bot responde con toda la información del negocio (no solo la de la pregunta), así que el calificador también la recibe.
const judgeSystem = (info) => `Calificas respuestas de un chatbot que vende renta de cabañas por WhatsApp. Recibes el primer mensaje del cliente, la respuesta de referencia que redactó el equipo para esa pregunta, las herramientas que usó el bot y lo que contestó. Abajo está la información oficial del negocio que el bot tiene: lo que diga ahí no es inventado aunque no esté en la referencia.

Es "bien" si responde lo que el cliente preguntó, o pide de forma natural los datos que faltan para responder (fechas, número de personas, cuál cabaña); no contradice la referencia ni la información oficial en políticas, montos, horarios ni reglas; y no inventa datos (precios, disponibilidad, amenidades, políticas) que no estén en la referencia, en la información oficial ni vengan de una herramienta. No tiene que copiar la referencia ni decir todo lo que dice: enlaces de catálogo, datos bancarios o promociones de la referencia no son obligatorios, y puede ser más breve. Si la referencia y la información oficial difieren, vale lo de la información oficial.

Es "mal" si contradice, inventa, no atiende la pregunta, o pasa a una persona (escalar_a_humano) algo que la referencia o la información oficial sí responden.

Si el mensaje dice "Grupo: debe atenderlo una persona", el bot debía usar escalar_a_humano y no lo hizo. Aun así es "bien" si el mensaje, leído como primer mensaje sin contexto, es ambiguo y el bot pidió aclaración sin prometer ni inventar, o si dio la misma orientación que la referencia. Es "mal" si dejó sin atender algo que requiere a una persona (un problema en curso, un huésped esperando, un cambio a una reserva existente, una queja).

motivo: una frase en español; si es "mal", di qué falló.

# Información oficial del negocio

${info}`;

const JUDGE_SCHEMA = {
    type: 'object',
    properties: { veredicto: { type: 'string', enum: ['bien', 'mal'] }, motivo: { type: 'string' } },
    required: ['veredicto', 'motivo'],
    additionalProperties: false,
};

let judgeClient;
const judgeUsage = { input: 0, output: 0 };

async function judge(brand, c, reply, toolCalls) {
    judgeClient ??= new Anthropic();
    const res = await judgeClient.messages.create({
        model: JUDGE_MODEL,
        max_tokens: 4000,
        system: [{ type: 'text', text: judgeSystem(engine.knowledge(brand.key)), cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: JUDGE_SCHEMA } },
        messages: [{
            role: 'user',
            content: `${c.grupo === 'escalar' ? 'Grupo: debe atenderlo una persona\n\n' : ''}Pregunta del FAQ: ${c.pregunta}\n\nMensaje del cliente: ${c.texto}\n\nRespuesta de referencia: ${c.referencia}\n\nHerramientas que usó el bot: ${toolCalls.join(', ') || 'ninguna'}\n\nRespuesta del bot:\n${reply}`,
        }],
    });
    judgeUsage.input += res.usage.input_tokens;
    judgeUsage.output += res.usage.output_tokens;
    if (res.stop_reason === 'refusal') return { veredicto: 'mal', motivo: 'El calificador se negó a evaluar' };
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return JSON.parse(text);
}

async function runCase(brand, c) {
    const conv = engine.newConversation(brand, '523300000000');
    conv.toolCalls = [];
    let reply;
    try {
        reply = (await engine.reply(conv, c.texto)).join('\n\n');
    } catch (err) {
        return { ...c, reply: '', toolCalls: conv.toolCalls, veredicto: 'mal', motivo: `Error del bot: ${err.message}` };
    }
    if (c.grupo === 'escalar' && conv.toolCalls.includes('escalar_a_humano')) {
        return { ...c, reply, toolCalls: conv.toolCalls, veredicto: 'bien', motivo: 'Escaló' };
    }
    try {
        return { ...c, reply, toolCalls: conv.toolCalls, ...(await judge(brand, c, reply, conv.toolCalls)) };
    } catch (err) {
        return { ...c, reply, toolCalls: conv.toolCalls, veredicto: 'mal', motivo: `Error del calificador: ${err.message}` };
    }
}

async function pool(items, n, fn, onDone) {
    const out = [];
    let next = 0;
    await Promise.all(Array.from({ length: n }, async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
            onDone(out[i]);
        }
    }));
    return out;
}

const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

function report(brand, results, file) {
    const byCat = {};
    for (const r of results) {
        const k = `${r.categoria} (${r.grupo})`;
        byCat[k] ??= { bien: 0, total: 0 };
        byCat[k].total++;
        if (r.veredicto === 'bien') byCat[k].bien++;
    }
    const ok = results.filter((r) => r.veredicto === 'bien').length;
    const lines = [
        `# Prueba del bot — ${brand.name} (${brand.key})`,
        '',
        `${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} · modelo del bot: ${process.env.BOT_MODEL || 'claude-haiku-5-5'} · calificador: ${JUDGE_MODEL}`,
        '',
        `**${ok} de ${results.length} bien (${Math.round((100 * ok) / results.length)}%)**`,
        '',
        '| Categoría | Bien | Total |',
        '|---|---|---|',
        ...Object.entries(byCat).map(([k, v]) => `| ${k} | ${v.bien} | ${v.total} |`),
        '',
        '## Fallas',
        '',
        '| ID | Grupo | Mensaje del cliente | Respuesta del bot | Herramientas | Motivo |',
        '|---|---|---|---|---|---|',
        ...results.filter((r) => r.veredicto !== 'bien')
            .map((r) => `| ${r.id} | ${r.grupo} | ${md(r.texto)} | ${md(r.reply)} | ${r.toolCalls.join(', ')} | ${md(r.motivo)} |`),
        '',
        '## Todas las respuestas',
        '',
        '| ID | Veredicto | Mensaje del cliente | Respuesta del bot | Herramientas |',
        '|---|---|---|---|---|',
        ...results.map((r) => `| ${r.id} | ${r.veredicto} | ${md(r.texto)} | ${md(r.reply)} | ${r.toolCalls.join(', ')} |`),
    ];
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(file, lines.join('\n'));
}

async function main() {
    const args = process.argv.slice(2);
    const flag = (name) => {
        const i = args.indexOf(`--${name}`);
        return i >= 0 ? args[i + 1] : undefined;
    };
    const [brandKey, xlsxPath] = args;
    const brand = engine.getBrand(brandKey);
    if (!brand || !xlsxPath) {
        console.error('Uso: node scripts/botEval.js <marca de BOT_BRANDS> <ruta.xlsx> [--ids C01,C03-05] [--limit N] [--concurrency 4] [--pendientes]');
        process.exit(1);
    }

    const apiUrl = process.env.BOT_API_URL || process.env.URL;
    try {
        await fetch(apiUrl);
    } catch {
        console.error(`No responde ${apiUrl}. Levanta el servidor (npm run dev) antes de correr la prueba.`);
        process.exit(1);
    }

    const wb = XLSX.readFile(xlsxPath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Preguntas frecuentes'] || wb.Sheets[wb.SheetNames.at(-1)]);
    const ids = flag('ids')?.split(',').map((s) => s.trim());
    let cases = rows
        .filter((r) => r.ID && (!ids || ids.some((p) => String(r.ID).startsWith(p))))
        .flatMap((r) => variants(r).map((texto) => ({
            id: r.ID,
            categoria: r['Categoría'],
            grupo: group(r.ID),
            pregunta: r['Pregunta'],
            referencia: r['Respuesta sugerida para el chatbot'],
            texto,
        })))
        .filter((c) => c.grupo !== 'pendiente' || args.includes('--pendientes'));
    if (flag('limit')) cases = cases.slice(0, Number(flag('limit')));

    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const file = path.join(OUT_DIR, `${brand.key}-${stamp}.md`);
    console.log(`${cases.length} casos para ${brand.name}. Reporte: ${file}`);

    let done = 0;
    const results = await pool(cases, Number(flag('concurrency') || 4), (c) => runCase(brand, c), (r) => {
        done++;
        console.log(`[${done}/${cases.length}] ${r.veredicto === 'bien' ? 'OK  ' : 'MAL '} ${r.id}  ${r.texto.slice(0, 60)}`);
    });

    report(brand, results, file);
    const ok = results.filter((r) => r.veredicto === 'bien').length;
    console.log(`\n${ok}/${results.length} bien. Calificador: ${judgeUsage.input} tokens de entrada, ${judgeUsage.output} de salida.`);
    console.log(`Reporte: ${file}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
