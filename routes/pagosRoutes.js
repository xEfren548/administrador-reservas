const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');

router.get('/:id', pagoController.obtenerPagoPorId); 
router.post('/', pagoController.registrarPago)
router.put('/:id', pagoController.editarPago)
router.delete('/:id', pagoController.eliminarPago)
router.put('/liquidar/:id', pagoController.liquidarReservaDueno)

router.get('/', pagoController.renderPagos);

module.exports = router;