// Simulador del bot de WhatsApp en terminal (sin YCloud). Requiere el servidor corriendo (npm run dev),
// ANTHROPIC_API_KEY, JWT_SECRET y BOT_BRANDS en .env.
//
// Uso:   node scripts/botSimulator.js <marca> [telefonoCliente]
// En el chat:  /comprobante <ruta a jpg|png|pdf>   /estado   /salir
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const { reply, newConversation, getBrand } = require('../services/bot/engine');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' };

async function main() {
    const [brandKey, phone = '523300000000'] = process.argv.slice(2);
    const brand = getBrand(brandKey);
    if (!brand) {
        console.error(`Marca "${brandKey}" no encontrada en BOT_BRANDS.`);
        process.exit(1);
    }

    const conv = newConversation(brand, phone);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`Simulando ${brand.name} como cliente ${phone}. /salir para terminar.\n`);

    while (true) {
        const line = (await rl.question('cliente> ')).trim();
        if (!line) continue;
        if (line === '/salir') break;
        if (line === '/estado') {
            console.log(JSON.stringify({ quote: conv.quote && { ...conv.quote, rooms: conv.quote.rooms.length }, reservation: conv.reservation, escalated: conv.escalated, escalationReason: conv.escalationReason }, null, 2));
            continue;
        }

        let text = line;
        if (line.startsWith('/comprobante ')) {
            const file = line.slice('/comprobante '.length).trim();
            const mimeType = MIME[path.extname(file).toLowerCase()];
            if (!mimeType || !fs.existsSync(file)) {
                console.log('(archivo no encontrado o tipo no soportado)');
                continue;
            }
            conv.receipt = { buffer: fs.readFileSync(file), mimeType, filename: path.basename(file) };
            text = `[El cliente envió un archivo: ${path.basename(file)}]`;
        }

        try {
            const out = await reply(conv, text);
            if (!out.length) console.log('(conversación escalada: el bot ya no responde)\n');
            for (const msg of out) console.log(`\nbot> ${msg}\n`);
        } catch (err) {
            console.error('Error:', err.message);
        }
    }
    rl.close();
}

main();
