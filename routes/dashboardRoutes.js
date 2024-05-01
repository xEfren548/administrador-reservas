express = require('express');

router = express.Router();

router.get('/dashboard', (req, res) => {
    res.render('vistaDashboard', {
    });
});

module.exports = router;