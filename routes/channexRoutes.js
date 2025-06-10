const express = require('express')
const router = express.Router()
const channexController = require('../controllers/channexController');

//   /api/channex/

// Vistas  ----------------
router.get('/home', (req, res) => {
    res.render('homeChannex', {
        //layout: 'mainChannex',
        error: req.query.error 
    });
});
router.get('/dashboard2', channexController.dashboardChannexFull);
router.get('/properties', channexController.mapProperties);
router.post('/properties/:id/create', channexController.createChannexProperty);
router.get('/propiedades', channexController.showCreatedPropertiesAirbnb);
// Dashboard (requiere estar conectado)
router.get('/dashboard', async (req, res) => {
    console.log(req.session)
    if (!req.session.channelId) return res.redirect('/api/channex/home?error=Debe+conectar+Airbnb');

    try {
        // const propiedades = await Habitacion.find().lean();
        const {propiedades, chProps} = await channexController.getChannexProperties(req.session.channelId);
    
        if (propiedades instanceof Error || chProps instanceof Error) {
            return res.redirect('/api/channex/home?error=Error+obteniendo+propiedades+de+Channex');
        }
        res.render('dashboardChannex', { propiedades, chProps });

    } catch (err) {
        console.error('Error al obtener propiedades de Channex:', err.response ? err.response.data : err.message);
        return res.redirect('/api/channex/home?error=Error+inesperado+obteniendo+propiedades');

    }
});

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
        const prices = await channexController.updateChannexPrices(pmsId);
        res.status(200).json({ "message": "Precios actualizados"});
    } catch (err) {
        console.error('Error al actualizar precios en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }
})

module.exports = router