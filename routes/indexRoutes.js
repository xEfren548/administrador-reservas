const express = require('express');
const router = express.Router();

const eventRoutes = require('./eventRoutes');
const habitacionesRoutes = require('./habitacionesRoutes');
const userRoutes = require('./userRoutes');
const serviciosRoutes = require('./serviciosRoutes');
const clientesRoutes = require('./clientesRoutes');
const cabanasRoutes = require('./cabanasRoutes');
const dashboardRoutes = require('./dashboardRoutes');

router.get('/', (req, res) => {
    res.render('index'); 
});

router.get('/api/racklimpieza', (req, res) => {
    res.render('rackLimpieza');
});

router.use('/api', eventRoutes);
router.use('/api', habitacionesRoutes);
router.use('/api', userRoutes);
router.use('/api', serviciosRoutes);
router.use('/api', clientesRoutes);
router.use('/api', cabanasRoutes);
router.use('/api', dashboardRoutes);

module.exports = router;