const express = require('express');
const moment = require('moment');
const router = express.Router();

const Habitaciones = require('../models/Habitacion');
const plataformasCtrl = require('../controllers/plataformasController');

router.get('/plataformas', plataformasCtrl.renderVistaPlataformas);
router.get('/plataformas', plataformasCtrl.obtenerPlataformas);
router.post('/api/plataformas', plataformasCtrl.nuevaPlataforma);
router.put('/api/plataformas/:id', plataformasCtrl.modificarPlataforma);
router.delete('/api/plataformas/:id', plataformasCtrl.eliminarPlataforma);


module.exports = router;