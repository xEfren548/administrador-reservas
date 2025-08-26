const express = require('express');
const router = express.Router();

const tipologiasController = require('../controllers/tipologiasController');

router.get('/tipologias', tipologiasController.renderTipologiaView);
router.get('/api/tipologias', tipologiasController.getTipologias);
router.post('/api/tipologias', tipologiasController.createTipologia);
router.put('/api/tipologias/:id', tipologiasController.editTipologia);
router.delete('/api/tipologias/:id', tipologiasController.deleteTipologia);

module.exports = router;