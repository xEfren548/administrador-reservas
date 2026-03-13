const { check, validationResult } = require('express-validator');
const Habitacion = require('../models/Habitacion');
const InventoryWarehouse = require('../models/InventoryWarehouse');
const InventoryItem = require('../models/InventoryItem');
const InventoryBOMTemplate = require('../models/InventoryBOMTemplate');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryPurchase = require('../models/InventoryPurchase');
const InventoryAlert = require('../models/InventoryAlert');
const InventoryMetricGroup = require('../models/InventoryMetricGroup');
const { processFinishedReservationsCheckoutConsumption } = require('../services/inventoryCheckoutService');

const createWarehouseValidators = [
    check('name').notEmpty().withMessage('Warehouse name is required'),
    check('bankName').optional().isString().withMessage('Bank name must be a string'),
    check('scopeType').isIn(['cabana', 'grupo']).withMessage('Invalid scope type'),
    check('cabin').optional().isMongoId().withMessage('Invalid cabin id'),
    check('roomGroup').optional().isString().withMessage('roomGroup must be string')
];

const createItemValidators = [
    check('name').notEmpty().withMessage('Item name is required'),
    check('itemType').isIn(['directo', 'indirecto', 'no_consumible']).withMessage('Invalid item type'),
    check('unit').notEmpty().withMessage('Unit is required'),
    check('warehouse').isMongoId().withMessage('Invalid warehouse id'),
    check('stockCurrent').optional().isFloat({ min: 0 }).withMessage('stockCurrent must be >= 0'),
    check('stockMin').optional().isFloat({ min: 0 }).withMessage('stockMin must be >= 0')
];

const createBOMTemplateValidators = [
    check('name').notEmpty().withMessage('Template name is required'),
    check('scopeType').isIn(['cabana', 'grupo']).withMessage('Invalid scope type'),
    check('cabin').optional().isMongoId().withMessage('Invalid cabin id'),
    check('cabinIds').optional().isArray().withMessage('cabinIds must be an array'),
    check('cabinIds.*').optional().isMongoId().withMessage('Invalid cabin id in cabinIds'),
    check('roomGroup').optional().isString().withMessage('roomGroup must be string'),
    check('lines').isArray({ min: 1 }).withMessage('At least one BOM line is required'),
    check('lines.*.item').isMongoId().withMessage('Invalid item id in lines'),
    check('lines.*.quantityPerNight').isFloat({ min: 0 }).withMessage('quantityPerNight must be >= 0'),
    check('lines.*.useFactor').optional().isFloat({ min: 0 }).withMessage('useFactor must be >= 0')
];

const registerPurchaseValidators = [
    check('warehouse').isMongoId().withMessage('Invalid warehouse id'),
    check('purchaseDate').optional().isISO8601().withMessage('Invalid purchaseDate'),
    check('lines').isArray({ min: 1 }).withMessage('At least one purchase line is required'),
    check('lines.*.item').isMongoId().withMessage('Invalid item id in lines'),
    check('lines.*.quantity').isFloat({ min: 0.0001 }).withMessage('quantity must be > 0'),
    check('lines.*.unitCost').isFloat({ min: 0 }).withMessage('unitCost must be >= 0')
];

const manualAdjustmentValidators = [
    check('itemId').isMongoId().withMessage('Invalid item id'),
    check('direction').isIn(['in', 'out']).withMessage('direction must be in or out'),
    check('quantity').isFloat({ min: 0.0001 }).withMessage('quantity must be > 0'),
    check('reason').notEmpty().withMessage('reason is required')
];

const createMetricGroupValidators = [
    check('name').notEmpty().withMessage('Metric group name is required'),
    check('description').optional().isString(),
    check('cabins').optional().isArray(),
    check('cabins.*').optional().isMongoId().withMessage('Invalid cabin id in cabins')
];

const handleValidation = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return false;
    }
    return true;
};

const createWarehouse = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { name, bankName = 'Principal', scopeType, cabin = null, roomGroup = null, active = true } = req.body;

        if (scopeType === 'cabana' && !cabin) {
            return res.status(400).json({ success: false, message: 'cabin is required for cabana scope' });
        }

        if (scopeType === 'grupo' && !roomGroup) {
            return res.status(400).json({ success: false, message: 'roomGroup is required for grupo scope' });
        }

        const warehouse = await InventoryWarehouse.create({
            name,
            bankName,
            scopeType,
            cabin,
            roomGroup,
            active,
            createdBy: req.session.userId || null
        });

        return res.status(201).json({ success: true, data: warehouse });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error creating warehouse', error: error.message });
    }
};

const listWarehouses = async (req, res) => {
    try {
        const { scopeType, cabin, roomGroup, active } = req.query;
        const filter = {};

        if (scopeType) filter.scopeType = scopeType;
        if (cabin) filter.cabin = cabin;
        if (roomGroup) filter.roomGroup = roomGroup;
        if (active !== undefined) filter.active = active === 'true';

        const warehouses = await InventoryWarehouse.find(filter)
            .populate('cabin', 'propertyDetails roomGroup isGrouped')
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ success: true, data: warehouses });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error listing warehouses', error: error.message });
    }
};

const createItem = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const payload = {
            ...req.body,
            createdBy: req.session.userId || null
        };

        const item = await InventoryItem.create(payload);
        return res.status(201).json({ success: true, data: item });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error creating item', error: error.message });
    }
};

const listItems = async (req, res) => {
    try {
        const { warehouse, active, itemType, lowStockOnly } = req.query;
        const filter = {};

        if (warehouse) filter.warehouse = warehouse;
        if (active !== undefined) filter.active = active === 'true';
        if (itemType) filter.itemType = itemType;

        const items = await InventoryItem.find(filter)
            .populate('warehouse', 'name bankName scopeType cabin roomGroup')
            .sort({ createdAt: -1 })
            .lean();

        const data = lowStockOnly === 'true'
            ? items.filter((item) => Number(item.stockCurrent) <= Number(item.stockMin || 0))
            : items;

        return res.json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error listing items', error: error.message });
    }
};

const createBOMTemplate = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { scopeType, cabin, roomGroup, cabinIds = [] } = req.body;
        const selectedCabinIds = Array.isArray(cabinIds) ? cabinIds.filter(Boolean) : [];

        if (scopeType === 'cabana' && !cabin && selectedCabinIds.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one cabin is required for cabana scope' });
        }

        if (scopeType === 'grupo' && !roomGroup) {
            return res.status(400).json({ success: false, message: 'roomGroup is required for grupo scope' });
        }

        if (scopeType === 'cabana' && selectedCabinIds.length > 0) {
            const cabins = await Habitacion.find({ _id: { $in: selectedCabinIds } })
                .select('_id propertyDetails.name')
                .lean();
            const cabinNameMap = new Map(cabins.map((room) => [String(room._id), room.propertyDetails?.name || String(room._id)]));

            const templatesToCreate = selectedCabinIds.map((cabinId) => ({
                name: `${req.body.name} - ${cabinNameMap.get(String(cabinId)) || String(cabinId)}`,
                scopeType,
                cabin: cabinId,
                lines: req.body.lines,
                active: req.body.active !== false,
                createdBy: req.session.userId || null
            }));

            const templates = await InventoryBOMTemplate.insertMany(templatesToCreate);
            return res.status(201).json({
                success: true,
                message: `${templates.length} BOM templates created`,
                data: templates
            });
        }

        const template = await InventoryBOMTemplate.create({
            ...req.body,
            createdBy: req.session.userId || null
        });

        return res.status(201).json({ success: true, data: template });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error creating BOM template', error: error.message });
    }
};

const listBOMTemplates = async (req, res) => {
    try {
        const { scopeType, cabin, roomGroup, active } = req.query;
        const filter = {};

        if (scopeType) filter.scopeType = scopeType;
        if (cabin) filter.cabin = cabin;
        if (roomGroup) filter.roomGroup = roomGroup;
        if (active !== undefined) filter.active = active === 'true';

        const templates = await InventoryBOMTemplate.find(filter)
            .populate('cabin', 'propertyDetails roomGroup isGrouped')
            .populate('lines.item', 'name itemType unit stockCurrent stockMin warehouse')
            .sort({ updatedAt: -1 })
            .lean();

        return res.json({ success: true, data: templates });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error listing BOM templates', error: error.message });
    }
};

const registerPurchase = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { warehouse, supplier = '', invoiceNumber = '', purchaseDate, lines } = req.body;
        let totalAmount = 0;
        const normalizedLines = [];

        for (const line of lines) {
            const item = await InventoryItem.findById(line.item);
            if (!item) {
                return res.status(404).json({ success: false, message: `Item not found: ${line.item}` });
            }

            if (String(item.warehouse) !== String(warehouse)) {
                return res.status(400).json({ success: false, message: `Item ${item.name} does not belong to selected warehouse` });
            }

            const quantity = Number(line.quantity);
            const unitCost = Number(line.unitCost);
            const lineTotal = quantity * unitCost;
            totalAmount += lineTotal;

            const stockBefore = Number(item.stockCurrent || 0);
            const stockAfter = stockBefore + quantity;
            item.stockCurrent = stockAfter;
            item.lastPurchaseUnitCost = unitCost;
            await item.save();

            await InventoryMovement.create({
                item: item._id,
                warehouse: item.warehouse,
                movementType: 'purchase_entry',
                quantity,
                unitCost,
                totalCost: lineTotal,
                stockBefore,
                stockAfter,
                performedBy: req.session.userId || null,
                note: `Purchase entry ${invoiceNumber || ''}`.trim()
            });

            normalizedLines.push({
                item: item._id,
                quantity,
                unitCost,
                totalCost: lineTotal
            });
        }

        const purchase = await InventoryPurchase.create({
            warehouse,
            supplier,
            invoiceNumber,
            purchaseDate: purchaseDate || new Date(),
            lines: normalizedLines,
            totalAmount,
            createdBy: req.session.userId || null
        });

        return res.status(201).json({ success: true, data: purchase });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error registering purchase', error: error.message });
    }
};

const createManualAdjustment = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { itemId, direction, quantity, reason } = req.body;
        const item = await InventoryItem.findById(itemId);

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const qty = Number(quantity);
        const stockBefore = Number(item.stockCurrent || 0);
        let stockAfter = stockBefore;
        let movementType = 'manual_adjustment_in';

        if (direction === 'in') {
            stockAfter = stockBefore + qty;
            movementType = 'manual_adjustment_in';
        } else {
            if (stockBefore < qty) {
                return res.status(400).json({ success: false, message: 'Insufficient stock for adjustment out' });
            }
            stockAfter = stockBefore - qty;
            movementType = 'manual_adjustment_out';
        }

        item.stockCurrent = stockAfter;
        await item.save();

        const movement = await InventoryMovement.create({
            item: item._id,
            warehouse: item.warehouse,
            movementType,
            quantity: qty,
            unitCost: Number(item.lastPurchaseUnitCost || 0),
            totalCost: Number(item.lastPurchaseUnitCost || 0) * qty,
            stockBefore,
            stockAfter,
            performedBy: req.session.userId || null,
            note: reason
        });

        if (stockAfter <= Number(item.stockMin || 0)) {
            await InventoryAlert.create({
                warehouse: item.warehouse,
                item: item._id,
                alertType: 'low_stock',
                status: 'open',
                message: `Low stock for ${item.name}. Current ${stockAfter}, min ${item.stockMin}.`
            });
        }

        return res.status(201).json({ success: true, data: movement });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error creating adjustment', error: error.message });
    }
};

const getAlerts = async (req, res) => {
    try {
        const { status = 'open', alertType } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (alertType) filter.alertType = alertType;

        const alerts = await InventoryAlert.find(filter)
            .populate('item', 'name itemType unit stockCurrent stockMin')
            .populate('warehouse', 'name bankName scopeType cabin roomGroup')
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ success: true, data: alerts });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error getting alerts', error: error.message });
    }
};

const resolveAlert = async (req, res) => {
    try {
        const { id } = req.params;

        const alert = await InventoryAlert.findByIdAndUpdate(
            id,
            {
                status: 'resolved',
                resolvedAt: new Date()
            },
            { new: true }
        );

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        return res.json({ success: true, data: alert });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error resolving alert', error: error.message });
    }
};

const getStockDashboard = async (req, res) => {
    try {
        const items = await InventoryItem.find({ active: true })
            .populate('warehouse', 'name bankName scopeType cabin roomGroup')
            .lean();

        const totalItems = items.length;
        const lowStockItems = items.filter((item) => Number(item.stockCurrent) <= Number(item.stockMin || 0));

        const stockByBank = items.reduce((acc, item) => {
            const key = item.warehouse?.bankName || 'Sin banco';
            acc[key] = acc[key] || { items: 0, stockUnits: 0 };
            acc[key].items += 1;
            acc[key].stockUnits += Number(item.stockCurrent || 0);
            return acc;
        }, {});

        return res.json({
            success: true,
            data: {
                totalItems,
                lowStockCount: lowStockItems.length,
                stockByBank,
                lowStockItems
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error building stock dashboard', error: error.message });
    }
};

const createMetricGroup = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { name, description = '', cabins = [] } = req.body;

        if (cabins.length > 0) {
            const existingCabins = await Habitacion.find({ _id: { $in: cabins } }).select('_id').lean();
            if (existingCabins.length !== cabins.length) {
                return res.status(400).json({ success: false, message: 'One or more cabins are invalid' });
            }
        }

        const metricGroup = await InventoryMetricGroup.create({
            name,
            description,
            cabins,
            createdBy: req.session.userId || null
        });

        return res.status(201).json({ success: true, data: metricGroup });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error creating metric group', error: error.message });
    }
};

const listMetricGroups = async (req, res) => {
    try {
        const groups = await InventoryMetricGroup.find({ active: true })
            .populate('cabins', 'propertyDetails roomGroup isGrouped')
            .sort({ name: 1 })
            .lean();

        return res.json({ success: true, data: groups });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error listing metric groups', error: error.message });
    }
};

const getMetricConsumptionDashboard = async (req, res) => {
    try {
        const { metricGroupId } = req.params;

        const metricGroup = await InventoryMetricGroup.findById(metricGroupId).lean();
        if (!metricGroup) {
            return res.status(404).json({ success: false, message: 'Metric group not found' });
        }

        const items = await InventoryItem.find({ active: true })
            .populate({
                path: 'warehouse',
                select: 'scopeType cabin roomGroup name bankName',
                populate: {
                    path: 'cabin',
                    select: 'propertyDetails roomGroup isGrouped'
                }
            })
            .lean();

        const cabinIds = new Set((metricGroup.cabins || []).map((id) => String(id)));
        const filteredItems = items.filter((item) => {
            const warehouseCabinId = item.warehouse?.cabin?._id ? String(item.warehouse.cabin._id) : null;
            return warehouseCabinId && cabinIds.has(warehouseCabinId);
        });

        const totalStock = filteredItems.reduce((sum, item) => sum + Number(item.stockCurrent || 0), 0);
        const totalMinStock = filteredItems.reduce((sum, item) => sum + Number(item.stockMin || 0), 0);

        const movementSummary = await InventoryMovement.aggregate([
            {
                $match: {
                    item: { $in: filteredItems.map((item) => item._id) },
                    movementType: 'checkout_exit'
                }
            },
            {
                $group: {
                    _id: '$item',
                    consumed: { $sum: '$quantity' },
                    totalCost: { $sum: '$totalCost' }
                }
            }
        ]);

        return res.json({
            success: true,
            data: {
                metricGroup,
                itemCount: filteredItems.length,
                totalStock,
                totalMinStock,
                consumption: movementSummary
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error building metric dashboard', error: error.message });
    }
};

const runCheckoutConsumptionNow = async (req, res) => {
    try {
        const summary = await processFinishedReservationsCheckoutConsumption(req.session.userId || null);
        return res.json({ success: true, data: summary });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error running checkout consumption', error: error.message });
    }
};

module.exports = {
    createWarehouseValidators,
    createItemValidators,
    createBOMTemplateValidators,
    registerPurchaseValidators,
    manualAdjustmentValidators,
    createMetricGroupValidators,
    createWarehouse,
    listWarehouses,
    createItem,
    listItems,
    createBOMTemplate,
    listBOMTemplates,
    registerPurchase,
    createManualAdjustment,
    getAlerts,
    resolveAlert,
    getStockDashboard,
    createMetricGroup,
    listMetricGroups,
    getMetricConsumptionDashboard,
    runCheckoutConsumptionNow
};
