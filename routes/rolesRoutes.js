const express = require('express');
const router = express.Router();

router.get('/roles', (req, res) => {
    res.render('rolesView');
});

module.exports = router;