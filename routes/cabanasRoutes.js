const express = require('express');
const router = express.Router();
const cabanasController = require('../controllers/cabanasController');
const validationRequest = require('../common/middlewares/validation-request');
const uploadImg = require('../common/middlewares/upload-img');

router.get('/cabanas', (req, res) => {
    res.render('vistaCabanas', {
        layout: 'cabanas'
    });
});

router.post('/cabanas/crear-cabana', /*cabanasController.createChaletValidators,*/ validationRequest, cabanasController.createChalet);
router.post('/cabanas/subir-imagenes-cabana', uploadImg, cabanasController.uploadChaletFilesValidators, validationRequest, cabanasController.uploadChaletFiles);

module.exports = router;