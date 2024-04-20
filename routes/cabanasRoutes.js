const express = require('express');
const router = express.Router();
const cabanasController = require('../controllers/cabanasController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/cabanas', (req, res) => {
    res.render('vistaCabanas', {
        layout: 'cabanas'
    });
});

router.post('/cabanas/crear-cabana', cabanasController.createChaletValidators, validationRequest, cabanasController.createChalet);

module.exports = router;