// models/WebhookEvent.js
const mongoose = require('mongoose');

const WebhookEventSchema = new mongoose.Schema({
    provider: { type: String, default: 'openpay' },
    eventId: { type: String, required: true, unique: true }, // usa transaction.id
    type: { type: String, required: true },                  // p.ej. charge.completed
    payload: {},
    processedAt: Date,
    attempts: { type: Number, default: 0 },
    error: String
}, { timestamps: true });

module.exports = mongoose.model('WebhookEvent', WebhookEventSchema);
