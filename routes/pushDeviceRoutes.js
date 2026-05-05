const express = require('express');
const router = express.Router();
const pushDeviceController = require('../controllers/pushDeviceController');
const validationRequest = require('../common/middlewares/validation-request');

router.post(
    '/push/devices',
    pushDeviceController.registerPushDeviceValidators,
    validationRequest,
    pushDeviceController.registerPushDevice
);

router.post(
    '/push/devices/unregister',
    pushDeviceController.unregisterPushDeviceValidators,
    validationRequest,
    pushDeviceController.unregisterPushDevice
);

router.post(
    '/push/test',
    pushDeviceController.sendTestPushValidators,
    validationRequest,
    pushDeviceController.sendTestPush
);

module.exports = router;