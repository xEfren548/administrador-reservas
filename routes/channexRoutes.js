const express = require('express')
const router = express.Router()
const channexController = require('../controllers/channexController');

//   /api/channex/

router.get('/properties', channexController.mapProperties);
router.post('/webhooks', channexController.webhookReceptor);
router.get('/connect/airbnb', channexController.airbnbConnection);
router.get('/auth/airbnb/callback', channexController.oauthAirbnb);
router.post('/channels/:channelId/mappings', channexController.mapPropertiesAirbnb);
router.post('/channels/:channelId/activate', channexController.activateChannel);

module.exports = router