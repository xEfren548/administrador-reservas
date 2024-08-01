const express = require('express');
const moment = require('moment');
const router = express.Router();

const preciosEspecialesController = require('../controllers/preciosEspecialesController')

router.get('/api/precios-especiales', preciosEspecialesController.verificarExistenciaRegistro);
router.post('/api/precios-especiales', preciosEspecialesController.agregarNuevoPrecio)
router.get('/api/precios-especiales/:id', preciosEspecialesController.consultarPreciosPorId)
router.get('/api/consulta-fechas-precioespecial', preciosEspecialesController.consultarPreciosPorFecha)
router.delete('/api/precios-especiales', preciosEspecialesController.eliminarRegistroPrecio);








module.exports = router;