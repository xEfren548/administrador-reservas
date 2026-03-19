const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const validationRequest = require('../common/middlewares/validation-request');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const {
    requireMasterAdmin,
    requirePermissionOrMasterAdmin
} = require('../common/middlewares/authPrivileges/authSW');

router.use(ensureAuthenticated);

// Inventory items
router.post(
    '/items',
    requireMasterAdmin,
    inventoryController.createItemValidators,
    validationRequest,
    inventoryController.createItem
);
router.get('/items', inventoryController.listItems);
router.put(
    '/items/:id',
    requireMasterAdmin,
    inventoryController.updateItemValidators,
    validationRequest,
    inventoryController.updateItem
);
router.delete('/items/:id', requireMasterAdmin, inventoryController.deleteItem);

// BOM templates by cabin/group
router.post(
    '/bom-templates',
    requireMasterAdmin,
    inventoryController.createBOMTemplateValidators,
    validationRequest,
    inventoryController.createBOMTemplate
);
router.get('/bom-templates', inventoryController.listBOMTemplates);
router.put(
    '/bom-templates/:id',
    requireMasterAdmin,
    inventoryController.updateBOMTemplateValidators,
    validationRequest,
    inventoryController.updateBOMTemplate
);
router.delete('/bom-templates/:id', requireMasterAdmin, inventoryController.deleteBOMTemplate);

// Movement history / kardex
router.get('/movements', inventoryController.listMovements);

// Purchases (kardex by lot)
router.post(
    '/purchases',
    requireMasterAdmin,
    inventoryController.registerPurchaseValidators,
    validationRequest,
    inventoryController.registerPurchase
);

// Manual adjustments (permission or master admin)
router.post(
    '/adjustments',
    requirePermissionOrMasterAdmin('ADJUST_INVENTORY'),
    inventoryController.manualAdjustmentValidators,
    validationRequest,
    inventoryController.createManualAdjustment
);

// Alerts and dashboard
router.get('/alerts', inventoryController.getAlerts);
router.put('/alerts/:id/resolve', requireMasterAdmin, inventoryController.resolveAlert);
router.get('/dashboard/stock', inventoryController.getStockDashboard);

// Metric groups (independent from existing Tipologia model)
router.post(
    '/metric-groups',
    requireMasterAdmin,
    inventoryController.createMetricGroupValidators,
    validationRequest,
    inventoryController.createMetricGroup
);
router.get('/metric-groups', inventoryController.listMetricGroups);
router.get('/metric-groups/:metricGroupId/dashboard', inventoryController.getMetricConsumptionDashboard);

// Manual trigger for scheduled checkout consumption
router.post('/cron/run-checkout-consumption', requireMasterAdmin, inventoryController.runCheckoutConsumptionNow);

module.exports = router;
