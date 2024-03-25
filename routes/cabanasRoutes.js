express = require('express');

router = express.Router();

router.get('/cabanas', (req, res) => {
    res.render('vistaCabanas', {
        layout: 'cabanas'
    });
});

module.exports = router;