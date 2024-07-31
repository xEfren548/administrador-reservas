const express = require('express');
const moment = require('moment');
const router = express.Router();

const preciosEspecialesController = require('../controllers/preciosEspecialesController')

router.post('/api/agregar-precios-especiales', preciosEspecialesController.agregarNuevoPrecio)










module.exports = router;