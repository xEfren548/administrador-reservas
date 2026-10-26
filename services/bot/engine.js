// Motor conversacional del bot de WhatsApp: loop de tool-calling con Claude.
// Una conversación (conv) es un objeto plano; quien llama decide dónde guardarlo (memoria en el simulador, Mongo en el webhook).
const Anthropic = require('@anthropic-ai/sdk');
const tools = require('./tools');

const MODEL = process.env.BOT_MODEL || 'claude-haiku-5-5';
const MAX_TOOL_ROUNDS = 8;
const HANDOFF_MSG = 'Gracias por tu paciencia. Una persona de nuestro equipo continuará la conversación contigo en breve.';
// Texto que menciona una herramienta = el modelo "escribió" la llamada en vez de hacerla; nunca debe llegarle al cliente.
const LEAKED_TOOL = new RegExp(`tool[ _]?call|\\b(${tools.definitions.map((t) => t.name).join('|')})\\b`, 'i');
const TOOL_REMINDER = 'Para usar una herramienta haz la llamada real; nunca la escribas como texto ni menciones nombres de herramientas al cliente.';

let client;

// BOT_BRANDS en .env (JSON): [{"key":"rentravel","name":"Rentravel","phone":"5233XXXXXXXX","userId":"<id usuario técnico>"}]
// phone = número del bot de esa marca; userId = usuario técnico (Vendedor) cuyo teléfono es ese mismo número.
function getBrand(key) {
    const brands = JSON.parse(process.env.BOT_BRANDS || '[]');
    return brands.find((b) => b.key === key);
}

function newConversation(brand, customerPhone) {
    return { brand, customerPhone, messages: [], quote: null, reservation: null, receipt: null, escalated: false };
}

function systemPrompt(conv) {
    const hoy = new Date().toLocaleDateString('es-MX', {
        timeZone: tools.TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    // ponytail: políticas del negocio (cancelación, mascotas, check-in/out, horario de la torre de control) pendientes del cliente; agregarlas aquí
    return `Eres parte del equipo de ventas de ${conv.brand.name} y atiendes por WhatsApp a clientes que quieren rentar una cabaña. Escribe como lo haría una persona amable del equipo: natural, cálida y breve, en español de México. Nada de listas numeradas para pedir datos, nada de explicar tus procesos internos; solo conversa.

Hoy es ${hoy} (hora de Ciudad de México).

Para cotizar necesitas tres datos exactos que el cliente debe decirte: fecha de llegada, fecha de salida y cuántas personas son. Si falta alguno, pregúntalo de forma natural y espera la respuesta; nunca supongas ni rellenes un dato que el cliente no te dio. Si una fecha es ambigua ("el puente", "el próximo fin"), confírmala antes de buscar.

Con los tres datos, usa buscar_disponibilidad. La cotización oficial (todas las opciones con precio y enlace) le llega al cliente automáticamente como un mensaje aparte, justo antes del tuyo: no la repitas ni la resumas. Tu mensaje solo la acompaña con una o dos frases, por ejemplo que en cada enlace puede ver fotos y detalles y si alguna le gusta. Si no hubo opciones, ofrécele cambiar fechas o número de personas. Si pregunta algo que el enlace no resuelve (amenidades, camas, baños), usa detalle_propiedad.

Cuando quiera reservar, pide su nombre y apellido, confirma con él propiedad, fechas, personas, total y anticipo (50% del total), y usa crear_reserva solo cuando te diga que sí. Después:
- Si crear_reserva indica pago "manual", sigue la nota que trae.
- Si no, avísale que en unos momentos le llegará un mensaje de nuestro número oficial con los datos bancarios, el anticipo y la hora límite de pago (la reserva se cancela si no se paga a tiempo), y que te mande por aquí la foto o PDF de su comprobante, sea transferencia o depósito en OXXO.
Cuando llegue el comprobante, pregunta cuánto pagó si no lo dijo y usa registrar_pago; luego dile que el equipo validará su pago y le dará seguimiento.

Lo que nunca haces:
- Inventar o estimar disponibilidad, precios, amenidades o políticas. Todo eso sale de las herramientas.
- Negociar precios u ofrecer descuentos.
- Resolver lo que no te toca. Usa escalar_a_humano si el cliente pide hablar con una persona, tiene una queja, quiere cambiar o cancelar una reserva existente, pregunta por factura, grupos o eventos, o pregunta algo que no sabes. Dile que alguien del equipo le contestará por este mismo chat.

Las herramientas se usan llamándolas, nunca escribiéndolas: el cliente no debe ver nombres de herramientas, parámetros ni etiquetas internas. Si una herramienta da error, explícalo en palabras simples o escala si no puedes resolverlo. Formato de WhatsApp: mensajes cortos, sin encabezados ni tablas; para resaltar usa *texto*.`;
}

const textOf = (content) => content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

// Agrega el mensaje del cliente y devuelve los mensajes a enviar, en orden (vacío si la conversación ya está con un humano).
// Los mensajes que arman las herramientas (p. ej. la cotización) van antes del texto del modelo.
async function reply(conv, userText) {
    if (conv.escalated) return [];
    conv.outbox = [];
    const text = await respond(conv, userText);
    const out = [...conv.outbox, text].filter(Boolean);
    conv.outbox = [];
    return out;
}

async function respond(conv, userText) {
    client ??= new Anthropic();
    conv.messages.push({ role: 'user', content: userText });
    let retried = false;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const res = await client.messages.create({
            model: MODEL,
            max_tokens: 4000,
            system: systemPrompt(conv),
            tools: tools.definitions,
            messages: conv.messages,
            output_config: { effort: 'medium' }, // con 'low' a veces escribía la llamada a la herramienta como texto
            cache_control: { type: 'ephemeral' },
        });
        // Se guarda el content completo (incluye bloques thinking) y nunca se edita el historial.
        conv.messages.push({ role: 'assistant', content: res.content });

        if (res.stop_reason === 'refusal') {
            conv.escalated = true;
            conv.escalationReason = 'Rechazo del modelo';
            return HANDOFF_MSG;
        }
        if (res.stop_reason !== 'tool_use') {
            const text = textOf(res.content);
            if (LEAKED_TOOL.test(text)) {
                if (retried) {
                    conv.escalated = true;
                    conv.escalationReason = 'El modelo escribió una llamada a herramienta como texto';
                    return HANDOFF_MSG;
                }
                // Ese turno nunca se envió: se descarta y se reintenta con un recordatorio (mensaje system, va tras el último user).
                conv.messages.pop();
                conv.messages.push({ role: 'system', content: TOOL_REMINDER });
                retried = true;
                continue;
            }
            return text || (conv.escalated ? HANDOFF_MSG : null);
        }

        const results = [];
        for (const block of res.content.filter((b) => b.type === 'tool_use')) {
            try {
                const out = await tools.run(conv, block.name, block.input);
                results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) });
            } catch (err) {
                results.push({ type: 'tool_result', tool_use_id: block.id, content: err.message, is_error: true });
            }
        }
        conv.messages.push({ role: 'user', content: results });
    }

    conv.escalated = true;
    conv.escalationReason = 'Demasiadas llamadas a herramientas';
    return HANDOFF_MSG;
}

module.exports = { reply, newConversation, getBrand, HANDOFF_MSG };
