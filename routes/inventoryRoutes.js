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

// Warehouses / bodegas
router.post(
    '/warehouses',
    requirePermissionOrMasterAdmin('MANAGE_INVENTORY'),
    inventoryController.createWarehouseValidators,
    validationRequest,
    inventoryController.createWarehouse
);
router.get('/warehouses', requirePermissionOrMasterAdmin('VIEW_INVENTORY'), inventoryController.listWarehouses);
router.put(
    '/warehouses/:id',
    requirePermissionOrMasterAdmin('MANAGE_INVENTORY'),
    inventoryController.updateWarehouseValidators,
    validationRequest,
    inventoryController.updateWarehouse
);
router.delete('/warehouses/:id', requirePermissionOrMasterAdmin('MANAGE_INVENTORY'), inventoryController.deleteWarehouse);
router.get('/warehouses/:warehouseId/summary', requirePermissionOrMasterAdmin('VIEW_INVENTORY_DASHBOARD'), inventoryController.getWarehouseSummary);

// Manual trigger for scheduled checkout consumption
router.post('/cron/run-checkout-consumption', requirePermissionOrMasterAdmin('MANAGE_INVENTORY'), inventoryController.runCheckoutConsumptionNow);

module.exports = router;
