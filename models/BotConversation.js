// Conversación del bot de WhatsApp (una por marca + cliente). Guarda el estado que usa services/bot/engine.js.
const mongoose = require('mongoose');

const BotConversationSchema = new mongoose.Schema({
    brandKey: { type: String, required: true },          // key en BOT_BRANDS
    customerPhone: { type: String, required: true },     // mismo formato que Cliente.phone (52 + 10 dígitos)
    waId: { type: String, required: true },              // número tal como lo manda YCloud; a este se responde
    messages: { type: Array, default: [] },              // historial de la API de Anthropic, sin editar
    quote: { type: mongoose.Schema.Types.Mixed, default: null },
    reservation: { type: mongoose.Schema.Types.Mixed, default: null },
    receipt: {
        type: new mongoose.Schema({ buffer: Buffer, mimeType: String, filename: String }, { _id: false }),
        default: null,
    },
    escalated: { type: Boolean, default: false },
    escalationReason: { type: String, default: null },
    sentIds: { type: [String], default: [] },            // ids de lo que mandó el bot, para no confundirlo con un humano en los echoes
}, { timestamps: true });

BotConversationSchema.index({ brandKey: 1, customerPhone: 1 }, { unique: true });

module.exports = mongoose.model('BotConversation', BotConversationSchema);
