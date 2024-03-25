const express = require('express');
const router = express.Router();


// Rutas para agregar un nuevo evento
router.get('/instrucciones/:id', function (req, res) {
    const id = req.params.id;
    console.log(id);
    res.render('paraUsuarios', {
        layout: 'layoutParaUsuarios',
    });
})

module.exports = router;