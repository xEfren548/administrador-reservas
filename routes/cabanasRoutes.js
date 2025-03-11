const express = require('express');
const router = express.Router();
const cabanasController = require('../controllers/cabanasController');
const validationRequest = require('../common/middlewares/validation-request');
const uploadImg = require('../common/middlewares/upload-img');
const uploadPdf = require('../common/middlewares/upload-pdf');

router.get('/cabanas', cabanasController.showCreateChaletViewValidators, validationRequest, cabanasController.showChaletsView);
router.post('/cabanas/crear-cabana', cabanasController.createChaletValidators, validationRequest, cabanasController.createChalet);
router.post('/cabanas/subir-imagenes-cabana', uploadImg,  validationRequest, cabanasController.uploadChaletFiles);
router.post('/cabanas/subir-pdf-cabana', uploadPdf,  validationRequest, cabanasController.uploadChaletPdf);

router.get('/cabanas/editar-cabana', cabanasController.showEditChaletsView);
router.post('/cabanas/editar-cabana', /*cabanasController.createChaletValidators, validationRequest,*/ cabanasController.editChalet);
router.put('/cabanas/status', cabanasController.changeChaletStatus);
router.get('/cabanas/calendar', cabanasController.renderCalendarPerChalet)
router.get('/cabanas/ownercalendar', cabanasController.renderCalendarPerChaletOwner)
module.exports = router;