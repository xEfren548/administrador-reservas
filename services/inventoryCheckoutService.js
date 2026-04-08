const moment = require('moment-timezone');
const Evento = require('../models/Evento');
const Log = require('../models/Log');
const InventoryItem = require('../models/InventoryItem');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryBOMTemplate = require('../models/InventoryBOMTemplate');
const InventoryAlert = require('../models/InventoryAlert');
const InventoryWarehouse = require('../models/InventoryWarehouse');

const TZ = 'America/Mexico_City';

const buildCheckoutCutoffUtc = () => {
    return moment.tz(TZ).toDate();
};

const getInventoryEffectiveDateForEvent = (event) => {
    return event?.departureDate || null;
};

const resolveTemplate = async (resourceId, effectiveDate) => {
    if (!resourceId || !effectiveDate) {
        return null;
    }

    return InventoryBOMTemplate.findOne({
        active: true,
        scopeType: 'cabana',
        cabin: resourceId,
        effectiveFrom: { $lte: effectiveDate }
    })
        .sort({ effectiveFrom: -1, createdAt: -1 })
        .lean();
};

const createInventoryLog = async (acciones, userId = null) => {
    await Log.create({
        fecha: new Date(),
        idUsuario: userId,
        type: 'inventory',
        acciones
    });
};

const ensureLowStockAlert = async (item, eventId, message) => {
    await InventoryAlert.create({
        warehouse: item.warehouse,
        cabin: item.cabin,
        item: item._id,
        event: eventId,
        alertType: 'insufficient_stock_checkout',
        status: 'open',
        message,
        generatedAt: new Date()
    });
};

const clearInventorySkipState = (event) => {
    event.inventoryConsumptionSkipReason = null;
    event.inventoryConsumptionSkippedAt = null;
};

const hasActiveWarehouseForEvent = async (event, warehouseCabinIds = null) => {
    const resourceId = String(event?.resourceId || '');
    if (!resourceId) {
        return false;
    }

    if (warehouseCabinIds instanceof Set) {
        return warehouseCabinIds.has(resourceId);
    }

    const warehouse = await InventoryWarehouse.findOne({
        active: true,
        cabins: resourceId
    })
        .select('_id')
        .lean();

    return Boolean(warehouse);
};

const resolveWarehouseForEvent = async (event, warehouseByCabinId = null) => {
    const resourceId = String(event?.resourceId || '');
    if (!resourceId) {
        return null;
    }

    if (warehouseByCabinId instanceof Map) {
        return warehouseByCabinId.get(resourceId) || null;
    }

    return InventoryWarehouse.findOne({
        active: true,
        cabins: resourceId
    })
        .select('_id name cabins')
        .lean();
};

const hasApplicableTemplateForEvent = (event, effectiveDatesByCabin) => {
    const effectiveDate = getInventoryEffectiveDateForEvent(event);
    if (!effectiveDate) {
        return false;
    }

    const templateDates = effectiveDatesByCabin.get(String(event.resourceId || '')) || [];
    return templateDates.some((templateDate) => new Date(templateDate).getTime() <= new Date(effectiveDate).getTime());
};

const processSingleEventCheckoutConsumption = async (event, systemUserId = null, warehouseCabinIds = null, warehouseByCabinId = null) => {
    const hasWarehouse = await hasActiveWarehouseForEvent(event, warehouseCabinIds);
    if (!hasWarehouse) {
        event.inventoryConsumptionBlocked = false;
        event.inventoryConsumptionProcessed = false;
        event.inventoryConsumptionProcessedAt = null;
        event.inventoryConsumptionSkipReason = 'missing_warehouse';
        event.inventoryConsumptionSkippedAt = new Date();
        await event.save();

        return {
            consumed: false,
            skipped: true,
            reason: 'La habitacion de la reserva no pertenece a una bodega activa'
        };
    }

    const warehouse = await resolveWarehouseForEvent(event, warehouseByCabinId);
    if (!warehouse) {
        event.inventoryConsumptionBlocked = false;
        event.inventoryConsumptionProcessed = false;
        event.inventoryConsumptionProcessedAt = null;
        event.inventoryConsumptionSkipReason = 'missing_warehouse';
        event.inventoryConsumptionSkippedAt = new Date();
        await event.save();

        return {
            consumed: false,
            skipped: true,
            reason: 'La habitacion de la reserva no pertenece a una bodega activa'
        };
    }

    const eventEffectiveDate = getInventoryEffectiveDateForEvent(event);
    const template = await resolveTemplate(event.resourceId, eventEffectiveDate);

    if (!template || !Array.isArray(template.lines) || template.lines.length === 0) {
        event.inventoryConsumptionBlocked = false;
        event.inventoryConsumptionProcessed = false;
        event.inventoryConsumptionProcessedAt = null;
        event.inventoryConsumptionSkipReason = 'missing_bom';
        event.inventoryConsumptionSkippedAt = new Date();
        await event.save();

        return {
            consumed: false,
            skipped: true,
            reason: 'No hay una plantilla BOM activa vigente para la fecha de salida de la reserva'
        };
    }

    const nights = Math.max(Number(event.nNights || 0), 1);
    const itemIds = template.lines.map((line) => line.item);
    const items = await InventoryItem.find({ _id: { $in: itemIds }, active: true, warehouse: warehouse._id });
    const itemMap = new Map(items.map((item) => [String(item._id), item]));

    const insufficiencies = [];
    const movementPayloads = [];

    for (const line of template.lines) {
        const item = itemMap.get(String(line.item));
        if (!item) {
            insufficiencies.push({
                itemId: line.item,
                reason: 'Item no encontrado o inactivo'
            });
            continue;
        }

        const requiredQty = Number(line.quantityPerNight || 0) * Number(line.useFactor || 1) * nights;
        if (requiredQty <= 0) {
            continue;
        }

        if (item.stockCurrent < requiredQty) {
            insufficiencies.push({
                itemId: item._id,
                itemName: item.name,
                available: item.stockCurrent,
                required: requiredQty
            });
            continue;
        }

        movementPayloads.push({
            item,
            requiredQty
        });
    }

    if (insufficiencies.length > 0) {
        event.inventoryConsumptionBlocked = true;
        event.inventoryConsumptionProcessed = false;
        event.inventoryConsumptionProcessedAt = null;
        clearInventorySkipState(event);
        await event.save();

        for (const issue of insufficiencies) {
            const message = issue.itemName
                ? `Stock insuficiente de ${issue.itemName} en la reserva ${event._id}. Requerido ${issue.required}, disponible ${issue.available}.`
                : `Item de inventario no disponible para la reserva ${event._id}.`;
            const itemRef = issue.itemId ? { _id: issue.itemId, warehouse: warehouse._id } : null;
            if (itemRef) {
                const maybeItem = await InventoryItem.findById(issue.itemId).lean();
                if (maybeItem) {
                    await ensureLowStockAlert(maybeItem, event._id, message);
                }
            }
            await createInventoryLog(message, systemUserId);
        }

        return {
            consumed: false,
            blocked: true,
            insufficiencies
        };
    }

    for (const payload of movementPayloads) {
        const { item, requiredQty } = payload;
        const idempotencyKey = `checkout:${event._id}:${item._id}`;
        const alreadyApplied = await InventoryMovement.findOne({ idempotencyKey }).lean();
        if (alreadyApplied) {
            continue;
        }

        const freshItem = await InventoryItem.findById(item._id);
        if (!freshItem) {
            continue;
        }

        if (freshItem.stockCurrent < requiredQty) {
            const message = `Se detecto una actualizacion concurrente de stock para ${freshItem.name} en la reserva ${event._id}.`;
            await ensureLowStockAlert(freshItem, event._id, message);
            event.inventoryConsumptionBlocked = true;
            event.inventoryConsumptionProcessed = false;
            event.inventoryConsumptionProcessedAt = null;
            clearInventorySkipState(event);
            await event.save();
            return {
                consumed: false,
                blocked: true,
                insufficiencies: [{ itemId: freshItem._id, itemName: freshItem.name }]
            };
        }

        const stockBefore = freshItem.stockCurrent;
        const stockAfter = Math.max(stockBefore - requiredQty, 0);
        freshItem.stockCurrent = stockAfter;
        await freshItem.save();

        await InventoryMovement.create({
            item: freshItem._id,
            warehouse: freshItem.warehouse,
            cabin: freshItem.cabin,
            movementType: 'checkout_exit',
            quantity: requiredQty,
            unitCost: Number(freshItem.lastPurchaseUnitCost || 0),
            totalCost: Number(freshItem.lastPurchaseUnitCost || 0) * requiredQty,
            stockBefore,
            stockAfter,
            event: event._id,
            idempotencyKey,
            performedBy: systemUserId,
            note: `Consumo automatico por checkout de la reserva ${event._id}`
        });

        if (stockAfter <= Number(freshItem.stockMin || 0)) {
            await InventoryAlert.create({
                warehouse: freshItem.warehouse,
                cabin: freshItem.cabin,
                item: freshItem._id,
                event: event._id,
                alertType: 'low_stock',
                status: 'open',
                message: `Stock bajo de ${freshItem.name}. Actual ${stockAfter}, minimo ${freshItem.stockMin}.`
            });
        }
    }

    event.inventoryConsumptionBlocked = false;
    event.inventoryConsumptionProcessed = true;
    event.inventoryConsumptionProcessedAt = new Date();
    clearInventorySkipState(event);
    await event.save();
    await createInventoryLog(`Consumo de inventario por checkout aplicado a la reserva ${event._id}.`, systemUserId);

    return {
        consumed: true,
        blocked: false,
        reservationId: event._id,
        linesApplied: movementPayloads.length
    };
};

const processFinishedReservationsCheckoutConsumption = async (systemUserId = null) => {
    const cutoff = buildCheckoutCutoffUtc();

    const events = await Evento.find({
        status: { $in: ['active', 'reserva de dueño'] },
        departureDate: { $lt: cutoff },
        inventoryConsumptionProcessed: { $ne: true }
    });

    const resourceIds = [...new Set(events.map((event) => String(event.resourceId || '')).filter(Boolean))];
    const activeTemplates = resourceIds.length > 0
        ? await InventoryBOMTemplate.find({
            active: true,
            scopeType: 'cabana',
            cabin: { $in: resourceIds }
        })
            .select('cabin effectiveFrom')
            .sort({ effectiveFrom: -1 })
            .lean()
        : [];
    const activeWarehouses = resourceIds.length > 0
        ? await InventoryWarehouse.find({
            active: true,
            cabins: { $in: resourceIds }
        })
            .select('cabins')
            .lean()
        : [];
    const effectiveDatesByCabin = activeTemplates.reduce((acc, template) => {
        const cabinId = String(template.cabin || '');
        if (!cabinId || !template.effectiveFrom) {
            return acc;
        }

        const currentDates = acc.get(cabinId) || [];
        currentDates.push(template.effectiveFrom);
        acc.set(cabinId, currentDates);
        return acc;
    }, new Map());
    const warehouseCabinIds = activeWarehouses.reduce((acc, warehouse) => {
        (warehouse.cabins || []).forEach((cabinId) => {
            acc.add(String(cabinId));
        });
        return acc;
    }, new Set());
    const warehouseByCabinId = activeWarehouses.reduce((acc, warehouse) => {
        (warehouse.cabins || []).forEach((cabinId) => {
            const normalizedCabinId = String(cabinId);
            if (!acc.has(normalizedCabinId)) {
                acc.set(normalizedCabinId, warehouse);
            }
        });
        return acc;
    }, new Map());

    const summary = {
        totalCandidates: events.length,
        consumed: 0,
        blocked: 0,
        skipped: 0,
        details: []
    };

    for (const event of events) {
        const hasWarehouse = warehouseCabinIds.has(String(event.resourceId || ''));
        const hasTemplate = hasApplicableTemplateForEvent(event, effectiveDatesByCabin);

        if (!hasWarehouse || !hasTemplate) {
            const result = await processSingleEventCheckoutConsumption(event, systemUserId, warehouseCabinIds, warehouseByCabinId);
            summary.details.push({ reservationId: event._id, ...result });
            summary.skipped += 1;
            continue;
        }

        const result = await processSingleEventCheckoutConsumption(event, systemUserId, warehouseCabinIds, warehouseByCabinId);
        summary.details.push({ reservationId: event._id, ...result });

        if (result.consumed) {
            summary.consumed += 1;
        } else if (result.blocked) {
            summary.blocked += 1;
        } else {
            summary.skipped += 1;
        }
    }

    return summary;
};

module.exports = {
    TZ,
    processSingleEventCheckoutConsumption,
    processFinishedReservationsCheckoutConsumption
};
