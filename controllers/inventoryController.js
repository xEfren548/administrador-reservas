const { check, validationResult } = require('express-validator');
const Habitacion = require('../models/Habitacion');
const InventoryItem = require('../models/InventoryItem');
const InventoryBOMTemplate = require('../models/InventoryBOMTemplate');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryPurchase = require('../models/InventoryPurchase');
const InventoryAlert = require('../models/InventoryAlert');
const InventoryMetricGroup = require('../models/InventoryMetricGroup');
const { processFinishedReservationsCheckoutConsumption } = require('../services/inventoryCheckoutService');

const createItemValidators = [
    check('name').notEmpty().withMessage('Item name is required'),
    check('itemType').isIn(['directo', 'indirecto', 'no_consumible']).withMessage('Invalid item type'),
    check('unit').notEmpty().withMessage('Unit is required'),
    check('cabin').optional().isMongoId().withMessage('Invalid cabin id'),
    check('cabinIds').optional().isArray().withMessage('cabinIds must be an array'),
    check('cabinIds.*').optional().isMongoId().withMessage('Invalid cabin id in cabinIds'),
    check('stockCurrent').optional().isFloat({ min: 0 }).withMessage('stockCurrent must be >= 0'),
    check('stockMin').optional().isFloat({ min: 0 }).withMessage('stockMin must be >= 0'),
    check('initialUnitCost').optional().isFloat({ min: 0 }).withMessage('initialUnitCost must be >= 0'),
    check('initialSupplier').optional().isString().withMessage('initialSupplier must be a string'),
    check('initialInvoiceNumber').optional().isString().withMessage('initialInvoiceNumber must be a string'),
    check('initialPurchaseDate').optional().isISO8601().withMessage('Invalid initialPurchaseDate')
];

const updateItemValidators = [
    check('name').optional().notEmpty().withMessage('Item name cannot be empty'),
    check('description').optional().isString().withMessage('description must be a string'),
    check('itemType').optional().isIn(['directo', 'indirecto', 'no_consumible']).withMessage('Invalid item type'),
    check('unit').optional().notEmpty().withMessage('Unit cannot be empty'),
    check('cabin').optional().isMongoId().withMessage('Invalid cabin id'),
    check('stockCurrent').optional().isFloat({ min: 0 }).withMessage('stockCurrent must be >= 0'),
    check('stockMin').optional().isFloat({ min: 0 }).withMessage('stockMin must be >= 0'),
    check('lastPurchaseUnitCost').optional().isFloat({ min: 0 }).withMessage('lastPurchaseUnitCost must be >= 0'),
    check('active').optional().isBoolean().withMessage('active must be boolean')
];

const createBOMTemplateValidators = [
    check('name').notEmpty().withMessage('Template name is required'),
    check('scopeType').optional().isIn(['cabana']).withMessage('Invalid scope type'),
    check('cabin').optional().isMongoId().withMessage('Invalid cabin id'),
    check('cabinIds').optional().isArray().withMessage('cabinIds must be an array'),
    check('cabinIds.*').optional().isMongoId().withMessage('Invalid cabin id in cabinIds'),
    check('lines').isArray({ min: 1 }).withMessage('At least one BOM line is required'),
    check('lines.*.item').isMongoId().withMessage('Invalid item id in lines'),
    check('lines.*.quantityPerNight').isFloat({ min: 0 }).withMessage('quantityPerNight must be >= 0'),
    check('lines.*.useFactor').optional().isFloat({ min: 0 }).withMessage('useFactor must be >= 0')
];

const updateBOMTemplateValidators = [
    check('name').optional().notEmpty().withMessage('Template name cannot be empty'),
    check('scopeType').optional().isIn(['cabana']).withMessage('Invalid scope type'),
    check('cabin').optional({ nullable: true }).isMongoId().withMessage('Invalid cabin id'),
    check('lines').optional().isArray({ min: 1 }).withMessage('At least one BOM line is required'),
    check('lines.*.item').optional().isMongoId().withMessage('Invalid item id in lines'),
    check('lines.*.quantityPerNight').optional().isFloat({ min: 0 }).withMessage('quantityPerNight must be >= 0'),
    check('lines.*.useFactor').optional().isFloat({ min: 0 }).withMessage('useFactor must be >= 0'),
    check('active').optional().isBoolean().withMessage('active must be boolean')
];

const registerPurchaseValidators = [
    check('cabin').isMongoId().withMessage('Invalid cabin id'),
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

const updateMetricGroupValidators = [
    check('name').optional().notEmpty().withMessage('Metric group name cannot be empty'),
    check('description').optional().isString(),
    check('cabins').optional().isArray(),
    check('cabins.*').optional().isMongoId().withMessage('Invalid cabin id in cabins'),
    check('active').optional().isBoolean().withMessage('active must be boolean')
];

const handleValidation = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return false;
    }
    return true;
};

const normalizeBoolean = (value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return Boolean(value);
};

const normalizeItemName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const ensureCabinExists = async (cabinId) => {
    if (!cabinId) return null;
    return Habitacion.findById(cabinId);
};

const createItem = async (req, res) => {
    const createdItemIds = [];
    const createdMovementIds = [];
    const createdPurchaseIds = [];

    try {
        if (!handleValidation(req, res)) return;

        const selectedCabinIds = [...new Set([
            req.body.cabin,
            ...(Array.isArray(req.body.cabinIds) ? req.body.cabinIds : [])
        ].filter(Boolean).map(String))];

        if (selectedCabinIds.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one cabin is required' });
        }

        const cabins = await Habitacion.find({ _id: { $in: selectedCabinIds } })
            .select('_id propertyDetails.name')
            .lean();

        if (cabins.length !== selectedCabinIds.length) {
            return res.status(404).json({ success: false, message: 'One or more cabins were not found' });
        }

        const initialStock = Number(req.body.stockCurrent || 0);
        const initialUnitCost = req.body.initialUnitCost !== undefined && req.body.initialUnitCost !== ''
            ? Number(req.body.initialUnitCost)
            : null;
        const normalizedItemName = normalizeItemName(req.body.name);

        if (!normalizedItemName) {
            return res.status(400).json({ success: false, message: 'Item name is required' });
        }

        if (initialStock > 0 && (initialUnitCost === null || initialUnitCost <= 0)) {
            return res.status(400).json({ success: false, message: 'initialUnitCost is required when initial stock is greater than 0' });
        }

        const duplicateItems = await InventoryItem.find({
            cabin: { $in: selectedCabinIds },
            name: normalizedItemName
        })
            .collation({ locale: 'es', strength: 2 })
            .populate('cabin', 'propertyDetails.name')
            .lean();

        if (duplicateItems.length > 0) {
            const duplicatedCabins = duplicateItems
                .map((item) => item.cabin?.propertyDetails?.name)
                .filter(Boolean)
                .join(', ');
            return res.status(409).json({
                success: false,
                message: duplicatedCabins
                    ? `An item with the same name already exists in: ${duplicatedCabins}`
                    : 'An item with the same name already exists in one or more selected cabins'
            });
        }

        const items = [];
        for (const cabinId of selectedCabinIds) {
            const payload = {
                name: normalizedItemName,
                description: req.body.description || '',
                itemType: req.body.itemType,
                unit: req.body.unit,
                cabin: cabinId,
                stockCurrent: initialStock,
                stockMin: Number(req.body.stockMin || 0),
                lastPurchaseUnitCost: initialUnitCost || 0,
                active: req.body.active !== undefined ? normalizeBoolean(req.body.active) : true,
                createdBy: req.session.userId || null
            };

            const item = await InventoryItem.create(payload);
            createdItemIds.push(item._id);
            items.push(item);

            if (initialStock > 0) {
                const totalCost = initialStock * initialUnitCost;

                const movement = await InventoryMovement.create({
                    item: item._id,
                    cabin: item.cabin,
                    movementType: 'purchase_entry',
                    quantity: initialStock,
                    unitCost: initialUnitCost,
                    totalCost,
                    stockBefore: 0,
                    stockAfter: initialStock,
                    performedBy: req.session.userId || null,
                    note: 'Stock inicial al crear el item'
                });
                createdMovementIds.push(movement._id);

                const purchase = await InventoryPurchase.create({
                    cabin: item.cabin,
                    supplier: req.body.initialSupplier || '',
                    invoiceNumber: req.body.initialInvoiceNumber || '',
                    purchaseDate: req.body.initialPurchaseDate || new Date(),
                    lines: [{
                        item: item._id,
                        quantity: initialStock,
                        unitCost: initialUnitCost,
                        totalCost
                    }],
                    totalAmount: totalCost,
                    createdBy: req.session.userId || null
                });
                createdPurchaseIds.push(purchase._id);
            }
        }

        return res.status(201).json({
            success: true,
            message: items.length > 1 ? `${items.length} items created` : 'Item created',
            data: items.length === 1 ? items[0] : items
        });
    } catch (error) {
        try {
            if (createdPurchaseIds.length > 0) {
                await InventoryPurchase.deleteMany({ _id: { $in: createdPurchaseIds } });
            }
            if (createdMovementIds.length > 0) {
                await InventoryMovement.deleteMany({ _id: { $in: createdMovementIds } });
            }
            if (createdItemIds.length > 0) {
                await InventoryItem.deleteMany({ _id: { $in: createdItemIds } });
            }
        } catch (rollbackError) {
            console.error('Error rolling back failed item creation:', rollbackError);
        }

        return res.status(500).json({ success: false, message: 'Error creating item', error: error.message });
    }
};

const updateItem = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { id } = req.params;
        const item = await InventoryItem.findById(id);

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const nextCabinId = req.body.cabin || item.cabin;
        const cabin = await ensureCabinExists(nextCabinId);
        if (!cabin) {
            return res.status(404).json({ success: false, message: 'Cabin not found' });
        }

        const nextName = req.body.name !== undefined ? normalizeItemName(req.body.name) : item.name;
        const duplicateItem = await InventoryItem.findOne({
            _id: { $ne: item._id },
            cabin: nextCabinId,
            name: nextName
        })
            .collation({ locale: 'es', strength: 2 })
            .lean();

        if (duplicateItem) {
            return res.status(409).json({ success: false, message: 'Another item with the same name already exists in this cabin' });
        }

        const fields = ['name', 'description', 'itemType', 'unit', 'cabin', 'stockCurrent', 'stockMin', 'lastPurchaseUnitCost', 'active'];
        fields.forEach((field) => {
            if (req.body[field] !== undefined) {
                if (field === 'active') {
                    item[field] = normalizeBoolean(req.body[field]);
                    return;
                }
                item[field] = field === 'name' ? nextName : req.body[field];
            }
        });

        await item.save();

        const updatedItem = await InventoryItem.findById(item._id)
            .populate('cabin', 'propertyDetails isGrouped')
            .lean();

        return res.json({ success: true, data: updatedItem });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error updating item', error: error.message });
    }
};

const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await InventoryItem.findById(id);

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const [movementCount, bomUsageCount] = await Promise.all([
            InventoryMovement.countDocuments({ item: item._id }),
            InventoryBOMTemplate.countDocuments({ 'lines.item': item._id })
        ]);

        if (movementCount > 0 || bomUsageCount > 0) {
            return res.status(409).json({
                success: false,
                message: 'Item cannot be deleted because it has related movements or BOM templates. Deactivate it instead.',
                data: { movementCount, bomUsageCount }
            });
        }

        await InventoryItem.deleteOne({ _id: item._id });
        return res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error deleting item', error: error.message });
    }
};

const listItems = async (req, res) => {
    try {
        const { cabin, active, itemType, lowStockOnly } = req.query;
        const filter = {};

        if (cabin) filter.cabin = cabin;
        if (active !== undefined) filter.active = active === 'true';
        if (itemType) filter.itemType = itemType;

        const items = await InventoryItem.find(filter)
            .populate('cabin', 'propertyDetails isGrouped')
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

        const { cabin, cabinIds = [] } = req.body;
        const selectedCabinIds = Array.isArray(cabinIds) ? cabinIds.filter(Boolean) : [];

        if (!cabin && selectedCabinIds.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one cabin is required for BOM creation' });
        }

        if (selectedCabinIds.length > 0) {
            const cabins = await Habitacion.find({ _id: { $in: selectedCabinIds } })
                .select('_id propertyDetails.name')
                .lean();
            const cabinNameMap = new Map(cabins.map((room) => [String(room._id), room.propertyDetails?.name || String(room._id)]));

            const templatesToCreate = selectedCabinIds.map((cabinId) => ({
                name: `${req.body.name} - ${cabinNameMap.get(String(cabinId)) || String(cabinId)}`,
                scopeType: 'cabana',
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

        const payload = {
            ...req.body,
            scopeType: 'cabana',
            groupName: null,
            cabins: [],
            createdBy: req.session.userId || null
        };

        const template = await InventoryBOMTemplate.create(payload);

        return res.status(201).json({ success: true, data: template });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error creating BOM template', error: error.message });
    }
};

const updateBOMTemplate = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { id } = req.params;
        const template = await InventoryBOMTemplate.findById(id);

        if (!template) {
            return res.status(404).json({ success: false, message: 'BOM template not found' });
        }

        const nextCabin = req.body.cabin !== undefined ? req.body.cabin : template.cabin;

        if (!nextCabin) {
            return res.status(400).json({ success: false, message: 'cabin is required for BOM template' });
        }

        if (req.body.cabin) {
            const existingCabin = await Habitacion.exists({ _id: req.body.cabin });
            if (!existingCabin) {
                return res.status(400).json({ success: false, message: 'Cabin is invalid' });
            }
        }

        if (Array.isArray(req.body.lines)) {
            const lineItemIds = [...new Set(req.body.lines.map((line) => String(line.item)).filter(Boolean))];
            const itemCount = await InventoryItem.countDocuments({ _id: { $in: lineItemIds } });
            if (itemCount !== lineItemIds.length) {
                return res.status(400).json({ success: false, message: 'One or more BOM items are invalid' });
            }
        }

        const fields = ['name', 'lines', 'active'];
        fields.forEach((field) => {
            if (req.body[field] !== undefined) {
                template[field] = field === 'active' ? normalizeBoolean(req.body[field]) : req.body[field];
            }
        });

        template.scopeType = 'cabana';
        template.cabin = nextCabin;
        template.groupName = null;
        template.cabins = [];

        await template.save();

        const updatedTemplate = await InventoryBOMTemplate.findById(template._id)
            .populate('cabin', 'propertyDetails isGrouped')
            .populate('lines.item', 'name itemType unit stockCurrent stockMin cabin')
            .lean();

        return res.json({ success: true, data: updatedTemplate });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error updating BOM template', error: error.message });
    }
};

const deleteBOMTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await InventoryBOMTemplate.findByIdAndUpdate(
            id,
            { active: false },
            { new: true }
        ).lean();

        if (!template) {
            return res.status(404).json({ success: false, message: 'BOM template not found' });
        }

        return res.json({ success: true, message: 'BOM template deactivated successfully', data: template });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error deleting BOM template', error: error.message });
    }
};

const listBOMTemplates = async (req, res) => {
    try {
        const { scopeType, cabin, groupName, active } = req.query;
        const filter = { scopeType: scopeType || 'cabana' };
        if (cabin) filter.cabin = cabin;
        if (groupName) filter.groupName = groupName;
        if (active !== undefined) filter.active = active === 'true';

        const templates = await InventoryBOMTemplate.find(filter)
            .populate('cabin', 'propertyDetails isGrouped')
            .populate('lines.item', 'name itemType unit stockCurrent stockMin cabin')
            .sort({ updatedAt: -1 })
            .lean();

        return res.json({ success: true, data: templates });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error listing BOM templates', error: error.message });
    }
};

const listMovements = async (req, res) => {
    try {
        const {
            item,
            cabin,
            movementType,
            event,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = req.query;

        const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
        const safePage = Math.max(Number(page) || 1, 1);
        const filter = {};

        if (item) filter.item = item;
    if (cabin) filter.cabin = cabin;
        if (movementType) filter.movementType = movementType;
        if (event) filter.event = event;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const [total, movements] = await Promise.all([
            InventoryMovement.countDocuments(filter),
            InventoryMovement.find(filter)
                .populate('item', 'name itemType unit')
                .populate('cabin', 'propertyDetails isGrouped')
                .populate('performedBy', 'name email')
                .populate('event', 'folio checkIn checkOut')
                .sort({ createdAt: -1 })
                .skip((safePage - 1) * safeLimit)
                .limit(safeLimit)
                .lean()
        ]);

        return res.json({
            success: true,
            data: movements,
            pagination: {
                total,
                page: safePage,
                limit: safeLimit,
                totalPages: Math.ceil(total / safeLimit) || 1
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error listing movements', error: error.message });
    }
};

const listPurchases = async (req, res) => {
    try {
        const {
            cabin,
            supplier,
            invoiceNumber,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = req.query;

        const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
        const safePage = Math.max(Number(page) || 1, 1);
        const filter = {};

        if (cabin) filter.cabin = cabin;
        if (supplier) filter.supplier = new RegExp(supplier, 'i');
        if (invoiceNumber) filter.invoiceNumber = new RegExp(invoiceNumber, 'i');
        if (startDate || endDate) {
            filter.purchaseDate = {};
            if (startDate) filter.purchaseDate.$gte = new Date(startDate);
            if (endDate) filter.purchaseDate.$lte = new Date(endDate);
        }

        const [total, purchases] = await Promise.all([
            InventoryPurchase.countDocuments(filter),
            InventoryPurchase.find(filter)
                .populate('cabin', 'propertyDetails isGrouped')
                .populate('lines.item', 'name unit itemType')
                .populate('createdBy', 'name email')
                .sort({ purchaseDate: -1, createdAt: -1 })
                .skip((safePage - 1) * safeLimit)
                .limit(safeLimit)
                .lean()
        ]);

        return res.json({
            success: true,
            data: purchases,
            pagination: {
                total,
                page: safePage,
                limit: safeLimit,
                totalPages: Math.ceil(total / safeLimit) || 1
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error listing purchases', error: error.message });
    }
};

const registerPurchase = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { cabin, supplier = '', invoiceNumber = '', purchaseDate, lines } = req.body;
        const existingCabin = await ensureCabinExists(cabin);
        if (!existingCabin) {
            return res.status(404).json({ success: false, message: 'Cabin not found' });
        }

        let totalAmount = 0;
        const normalizedLines = [];

        for (const line of lines) {
            const item = await InventoryItem.findById(line.item);
            if (!item) {
                return res.status(404).json({ success: false, message: `Item not found: ${line.item}` });
            }

            if (String(item.cabin) !== String(cabin)) {
                return res.status(400).json({ success: false, message: `Item ${item.name} does not belong to selected cabin` });
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
                cabin: item.cabin,
                movementType: 'purchase_entry',
                quantity,
                unitCost,
                totalCost: lineTotal,
                stockBefore,
                stockAfter,
                performedBy: req.session.userId || null,
                note: `Entrada por compra ${invoiceNumber || ''}`.trim()
            });

            normalizedLines.push({
                item: item._id,
                quantity,
                unitCost,
                totalCost: lineTotal
            });
        }

        const purchase = await InventoryPurchase.create({
            cabin,
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
                return res.status(400).json({ success: false, message: 'Stock insuficiente para aplicar la salida' });
            }
            stockAfter = stockBefore - qty;
            movementType = 'manual_adjustment_out';
        }

        item.stockCurrent = stockAfter;
        await item.save();

        const movement = await InventoryMovement.create({
            item: item._id,
            cabin: item.cabin,
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
                cabin: item.cabin,
                item: item._id,
                alertType: 'low_stock',
                status: 'open',
                message: `Stock bajo de ${item.name}. Actual ${stockAfter}, minimo ${item.stockMin}.`
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
            .populate('cabin', 'propertyDetails isGrouped')
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
            .populate('cabin', 'propertyDetails isGrouped')
            .lean();

        const totalItems = items.length;
        const lowStockItems = items.filter((item) => Number(item.stockCurrent) <= Number(item.stockMin || 0));

        const stockByCabin = items.reduce((acc, item) => {
            const key = item.cabin?.propertyDetails?.name || 'Sin habitación';
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
                stockByCabin,
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
            .populate('cabins', 'propertyDetails isGrouped')
            .sort({ name: 1 })
            .lean();

        return res.json({ success: true, data: groups });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error listing metric groups', error: error.message });
    }
};

const updateMetricGroup = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { id } = req.params;
        const metricGroup = await InventoryMetricGroup.findById(id);

        if (!metricGroup) {
            return res.status(404).json({ success: false, message: 'Metric group not found' });
        }

        if (Array.isArray(req.body.cabins)) {
            const existingCabins = await Habitacion.find({ _id: { $in: req.body.cabins } }).select('_id').lean();
            if (existingCabins.length !== req.body.cabins.length) {
                return res.status(400).json({ success: false, message: 'One or more cabins are invalid' });
            }
        }

        const fields = ['name', 'description', 'cabins', 'active'];
        fields.forEach((field) => {
            if (req.body[field] !== undefined) {
                metricGroup[field] = field === 'active' ? normalizeBoolean(req.body[field]) : req.body[field];
            }
        });

        await metricGroup.save();

        const updatedGroup = await InventoryMetricGroup.findById(metricGroup._id)
            .populate('cabins', 'propertyDetails isGrouped')
            .lean();

        return res.json({ success: true, data: updatedGroup });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error updating metric group', error: error.message });
    }
};

const deleteMetricGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const metricGroup = await InventoryMetricGroup.findByIdAndUpdate(
            id,
            {
                active: false,
                updatedAt: new Date()
            },
            { new: true }
        ).lean();

        if (!metricGroup) {
            return res.status(404).json({ success: false, message: 'Metric group not found' });
        }

        return res.json({ success: true, data: metricGroup });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error deleting metric group', error: error.message });
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
            .populate('cabin', 'propertyDetails isGrouped')
            .lean();

        const cabinIds = new Set((metricGroup.cabins || []).map((id) => String(id)));
        const filteredItems = items.filter((item) => {
            const itemCabinId = item.cabin?._id ? String(item.cabin._id) : String(item.cabin || '');
            return itemCabinId && cabinIds.has(itemCabinId);
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
    createItemValidators,
    updateItemValidators,
    createBOMTemplateValidators,
    updateBOMTemplateValidators,
    registerPurchaseValidators,
    manualAdjustmentValidators,
    createMetricGroupValidators,
    updateMetricGroupValidators,
    createItem,
    updateItem,
    deleteItem,
    listItems,
    createBOMTemplate,
    updateBOMTemplate,
    deleteBOMTemplate,
    listBOMTemplates,
    listMovements,
    listPurchases,
    registerPurchase,
    createManualAdjustment,
    getAlerts,
    resolveAlert,
    getStockDashboard,
    createMetricGroup,
    listMetricGroups,
    updateMetricGroup,
    deleteMetricGroup,
    getMetricConsumptionDashboard,
    runCheckoutConsumptionNow
};
