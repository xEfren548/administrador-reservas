const express = require('express')
const router = express.Router()
const channexController = require('../controllers/channexController');

router.get('/properties', channexController.mapProperties);

module.exports = router