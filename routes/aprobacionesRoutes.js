const express = require('express');
const router = express.Router();
const aprobacionesController = require('../controllers/aprobacionesController');

router.get('/aprobaciones', aprobacionesController.showApprovalsView);   

module.exports = router;
