const express = require('express')
const router = express.Router()
const channexController = require('../controllers/channexController');

//   /api/channex/

router.get('/home', (req, res) => {
    res.render('homeChannex', {
        layout: 'mainChannex',
        error: req.query.error 
    });
});
router.get('/properties', channexController.mapProperties);
router.post('/properties/:id/create', channexController.createChannexProperty);

// Dashboard (requiere estar conectado)
router.get('/dashboard', async (req, res) => {
    if (!req.session.channelId) return res.redirect('/?error=Debe+conectar+Airbnb');

    const propiedades = await Habitacion.find().lean();
    const chProps = await channexCtrl.getProperties(req.session.channelId);

    res.render('dashboard', { propiedades, chProps });
});

router.post('/webhooks', channexController.webhookReceptor);
router.get('/connect/airbnb', channexController.airbnbConnection);
router.get('/auth/airbnb/callback', channexController.oauthAirbnb);
router.post('/channels/:channelId/mappings', channexController.mapPropertiesAirbnb);
router.post('/channels/:channelId/activate', channexController.activateChannel);

module.exports = router