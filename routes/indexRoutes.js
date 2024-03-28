const express = require('express');

const router = express.Router();

const eventRoutes = require('./eventRoutes');
const habitacionesRoutes = require('./habitacionesRoutes');
const userRoutes = require('./userRoutes');
const serviciosRoutes = require('./serviciosRoutes');
const clientesRoutes = require('./clientesRoutes');
const cabanasRoutes = require('./cabanasRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const instruccionesUsuario = require('./instruccionesUsuario');
const loginRoutes = require("./loginRoute");
const editarCabanaRoutes = require("./editarCabanaRoutes");

router.get('/', (req, res) => {
    res.render('index'); 
});
router.use('/', loginRoutes);
router.get('/api/racklimpieza', (req, res) => {
    res.render('rackLimpieza');
});
router.use('/api', eventRoutes);
router.use('/api', habitacionesRoutes);
router.use('/api/usuarios', userRoutes);
router.use('/api', serviciosRoutes);
router.use('/api', clientesRoutes);
router.use('/api', cabanasRoutes);
router.use('/api', editarCabanaRoutes);
router.use('/api', dashboardRoutes);
router.use('/', instruccionesUsuario);

module.exports = router;