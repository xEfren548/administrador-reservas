const router = require("express").Router();

// Webhook Meta

const VERIFY_TOKEN = 'EAALyoAZAkGtcBO9Nf0uqLDA0cxW0VOyk5ozi1E70RdKm9ZAMZB9TV7pP3snHnamENisrszYYUV8msl9NX4GAA7ftlt8p5akNT41khotJ88pp1JtYGbC8DlrBDcnCvf1HnXAbEPvnjPq6dZCTux2Rp4IjBhUoEYQkkvg0BJbmNHNjksYWBEzCSQZDZD'
// Endpoint para el webhook
router.post('/webhook', (req, res) => {
    const body = req.body;

    // Manejo de mensajes entrantes
    if (body.object) {
        console.log('Mensaje recibido:', JSON.stringify(body, null, 2));

        // Responder con un estado 200 para confirmar la recepción
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook verificado');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

module.exports = router;