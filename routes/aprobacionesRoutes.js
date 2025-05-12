const express = require('express');
const router = express.Router();
const aprobacionesController = require('../controllers/aprobacionesController');

router.get('/aprobaciones', aprobacionesController.showApprovalsView);
router.put('/aprobaciones/:id', aprobacionesController.updateRequestStatus);
router.delete('/aprobaciones/:id', aprobacionesController.deleteRequest);
router.post('/aprobaciones', aprobacionesController.createRequest);
router.get('/aprobaciones', aprobacionesController.getRequests);

module.exports = router;
