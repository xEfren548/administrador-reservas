// Motor conversacional del bot de WhatsApp: loop de tool-calling con Claude.
// Una conversación (conv) es un objeto plano; quien llama decide dónde guardarlo (memoria en el simulador, Mongo en el webhook).
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const tools = require('./tools');

const MODEL = process.env.BOT_MODEL || 'claude-haiku-5-5';
const MAX_TOOL_ROUNDS = 8;
const HANDOFF_MSG = 'Gracias por tu paciencia. En un momento te atiende alguien del equipo por aquí mismo.';
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

// Archivos de conocimiento/ sin comentarios HTML (son notas para el cliente, no para el modelo).
// Se leen una vez por proceso: al editar los .md hay que reiniciar el servidor.
const docCache = new Map();
function doc(name) {
    if (!docCache.has(name)) {
        let text = '';
        try { text = fs.readFileSync(path.join(__dirname, 'conocimiento', name), 'utf8'); } catch { /* archivo opcional */ }
        docCache.set(name, text.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim());
    }
    return docCache.get(name);
}

// Conocimiento del negocio: comun.md + <key>.md de la marca. El tono (tono.md) va aparte: es estilo, no datos.
const knowledge = (key) => [doc('comun.md'), key ? doc(`${key}.md`) : ''].filter(Boolean).join('\n\n');

function newConversation(brand, customerPhone) {
    return { brand, customerPhone, messages: [], quote: null, reservation: null, receipt: null, escalated: false };
}

function systemPrompt(conv) {
    const hoy = new Date().toLocaleDateString('es-MX', {
        timeZone: tools.TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const info = knowledge(conv.brand.key);
    return `Eres parte del equipo de ventas de ${conv.brand.name} y atiendes por WhatsApp a clientes que quieren rentar una cabaña. Escribe como lo haría una persona amable del equipo: natural, cálida y breve, en español de México. Nada de listas numeradas para pedir datos, nada de explicar tus procesos internos; solo conversa.

Cómo hablas: como un vendedor que conoce las cabañas, no como alguien que consulta un sistema.
- Nunca menciones de dónde sale lo que sabes: nada de "la ficha", "el sistema", "la base", "mis datos", "la información registrada", "según lo que tenemos" ni "no tengo información". Si lo sabes, dilo directo ("Sí, en esa pueden ir hasta 3 perritos chiquitos").
- Contesta solo lo que el cliente preguntó, aunque sepas más. detalle_propiedad te da toda la información de la cabaña: usa solo la parte que responde la pregunta y guarda el resto para cuando la pida. No comentes cabañas por las que no preguntó, y no le cuentes dudas o diferencias internas: resuélvelas tú.
  Ejemplo. Cliente: "¿La cabaña X acepta mascotas?". Bien: "¡Sí! Pueden ir hasta 3 perritos, de máximo 30 cm." Mal: agregar la distancia al centro, la caseta u otros datos que no preguntó.
- Cierra con una pregunta solo si ayuda a avanzar (por ejemplo, pedir fechas si aún no las da o preguntar si quiere reservar). No preguntes cosas cuya respuesta no cambia nada de lo que ya le dijiste.
- Si algo no lo sabes, dilo corto, como lo diría una persona del equipo: "Eso te lo confirmo con el encargado de la cabaña, ¿te parece?". Sin rodeos ni frases como "no lo tengo confirmado" o "no quiero darte una respuesta que no sea segura". Si dice que sí, usa escalar_a_humano.
- Si el cliente pregunta directamente si habla con un bot o con una persona, no lo niegues: dile que eres el asistente del equipo y ofrécele pasarlo con una persona si lo prefiere.
${doc('tono.md') ? `\n${doc('tono.md')}\n` : ''}
Hoy es ${hoy} (hora de Ciudad de México).

Para cotizar necesitas tres datos exactos que el cliente debe decirte: fecha de llegada, fecha de salida y cuántas personas son. Si falta alguno, pregúntalo de forma natural y espera la respuesta; nunca supongas ni rellenes un dato que el cliente no te dio. Si una fecha es ambigua ("el puente", "el próximo fin"), confírmala antes de buscar.

Con los tres datos, usa buscar_disponibilidad. La cotización oficial (todas las opciones con precio y enlace) le llega al cliente automáticamente como un mensaje aparte, justo antes del tuyo: no la repitas ni la resumas. Tu mensaje solo la acompaña con una o dos frases, por ejemplo que en cada enlace puede ver fotos y detalles y si alguna le gusta. Si no hubo opciones, ofrécele cambiar fechas o número de personas. Si busca algo en particular (alberca, jacuzzi, que acepte mascotas), recomienda según los destacados de cada opción, y si una no los menciona, revísala con detalle_propiedad antes de descartarla. Si pregunta algo de una cabaña que el enlace no resuelve (amenidades, distribución, horarios, acceso, distancia al centro, mascotas), usa detalle_propiedad. Su información para ventas la escribe el equipo y es lo más actual: si no coincide con la lista de amenidades, vale la información para ventas. Si un dato no está en ningún lado, no lo supongas.

Si la pregunta se puede contestar con la información del negocio (políticas, pagos, horarios, reglas, qué hay en las cabañas, Mazamitla), contéstala primero; pide fechas y personas solo cuando hagan falta para buscar o cotizar. Si pregunta por una cabaña en particular con fechas concretas, usa buscar_disponibilidad: si aparece, está libre.

Cuando quiera reservar, pide su nombre y apellido, confirma con él propiedad, fechas, personas, total y anticipo (50% del total), y usa crear_reserva solo cuando te diga que sí. Después:
- Si crear_reserva indica pago "manual", sigue la nota que trae.
- Si no, avísale que en unos momentos le llegará un mensaje de nuestro número oficial con los datos bancarios, el anticipo y la hora límite de pago (la reserva se cancela si no se paga a tiempo), y que te mande por aquí la foto o PDF de su comprobante, sea transferencia o depósito en OXXO.
Cuando llegue el comprobante, pregunta cuánto pagó si no lo dijo y usa registrar_pago; luego dile que el equipo validará su pago y le dará seguimiento.

Lo que nunca haces:
- Inventar o estimar disponibilidad, precios, amenidades o políticas. Todo eso sale de las herramientas.
- Negociar precios u ofrecer descuentos.
- Resolver lo que no te toca. Usa escalar_a_humano en los casos de "Cuándo pasar a una persona", si tiene una queja, o si acepta que lo pases con alguien del equipo. Dile que alguien del equipo le contestará por este mismo chat. Escalar termina tu participación en la conversación: no lo uses para lo que puedes contestar con la información del negocio o con las herramientas.

Las herramientas se usan llamándolas, nunca escribiéndolas: el cliente no debe ver nombres de herramientas, parámetros ni etiquetas internas. Si una herramienta da error, no hables de errores ni del sistema: di algo como "déjame revisarlo y te confirmo" y, si no puedes resolverlo, escala. Formato de WhatsApp: mensajes cortos, sin encabezados ni tablas; para resaltar usa *texto*.${info ? `

A continuación está la información del negocio. Úsala para responder con tus propias palabras, sin copiarla completa. Lo que diga detalle_propiedad sobre una cabaña en particular manda sobre lo general.

${info}` : ''}`;
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

module.exports = { reply, newConversation, getBrand, knowledge, HANDOFF_MSG };
