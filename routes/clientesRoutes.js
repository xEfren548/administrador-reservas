const express = require('express');

const router = express.Router();

router.get('/clientes', (req, res) => {
    res.render('vistaClientes', {
        layout: 'clientes'
    }) 
})

module.exports = router;