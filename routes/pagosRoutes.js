const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const upload = require('../config/multer');

// Tiene prefijo /api
router.get('/obtener', pagoController.obtenerPagoPorId); 
router.get('/reserva', pagoController.obtenerPagosDeReservas);
router.post('/', upload.single('comprobante'), pagoController.registrarPago)
router.put('/:id', pagoController.editarPago)
router.delete('/:id', pagoController.eliminarPago)
router.put('/liquidar/:id', pagoController.liquidarReservaDueno)

router.get('/', pagoController.renderPagos);

module.exports = router;