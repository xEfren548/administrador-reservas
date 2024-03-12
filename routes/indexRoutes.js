const express = require('express');
const router = express.Router();

const eventRoutes = require('./eventRoutes');
const habitacionesRoutes = require('./habitacionesRoutes');
const userRoutes = require('./userRoutes');

router.get('/', (req, res) => {
    res.render('index'); 
});

router.use('/api', eventRoutes);
router.use('/api', habitacionesRoutes);
router.use('/api', userRoutes);


module.exports = router;