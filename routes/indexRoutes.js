const express = require('express');
const router = express.Router();

const eventRoutes = require('./eventRoutes');
const habitacionesRoutes = require('./habitacionesRoutes');


router.use('', eventRoutes);
router.use('', habitacionesRoutes);


module.exports = router;