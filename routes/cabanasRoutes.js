const express = require('express');
const router = express.Router();
const cabanasController = require('../controllers/cabanasController');
const validationRequest = require('../common/middlewares/validation-request');
const uploadImg = require('../common/middlewares/upload-img');

router.get('/cabanas', cabanasController.showCreateChaletViewValidators, validationRequest, cabanasController.showChaletsView);
router.post('/cabanas/crear-cabana', cabanasController.createChaletValidators, validationRequest, cabanasController.createChalet);
router.post('/cabanas/subir-imagenes-cabana', uploadImg, cabanasController.uploadChaletFilesValidators, validationRequest, cabanasController.uploadChaletFiles);

router.get('/cabanas/editar-cabana', cabanasController.showEditChaletsView);
router.post('/cabanas/editar-cabana', /*cabanasController.createChaletValidators, validationRequest,*/ cabanasController.editChalet);
router.get('/cabanas/calendar', cabanasController.renderCalendarPerChalet)
router.get('/cabanas/ownercalendar', cabanasController.renderCalendarPerChaletOwner)
module.exports = router;