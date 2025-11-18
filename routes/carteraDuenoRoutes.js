const express = require('express');
const router = express.Router();
const carteraDuenoController = require('../controllers/carteraDuenoController');

// Obtener resumen de cartera
router.get('/', carteraDuenoController.obtenerCarteraDueno);

// Exportar cartera a Excel (retorna datos estructurados)
router.get('/exportar', carteraDuenoController.exportarCarteraExcel);

module.exports = router;
