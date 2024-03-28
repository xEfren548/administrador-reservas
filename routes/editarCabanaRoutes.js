express = require('express');

router = express.Router();

router.get('/editar-cabana', (req, res) => {
    res.render('vistaEditarCabana', {
        layout: 'editarCabana'
    });
});

module.exports = router;