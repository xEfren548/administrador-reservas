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
    requirePermissionOrMasterAdmin('MANAGE_INVENTORY'),
    inventoryController.createItemValidators,
    validationRequest,
    inventoryController.createItem
);
router.get('/items', requirePermissionOrMasterAdmin('VIEW_INVENTORY'), inventoryController.listItems);
router.put(
    '/items/:id',
    requirePermissionOrMasterAdmin('MANAGE_INVENTORY'),
    inventoryController.updateItemValidators,
    validationRequest,
    inventoryController.updateItem
);
router.delete('/items/:id', requirePermissionOrMasterAdmin('MANAGE_INVENTORY'), inventoryController.deleteItem);

// BOM templates by cabin/group
router.post(
    '/bom-templates',
    requirePermissionOrMasterAdmin('MANAGE_INVENTORY'),
    inventoryController.createBOMTemplateValidators,
    validationRequest,
    inventoryController.createBOMTemplate
);
router.get('/bom-templates', requirePermissionOrMasterAdmin('VIEW_INVENTORY'), inventoryController.listBOMTemplates);
router.put(
    '/bom-templates/:id',
    requirePermissionOrMasterAdmin('MANAGE_INVENTORY'),
    inventoryController.updateBOMTemplateValidators,
    validationRequest,
    inventoryController.updateBOMTemplate
);
router.delete('/bom-templates/:id', requirePermissionOrMasterAdmin('MANAGE_INVENTORY'), inventoryController.deleteBOMTemplate);

// Movement history / kardex
router.get('/movements', requirePermissionOrMasterAdmin('VIEW_INVENTORY'), inventoryController.listMovements);

// Purchase history and restocks
router.get('/purchases', requirePermissionOrMasterAdmin('VIEW_INVENTORY'), inventoryController.listPurchases);

// Purchases (kardex by lot)
router.post(
    '/purchases',
    requirePermissionOrMasterAdmin('MANAGE_INVENTORY'),
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
router.get('/alerts', requirePermissionOrMasterAdmin('VIEW_INVENTORY'), inventoryController.getAlerts);
router.put('/alerts/:id/resolve', requirePermissionOrMasterAdmin('MANAGE_INVENTORY'), inventoryController.resolveAlert);
router.get('/dashboard/stock', requirePermissionOrMasterAdmin('VIEW_INVENTORY_DASHBOARD'), inventoryController.getStockDashboard);

// Metric groups (independent from existing Tipologia model)
router.post(
    '/metric-groups',
    requirePermissionOrMasterAdmin('MANAGE_INVENTORY'),
    inventoryController.createMetricGroupValidators,
    validationRequest,
    inventoryController.createMetricGroup
);
router.get('/metric-groups', requirePermissionOrMasterAdmin('VIEW_INVENTORY'), inventoryController.listMetricGroups);
router.put(
    '/metric-groups/:id',
    requirePermissionOrMasterAdmin('MANAGE_INVENTORY'),
    inventoryController.updateMetricGroupValidators,
    validationRequest,
    inventoryController.updateMetricGroup
);
router.delete('/metric-groups/:id', requirePermissionOrMasterAdmin('MANAGE_INVENTORY'), inventoryController.deleteMetricGroup);
router.get('/metric-groups/:metricGroupId/dashboard', requirePermissionOrMasterAdmin('VIEW_INVENTORY_DASHBOARD'), inventoryController.getMetricConsumptionDashboard);

// Manual trigger for scheduled checkout consumption
router.post('/cron/run-checkout-consumption', requirePermissionOrMasterAdmin('MANAGE_INVENTORY'), inventoryController.runCheckoutConsumptionNow);

module.exports = router;
