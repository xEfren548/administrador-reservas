const express = require('express')
const router = express.Router()
const channexController = require('../controllers/channexController');

//   /api/channex/

// Vistas  ----------------
router.get('/home', (req, res) => {
    if (req.session.channelId) return res.redirect('/api/channex/dashboard');
    res.render('homeChannex', {
        //layout: 'mainChannex',
        error: req.query.error 
    });
});
router.get('/dashboard', channexController.dashboardChannexFull);
router.get('/properties', channexController.mapProperties);
router.post('/properties/:id/create', channexController.createChannexProperty);
router.get('/propiedades', channexController.showCreatedPropertiesAirbnb);

router.post('/webhooks', channexController.webhookReceptor);
router.get('/connect/airbnb', channexController.airbnbConnection);
router.get('/auth/airbnb/callback', channexController.oauthAirbnb);
router.post('/channels/:channelId/mappings', channexController.mapPropertiesAirbnb);
router.post('/channels/:channelId/activate', channexController.activateChannel);

// Rooms and rates
router.post('/rooms', channexController.createRoomChannex);
router.post('/rates', channexController.createRateChannex);

router.post('/availability-rates', async (req, res) => {
    const { pmsId } = req.body;
    try {
        // Obtiene precios y la fecha límite (fin de año, por si la quieres mostrar)
        const { data: prices, fechaLimite } = await channexController.updateChannexPrices(pmsId);

        // La disponibilidad siempre cubrirá ese mismo rango (hoy a 1 año)
        const availability = await channexController.updateChannexAvailability(pmsId);
        res.status(200).json({ prices, availability, fechaLimite });
    } catch (err) {
        console.error('Error al actualizar precios en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }
});


module.exports = router