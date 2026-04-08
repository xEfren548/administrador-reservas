const { check, validationResult } = require('express-validator');
const Habitacion = require('../models/Habitacion');
const InventoryItem = require('../models/InventoryItem');
const InventoryBOMTemplate = require('../models/InventoryBOMTemplate');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryPurchase = require('../models/InventoryPurchase');
const InventoryAlert = require('../models/InventoryAlert');
const InventoryWarehouse = require('../models/InventoryWarehouse');
const { processFinishedReservationsCheckoutConsumption } = require('../services/inventoryCheckoutService');

const createItemValidators = [
    check('name').notEmpty().withMessage('Item name is required'),
    check('partNumber').optional().isString().withMessage('partNumber must be a string'),
    check('warehouse').isMongoId().withMessage('warehouse is required'),
    check('itemType').isIn(['directo', 'indirecto', 'no_consumible']).withMessage('Invalid item type'),
    check('unit').notEmpty().withMessage('Unit is required'),
    check('stockCurrent').optional().isFloat({ min: 0 }).withMessage('stockCurrent must be >= 0'),
    check('stockMin').optional().isFloat({ min: 0 }).withMessage('stockMin must be >= 0'),
    check('initialUnitCost').optional().isFloat({ min: 0 }).withMessage('initialUnitCost must be >= 0'),
    check('initialSupplier').optional().isString().withMessage('initialSupplier must be a string'),
    check('initialInvoiceNumber').optional().isString().withMessage('initialInvoiceNumber must be a string'),
    check('initialPurchaseDate').optional().isISO8601().withMessage('Invalid initialPurchaseDate')
];

const updateItemValidators = [
    check('name').optional().notEmpty().withMessage('Item name cannot be empty'),
    check('partNumber').optional().isString().withMessage('partNumber must be a string'),
    check('warehouse').optional().isMongoId().withMessage('Invalid warehouse id'),
    check('description').optional().isString().withMessage('description must be a string'),
    check('itemType').optional().isIn(['directo', 'indirecto', 'no_consumible']).withMessage('Invalid item type'),
    check('unit').optional().notEmpty().withMessage('Unit cannot be empty'),
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
    check('effectiveFrom').optional().isISO8601().withMessage('effectiveFrom invalido'),
    check('lines').isArray({ min: 1 }).withMessage('At least one BOM line is required'),
    check('lines.*.item').isMongoId().withMessage('Invalid item id in lines'),
    check('lines.*.quantityPerNight').isFloat({ min: 0 }).withMessage('quantityPerNight must be >= 0'),
    check('lines.*.useFactor').optional().isFloat({ min: 0 }).withMessage('useFactor must be >= 0')
];

const updateBOMTemplateValidators = [
    check('name').optional().notEmpty().withMessage('Template name cannot be empty'),
    check('scopeType').optional().isIn(['cabana']).withMessage('Invalid scope type'),
    check('cabin').optional({ nullable: true }).isMongoId().withMessage('Invalid cabin id'),
    check('effectiveFrom').optional().isISO8601().withMessage('effectiveFrom invalido'),
    check('lines').optional().isArray({ min: 1 }).withMessage('At least one BOM line is required'),
    check('lines.*.item').optional().isMongoId().withMessage('Invalid item id in lines'),
    check('lines.*.quantityPerNight').optional().isFloat({ min: 0 }).withMessage('quantityPerNight must be >= 0'),
    check('lines.*.useFactor').optional().isFloat({ min: 0 }).withMessage('useFactor must be >= 0'),
    check('active').optional().isBoolean().withMessage('active must be boolean')
];

const registerPurchaseValidators = [
    check('warehouse').isMongoId().withMessage('warehouse is required'),
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

const createWarehouseValidators = [
    check('name').notEmpty().withMessage('Warehouse name is required'),
    check('description').optional().isString(),
    check('cabins').optional().isArray(),
    check('cabins.*').optional().isMongoId().withMessage('Invalid cabin id in cabins')
];

const updateWarehouseValidators = [
    check('name').optional().notEmpty().withMessage('Warehouse name cannot be empty'),
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

const normalizeEffectiveFrom = (value) => {
    if (!value) {
        return new Date();
    }

    const normalizedDate = new Date(value);
    if (Number.isNaN(normalizedDate.getTime())) {
        return null;
    }

    return normalizedDate;
};

const createItem = async (req, res) => {
    const createdItemIds = [];
    const createdMovementIds = [];
    const createdPurchaseIds = [];

    try {
        if (!handleValidation(req, res)) return;

        const initialStock = Number(req.body.stockCurrent || 0);
        const initialUnitCost = req.body.initialUnitCost !== undefined && req.body.initialUnitCost !== ''
            ? Number(req.body.initialUnitCost)
            : null;
        const normalizedItemName = normalizeItemName(req.body.name);
        const warehouse = await findActiveWarehouseById(req.body.warehouse);

        if (!normalizedItemName) {
            return res.status(400).json({ success: false, message: 'Item name is required' });
        }

        if (!warehouse) {
            return res.status(400).json({ success: false, message: 'La bodega seleccionada no es valida o esta inactiva' });
        }

        if (initialStock > 0 && (initialUnitCost === null || initialUnitCost <= 0)) {
            return res.status(400).json({ success: false, message: 'initialUnitCost is required when initial stock is greater than 0' });
        }

        const existingItem = await InventoryItem.findOne({ warehouse: warehouse._id, name: normalizedItemName })
            .collation({ locale: 'es', strength: 2 })
            .lean();

        if (existingItem) {
            return res.status(409).json({ success: false, message: `Ya existe un item con el mismo nombre en la bodega ${warehouse.name}` });
        }

        const itemCommonPayload = {
            name: normalizedItemName,
            description: req.body.description || '',
            partNumber: String(req.body.partNumber || '').trim(),
            itemType: req.body.itemType,
            unit: req.body.unit,
            stockCurrent: initialStock,
            stockMin: Number(req.body.stockMin || 0),
            lastPurchaseUnitCost: initialUnitCost || 0,
            active: req.body.active !== undefined ? normalizeBoolean(req.body.active) : true,
            createdBy: req.session.userId || null
        };

        const item = await InventoryItem.create({ ...itemCommonPayload, warehouse: warehouse._id, cabin: null });
        createdItemIds.push(item._id);

        if (initialStock > 0) {
            const totalCost = initialStock * initialUnitCost;

            const movement = await InventoryMovement.create({
                item: item._id,
                warehouse: warehouse._id,
                cabin: null,
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
                warehouse: warehouse._id,
                cabin: null,
                supplier: req.body.initialSupplier || '',
                invoiceNumber: req.body.initialInvoiceNumber || '',
                purchaseDate: req.body.initialPurchaseDate || new Date(),
                lines: [{ item: item._id, quantity: initialStock, unitCost: initialUnitCost, totalCost }],
                totalAmount: totalCost,
                createdBy: req.session.userId || null
            });
            createdPurchaseIds.push(purchase._id);
        }

        return res.status(201).json({
            success: true,
            message: 'Item created',
            data: item
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

        const nextWarehouseId = req.body.warehouse !== undefined ? req.body.warehouse : item.warehouse;
        const warehouse = await findActiveWarehouseById(nextWarehouseId);
        if (!warehouse) {
            return res.status(400).json({ success: false, message: 'La bodega seleccionada no es valida o esta inactiva' });
        }

        const nextName = req.body.name !== undefined ? normalizeItemName(req.body.name) : item.name;
        const duplicateItem = await InventoryItem.findOne({
            _id: { $ne: item._id },
            warehouse: warehouse._id,
            name: nextName
        })
            .collation({ locale: 'es', strength: 2 })
            .lean();

        if (duplicateItem) {
            return res.status(409).json({ success: false, message: `Ya existe otro item con el mismo nombre en la bodega ${warehouse.name}` });
        }

        const fields = ['name', 'description', 'partNumber', 'itemType', 'unit', 'stockCurrent', 'stockMin', 'lastPurchaseUnitCost', 'active', 'warehouse'];
        fields.forEach((field) => {
            if (req.body[field] !== undefined) {
                if (field === 'active') {
                    item[field] = normalizeBoolean(req.body[field]);
                    return;
                }
                if (field === 'warehouse') {
                    item[field] = warehouse._id;
                    return;
                }
                if (field === 'partNumber') {
                    item[field] = String(req.body[field] || '').trim();
                    return;
                }
                item[field] = field === 'name' ? nextName : req.body[field];
            }
        });

        item.cabin = null;

        await item.save();

        const updatedItem = await InventoryItem.findById(item._id)
            .populate('warehouse', 'name active')
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
        const { active, itemType, lowStockOnly, warehouse } = req.query;
        const filter = {};

        if (active !== undefined) filter.active = active === 'true';
        if (itemType) filter.itemType = itemType;
        if (warehouse) filter.warehouse = warehouse;

        const items = await InventoryItem.find(filter)
            .populate('warehouse', 'name active')
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

const getCabinDisplayNameMap = async (cabinIds = []) => {
    const cabins = await Habitacion.find({ _id: { $in: cabinIds } })
        .select('_id propertyDetails.name')
        .lean();

    return new Map(cabins.map((room) => [String(room._id), room.propertyDetails?.name || String(room._id)]));
};

const normalizeCabinIds = (cabinIds = []) => [...new Set((Array.isArray(cabinIds) ? cabinIds : []).filter(Boolean).map(String))];

const getWarehouseDisplayName = (warehouse) => warehouse?.name || 'Bodega sin nombre';

const findActiveWarehouseById = async (warehouseId) => {
    if (!warehouseId) {
        return null;
    }

    return InventoryWarehouse.findOne({ _id: warehouseId, active: true })
        .select('_id name cabins active')
        .lean();
};

const getWarehouseByCabinMap = async (cabinIds = []) => {
    const normalizedCabinIds = normalizeCabinIds(cabinIds);

    if (normalizedCabinIds.length === 0) {
        return new Map();
    }

    const warehouses = await InventoryWarehouse.find({
        active: true,
        cabins: { $in: normalizedCabinIds }
    })
        .select('_id name cabins')
        .lean();

    return warehouses.reduce((acc, warehouse) => {
        (warehouse.cabins || []).forEach((cabinId) => {
            const normalizedCabinId = String(cabinId);
            if (normalizedCabinIds.includes(normalizedCabinId) && !acc.has(normalizedCabinId)) {
                acc.set(normalizedCabinId, warehouse);
            }
        });
        return acc;
    }, new Map());
};

const resolveWarehouseForCabins = async (cabinIds = []) => {
    const normalizedCabinIds = normalizeCabinIds(cabinIds);
    if (normalizedCabinIds.length === 0) {
        return { valid: false, message: 'At least one cabin is required' };
    }

    const cabinNameMap = await getCabinDisplayNameMap(normalizedCabinIds);
    if (cabinNameMap.size !== normalizedCabinIds.length) {
        return { valid: false, message: 'One or more cabins were not found' };
    }

    const warehouseByCabin = await getWarehouseByCabinMap(normalizedCabinIds);
    if (warehouseByCabin.size !== normalizedCabinIds.length) {
        const cabinsWithoutWarehouse = normalizedCabinIds
            .filter((cabinId) => !warehouseByCabin.has(cabinId))
            .map((cabinId) => cabinNameMap.get(cabinId) || cabinId);

        return {
            valid: false,
            message: `Todas las habitaciones de la BOM deben pertenecer a una bodega activa. Faltan: ${cabinsWithoutWarehouse.join(', ')}`
        };
    }

    const uniqueWarehouseIds = [...new Set(normalizedCabinIds.map((cabinId) => String(warehouseByCabin.get(cabinId)?._id || '')))].filter(Boolean);
    if (uniqueWarehouseIds.length !== 1) {
        return {
            valid: false,
            message: 'Solo puedes crear o editar una BOM usando habitaciones de la misma bodega activa'
        };
    }

    return {
        valid: true,
        warehouse: warehouseByCabin.get(normalizedCabinIds[0]),
        cabinNameMap,
        normalizedCabinIds
    };
};

const validateBomItemsForWarehouse = async (warehouseId, lines = []) => {
    const lineItemIds = [...new Set(lines.map((line) => String(line.item)).filter(Boolean))];

    const items = await InventoryItem.find({ _id: { $in: lineItemIds }, active: true })
        .select('_id name warehouse')
        .lean();

    if (items.length !== lineItemIds.length) {
        return { valid: false, message: 'One or more BOM items are invalid' };
    }

    const wrongWarehouseItems = items.filter((item) => String(item.warehouse || '') !== String(warehouseId || ''));
    if (wrongWarehouseItems.length > 0) {
        return {
            valid: false,
            message: `Todos los items de la BOM deben pertenecer a la misma bodega de las habitaciones seleccionadas. Revisa: ${wrongWarehouseItems.map((item) => item.name).join(', ')}`
        };
    }

    return { valid: true };
};

const validateWarehouseCabinAvailability = async (cabinIds = [], excludeWarehouseId = null) => {
    const normalizedCabinIds = normalizeCabinIds(cabinIds);

    if (normalizedCabinIds.length === 0) {
        return { valid: true, normalizedCabinIds, cabinNameMap: new Map() };
    }

    const cabinNameMap = await getCabinDisplayNameMap(normalizedCabinIds);
    if (cabinNameMap.size !== normalizedCabinIds.length) {
        return { valid: false, message: 'One or more cabins are invalid' };
    }

    const filter = {
        active: true,
        cabins: { $in: normalizedCabinIds }
    };

    if (excludeWarehouseId) {
        filter._id = { $ne: excludeWarehouseId };
    }

    const conflictingWarehouses = await InventoryWarehouse.find(filter)
        .select('name cabins')
        .lean();

    if (conflictingWarehouses.length === 0) {
        return { valid: true, normalizedCabinIds, cabinNameMap };
    }

    const conflicts = normalizedCabinIds.reduce((acc, cabinId) => {
        const conflictingWarehouse = conflictingWarehouses.find((warehouse) =>
            (warehouse.cabins || []).some((warehouseCabinId) => String(warehouseCabinId) === cabinId)
        );

        if (!conflictingWarehouse) {
            return acc;
        }

        const cabinName = cabinNameMap.get(cabinId) || cabinId;
        acc.push(`${cabinName} (${conflictingWarehouse.name})`);
        return acc;
    }, []);

    return {
        valid: false,
        message: `Las siguientes habitaciones ya estan asignadas a otra bodega activa: ${conflicts.join(', ')}`,
        cabinNameMap,
        normalizedCabinIds
    };
};

const validateBomCabinAvailability = async (cabinIds = [], excludeTemplateId = null) => {
    const normalizedCabinIds = [...new Set((cabinIds || []).filter(Boolean).map(String))];

    if (normalizedCabinIds.length === 0) {
        return { valid: true, cabinNameMap: new Map() };
    }

    const cabinNameMap = await getCabinDisplayNameMap(normalizedCabinIds);
    if (cabinNameMap.size !== normalizedCabinIds.length) {
        return { valid: false, message: 'One or more cabins were not found' };
    }

    const filter = {
        active: true,
        scopeType: 'cabana',
        cabin: { $in: normalizedCabinIds }
    };

    if (excludeTemplateId) {
        filter._id = { $ne: excludeTemplateId };
    }

    const existingTemplates = await InventoryBOMTemplate.find(filter)
        .select('_id cabin')
        .lean();

    if (existingTemplates.length > 0) {
        const duplicatedCabins = existingTemplates
            .map((template) => cabinNameMap.get(String(template.cabin)) || String(template.cabin))
            .filter(Boolean);

        return {
            valid: false,
            message: `Ya existe una BOM activa para: ${duplicatedCabins.join(', ')}. Debes editar la existente.`
        };
    }

    return { valid: true, cabinNameMap };
};

const createBOMTemplate = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { cabin, cabinIds = [] } = req.body;
        const selectedCabinIds = Array.isArray(cabinIds) ? cabinIds.filter(Boolean) : [];
        const targetCabinIds = [...new Set([cabin, ...selectedCabinIds].filter(Boolean).map(String))];
        const effectiveFrom = normalizeEffectiveFrom(req.body.effectiveFrom);

        if (targetCabinIds.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one cabin is required for BOM creation' });
        }

        if (!effectiveFrom) {
            return res.status(400).json({ success: false, message: 'La fecha de vigencia de la BOM es invalida' });
        }

        const bomWarehouseValidation = await resolveWarehouseForCabins(targetCabinIds);
        if (!bomWarehouseValidation.valid) {
            return res.status(400).json({ success: false, message: bomWarehouseValidation.message });
        }

        const bomItemValidation = await validateBomItemsForWarehouse(bomWarehouseValidation.warehouse._id, req.body.lines || []);
        if (!bomItemValidation.valid) {
            return res.status(400).json({ success: false, message: bomItemValidation.message });
        }

        const bomAvailabilityValidation = await validateBomCabinAvailability(targetCabinIds);
        if (!bomAvailabilityValidation.valid) {
            return res.status(409).json({ success: false, message: bomAvailabilityValidation.message });
        }

        const cabinNameMap = bomAvailabilityValidation.cabinNameMap || new Map();

        if (targetCabinIds.length > 1) {
            const templatesToCreate = targetCabinIds.map((cabinId) => ({
                name: `${req.body.name} - ${cabinNameMap.get(String(cabinId)) || String(cabinId)}`,
                scopeType: 'cabana',
                cabin: cabinId,
                lines: req.body.lines,
                effectiveFrom,
                active: true,
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
            cabin: targetCabinIds[0],
            groupName: null,
            cabins: [],
            effectiveFrom,
            active: true,
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

        if (String(nextCabin) !== String(template.cabin)) {
            return res.status(409).json({ success: false, message: 'La habitacion de una BOM existente no se puede cambiar. Debes editar la BOM de esa habitacion.' });
        }

        const bomAvailabilityValidation = await validateBomCabinAvailability([nextCabin], template._id);
        if (!bomAvailabilityValidation.valid) {
            return res.status(409).json({ success: false, message: bomAvailabilityValidation.message });
        }

        const bomWarehouseValidation = await resolveWarehouseForCabins([nextCabin]);
        if (!bomWarehouseValidation.valid) {
            return res.status(400).json({ success: false, message: bomWarehouseValidation.message });
        }

        if (Array.isArray(req.body.lines)) {
            const bomItemValidation = await validateBomItemsForWarehouse(bomWarehouseValidation.warehouse._id, req.body.lines);
            if (!bomItemValidation.valid) {
                return res.status(400).json({ success: false, message: bomItemValidation.message });
            }
        }

        const fields = ['name', 'lines', 'effectiveFrom'];
        fields.forEach((field) => {
            if (req.body[field] !== undefined) {
                if (field === 'effectiveFrom') {
                    const effectiveFrom = normalizeEffectiveFrom(req.body[field]);
                    if (!effectiveFrom) {
                        throw new Error('La fecha de vigencia de la BOM es invalida');
                    }
                    template[field] = effectiveFrom;
                    return;
                }
                template[field] = req.body[field];
            }
        });

        template.scopeType = 'cabana';
        template.cabin = nextCabin;
        template.groupName = null;
        template.cabins = [];

        await template.save();

        const updatedTemplate = await InventoryBOMTemplate.findById(template._id)
            .populate('cabin', 'propertyDetails isGrouped')
            .populate('lines.item', 'name itemType unit stockCurrent stockMin warehouse')
            .lean();

        return res.json({ success: true, data: updatedTemplate });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error updating BOM template', error: error.message });
    }
};

const deleteBOMTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await InventoryBOMTemplate.findById(id).lean();

        if (!template) {
            return res.status(404).json({ success: false, message: 'BOM template not found' });
        }

        return res.status(409).json({
            success: false,
            message: 'Ya no se permite desactivar una BOM por habitacion. Debes editar la existente para agregar o quitar productos.'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error deleting BOM template', error: error.message });
    }
};

const listBOMTemplates = async (req, res) => {
    try {
        const { scopeType, cabin, groupName, active } = req.query;
        const filter = {
            scopeType: scopeType || 'cabana',
            active: active !== undefined ? active === 'true' : true
        };
        if (cabin) filter.cabin = cabin;
        if (groupName) filter.groupName = groupName;

        const templates = await InventoryBOMTemplate.find(filter)
            .populate('cabin', 'propertyDetails isGrouped')
            .populate('lines.item', 'name itemType unit stockCurrent stockMin warehouse')
            .sort({ effectiveFrom: -1, updatedAt: -1 })
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
            warehouse,
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
        if (warehouse) filter.warehouse = warehouse;
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
                .populate('warehouse', 'name active')
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
            warehouse,
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

        if (warehouse) filter.warehouse = warehouse;
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
                .populate('warehouse', 'name active')
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

        const { supplier = '', invoiceNumber = '', purchaseDate, lines, warehouse: warehouseId } = req.body;
        const warehouse = await findActiveWarehouseById(warehouseId);

        if (!warehouse) {
            return res.status(400).json({ success: false, message: 'La bodega seleccionada no es valida o esta inactiva' });
        }

        let totalAmount = 0;
        const normalizedLines = [];

        for (const line of lines) {
            const item = await InventoryItem.findById(line.item);
            if (!item) {
                return res.status(404).json({ success: false, message: `Item not found: ${line.item}` });
            }

            if (String(item.warehouse || '') !== String(warehouse._id)) {
                return res.status(400).json({ success: false, message: `El item ${item.name} no pertenece a la bodega ${warehouse.name}` });
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
                warehouse: warehouse._id,
                cabin: null,
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
            warehouse: warehouse._id,
            cabin: null,
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

        if (!item.warehouse) {
            return res.status(400).json({ success: false, message: 'El item no tiene una bodega valida asociada' });
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
            warehouse: item.warehouse,
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
                warehouse: item.warehouse,
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
            .populate('warehouse', 'name active')
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
            .populate('warehouse', 'name active')
            .lean();

        const totalItems = items.length;
        const lowStockItems = items.filter((item) => Number(item.stockCurrent) <= Number(item.stockMin || 0));

        const stockByWarehouse = items.reduce((acc, item) => {
            const key = getWarehouseDisplayName(item.warehouse);
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
                stockByWarehouse,
                stockByCabin: stockByWarehouse,
                lowStockItems
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error building stock dashboard', error: error.message });
    }
};

const createWarehouse = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { name, description = '', cabins = [] } = req.body;

        const normalizedCabins = normalizeCabinIds(cabins);
        const availabilityValidation = await validateWarehouseCabinAvailability(normalizedCabins);
        if (!availabilityValidation.valid) {
            return res.status(409).json({ success: false, message: availabilityValidation.message });
        }

        const warehouse = await InventoryWarehouse.create({
            name: String(name || '').trim(),
            description,
            cabins: normalizedCabins,
            createdBy: req.session.userId || null
        });

        return res.status(201).json({ success: true, data: warehouse });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error creating warehouse', error: error.message });
    }
};

const listWarehouses = async (req, res) => {
    try {
        const warehouses = await InventoryWarehouse.find({ active: true })
            .populate('cabins', 'propertyDetails isGrouped')
            .sort({ name: 1 })
            .lean();

        return res.json({ success: true, data: warehouses });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error listing warehouses', error: error.message });
    }
};

const updateWarehouse = async (req, res) => {
    try {
        if (!handleValidation(req, res)) return;

        const { id } = req.params;
        const warehouse = await InventoryWarehouse.findById(id);

        if (!warehouse) {
            return res.status(404).json({ success: false, message: 'Warehouse not found' });
        }

        if (Array.isArray(req.body.cabins)) {
            const availabilityValidation = await validateWarehouseCabinAvailability(req.body.cabins, warehouse._id);
            if (!availabilityValidation.valid) {
                return res.status(409).json({ success: false, message: availabilityValidation.message });
            }
            req.body.cabins = availabilityValidation.normalizedCabinIds;
        }

        const fields = ['name', 'description', 'cabins', 'active'];
        fields.forEach((field) => {
            if (req.body[field] !== undefined) {
                if (field === 'active') {
                    warehouse[field] = normalizeBoolean(req.body[field]);
                    return;
                }

                warehouse[field] = field === 'name'
                    ? String(req.body[field] || '').trim()
                    : req.body[field];
            }
        });

        await warehouse.save();

        const updatedWarehouse = await InventoryWarehouse.findById(warehouse._id)
            .populate('cabins', 'propertyDetails isGrouped')
            .lean();

        return res.json({ success: true, data: updatedWarehouse });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error updating warehouse', error: error.message });
    }
};

const deleteWarehouse = async (req, res) => {
    try {
        const { id } = req.params;
        const warehouse = await InventoryWarehouse.findByIdAndUpdate(
            id,
            {
                active: false,
                updatedAt: new Date()
            },
            { new: true }
        ).lean();

        if (!warehouse) {
            return res.status(404).json({ success: false, message: 'Warehouse not found' });
        }

        return res.json({ success: true, data: warehouse });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error deleting warehouse', error: error.message });
    }
};

const getWarehouseSummary = async (req, res) => {
    try {
        const { warehouseId } = req.params;

        const warehouse = await InventoryWarehouse.findById(warehouseId)
            .populate('cabins', 'propertyDetails isGrouped')
            .lean();

        if (!warehouse) {
            return res.status(404).json({ success: false, message: 'Warehouse not found' });
        }

        const cabinIds = normalizeCabinIds((warehouse.cabins || []).map((cabin) => cabin._id || cabin));
        const templates = await InventoryBOMTemplate.find({
            active: true,
            scopeType: 'cabana',
            cabin: { $in: cabinIds }
        })
            .select('cabin effectiveFrom')
            .lean();
        const items = await InventoryItem.find({ warehouse: warehouse._id, active: true })
            .select('_id stockCurrent stockMin')
            .lean();

        const cabinsWithBom = new Set(templates.map((template) => String(template.cabin || '')));
        const roomsWithBom = (warehouse.cabins || []).filter((cabin) => cabinsWithBom.has(String(cabin._id || cabin)));
        const roomsWithoutBom = (warehouse.cabins || []).filter((cabin) => !cabinsWithBom.has(String(cabin._id || cabin)));
        const totalStock = items.reduce((sum, item) => sum + Number(item.stockCurrent || 0), 0);
        const lowStockCount = items.filter((item) => Number(item.stockCurrent || 0) <= Number(item.stockMin || 0)).length;

        return res.json({
            success: true,
            data: {
                warehouse,
                roomCount: cabinIds.length,
                itemCount: items.length,
                totalStock,
                lowStockCount,
                roomsWithBomCount: roomsWithBom.length,
                roomsWithoutBomCount: roomsWithoutBom.length,
                roomsWithBom,
                roomsWithoutBom
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error building warehouse summary', error: error.message });
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
    createWarehouseValidators,
    updateWarehouseValidators,
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
    createWarehouse,
    listWarehouses,
    updateWarehouse,
    deleteWarehouse,
    getWarehouseSummary,
    runCheckoutConsumptionNow
};
