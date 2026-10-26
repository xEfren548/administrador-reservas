// Webhook de YCloud para el bot de WhatsApp. El body llega crudo (express.raw en index.js) para validar la firma.
const router = require('express').Router();
const WebhookEvent = require('../models/WebhookEvent');
const { verifySignature, handleEvent } = require('../services/bot/ycloud');

router.post('/ycloud/webhook', async (req, res) => {
    if (!verifySignature(req.body, req.get('YCloud-Signature'), process.env.YCLOUD_WEBHOOK_SECRET)) {
        return res.sendStatus(401);
    }
    let event;
    try {
        event = JSON.parse(req.body);
    } catch {
        return res.sendStatus(400);
    }

    // Dedup: YCloud reintenta si no recibe 2xx a tiempo; el índice único de eventId descarta repetidos.
    try {
        await WebhookEvent.create({ provider: 'ycloud', eventId: event.id, type: event.type });
    } catch (err) {
        if (err.code === 11000) return res.sendStatus(200);
        console.error('[bot] No se pudo registrar el evento de YCloud:', err.message);
        return res.sendStatus(500);
    }

    // Se contesta de inmediato (YCloud espera < 6 s); el LLM y los envíos corren después.
    res.sendStatus(200);
    handleEvent(event)
        .then(() => WebhookEvent.updateOne({ eventId: event.id }, { processedAt: new Date() }))
        .catch((err) => {
            console.error(`[bot] Falló el evento ${event.id}:`, err.message);
            return WebhookEvent.updateOne({ eventId: event.id }, { error: err.message });
        })
        .catch(() => {});
});

module.exports = router;
