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
    const { pmsId } = req.body
    try {
        const { data: prices, fechaLimite } = await channexController.updateChannexPrices(pmsId);
        // Ahora sí, pásale la fechaLimite a la disponibilidad
        const availability = await channexController.updateChannexAvailability(pmsId, fechaLimite);
        res.send({ prices, availability, fechaLimite });
        // res.status(200).json({ "message": "Precios actualizados"});
    } catch (err) {
        console.error('Error al actualizar precios en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }
})

module.exports = router