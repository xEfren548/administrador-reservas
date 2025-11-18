const express = require('express');
const router = express.Router();
const notasDuenoController = require('../controllers/notasDuenoController');

// Agregar nota a reserva
router.post('/:id/notas', notasDuenoController.agregarNotaDueno);

// Obtener notas de reserva
router.get('/:id/notas', notasDuenoController.obtenerNotasDueno);

// Eliminar nota específica
router.delete('/:id/notas/:notaId', notasDuenoController.eliminarNotaDueno);

module.exports = router;
