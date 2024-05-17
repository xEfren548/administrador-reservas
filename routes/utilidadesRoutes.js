const express = require('express');
const router = express.Router();
const utilidadesController = require('../controllers/utilidadesController');

router.get('/utilidades', utilidadesController.calcularComisiones)


module.exports = router