const express = require('express');
const moment = require('moment');
const router = express.Router();

const Habitaciones = require('../models/Habitacion');

router.get('/plataformas', async (req, res) => {
    const habitaciones = await Habitaciones.find({ isActive: true }).lean();
    const mappedChalets = habitaciones.map(chalet => ({
        id: chalet._id,
        name: chalet.propertyDetails.name
    }))

    res.render('plataformasView', {
        layout: 'tailwindMain',
        chalets: mappedChalets
    });
});

module.exports = router;