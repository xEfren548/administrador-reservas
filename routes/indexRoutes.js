const express = require('express');
const router = express.Router();

const eventRoutes = require('./eventRoutes');
const habitacionesRoutes = require('./habitacionesRoutes');

router.get('/', (req, res) => {
    res.render('index'); 
});

router.use('', eventRoutes);
router.use('', habitacionesRoutes);


module.exports = router;