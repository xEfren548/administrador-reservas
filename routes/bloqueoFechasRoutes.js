const express = require('express');
const router = express.Router();

router.get('/calendario-bloqueofechas', (req, res) => {
    res.render('bloqueoFechas');
});

module.exports = router;