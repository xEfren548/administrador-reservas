express = require('express');

router = express.Router();

router.get('/dashboard', (req, res) => {
    res.render('vistaDashboard', {
        layout: 'dashboard'
    });
});

module.exports = router;