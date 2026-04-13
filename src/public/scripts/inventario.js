(function () {
    const apiBase = '/api/inventory';
    const state = {
        rooms: [],
        items: [],
        roomInventoryEntries: [],
        roomInventoryTransferCandidates: [],
        selectedRoomInventoryId: '',
        selectedRoomInventoryType: 'all',
        purchases: [],
        movements: [],
        bomTemplates: [],
        warehouses: [],
        editingWarehouseId: null,
        editingItemId: null,
        editingBOMId: null,
        bomRoomSelectionLocked: false
    };

    const dashboardCharts = {
        stockByCabin: null,
        stockHealth: null
    };

    const el = {
        spinner: document.getElementById('inventoryGlobalSpinner'),
        tabs: document.querySelectorAll('.inventory-tab-button'),
        tabContents: document.querySelectorAll('.inventory-tab-content'),
        totalItems: document.getElementById('dashboard-total-items'),
        lowStock: document.getElementById('dashboard-low-stock'),
        roomCount: document.getElementById('dashboard-room-count'),
        totalUnits: document.getElementById('dashboard-total-units'),
        stockByCabin: document.getElementById('stock-by-cabin'),
        stockByCabinChart: document.getElementById('dashboard-stock-by-cabin-chart'),
        stockHealthChart: document.getElementById('dashboard-stock-health-chart'),
        criticalItems: document.getElementById('critical-items'),
        itemsTableBody: document.getElementById('items-table-body'),
        purchasesTableBody: document.getElementById('purchases-table-body'),
        movementsTableBody: document.getElementById('movements-table-body'),
        warehousesList: document.getElementById('warehouses-list'),
        roomInventoryRoomSelect: document.getElementById('room-inventory-room-select'),
        roomInventoryTypeFilter: document.getElementById('room-inventory-type-filter'),
        roomInventoryLoading: document.getElementById('room-inventory-loading'),
        roomInventorySummary: document.getElementById('room-inventory-summary'),
        roomInventoryTableBody: document.getElementById('room-inventory-table-body'),
        bomList: document.getElementById('bom-list'),
        alertsList: document.getElementById('alerts-list'),
        warehouseSummaryTableBody: document.getElementById('warehouse-summary-table-body'),
        warehouseVisualSummary: document.getElementById('warehouse-visual-summary'),
        warehouseSummaryTotalWarehouses: document.getElementById('warehouse-summary-total-warehouses'),
        warehouseSummaryTotalItems: document.getElementById('warehouse-summary-total-items'),
        warehouseSummaryTotalStock: document.getElementById('warehouse-summary-total-stock'),
        warehouseSummaryLowStock: document.getElementById('warehouse-summary-low-stock'),
        formWarehouse: document.getElementById('form-warehouse'),
        formItem: document.getElementById('form-item'),
        formPurchase: document.getElementById('form-purchase'),
        formAdjustment: document.getElementById('form-adjustment'),
        formRoomTransfer: document.getElementById('form-room-transfer'),
        formRoomAdjustment: document.getElementById('form-room-adjustment'),
        formBOMTemplate: document.getElementById('form-bom-template'),
        modalWarehouse: document.getElementById('modalWarehouse'),
        modalItem: document.getElementById('modalItem'),
        modalPurchase: document.getElementById('modalPurchase'),
        modalAdjustment: document.getElementById('modalAdjustment'),
        modalRoomTransfer: document.getElementById('modalRoomTransfer'),
        modalRoomAdjustment: document.getElementById('modalRoomAdjustment'),
        modalBOMTemplate: document.getElementById('modalBOMTemplate'),
        modalWarehouseTitle: document.getElementById('modal-warehouse-title'),
        modalWarehouseSubmit: document.getElementById('modal-warehouse-submit'),
        modalItemTitle: document.getElementById('modal-item-title'),
        modalItemSubmit: document.getElementById('modal-item-submit'),
        modalBOMTitle: document.getElementById('modal-bom-title'),
        modalBOMSubmit: document.getElementById('modal-bom-submit'),
        bomEffectiveFrom: document.getElementById('bom-effective-from'),
        itemInitialPurchaseSection: document.getElementById('item-initial-purchase-section'),
        itemInitialUnitCost: document.getElementById('item-initial-unit-cost'),
        btnRunConsumption: document.getElementById('btn-run-checkout-consumption'),
        btnRefreshItems: document.getElementById('btn-refresh-items'),
        btnRefreshWarehouses: document.getElementById('btn-refresh-warehouses'),
        btnOpenRoomTransfer: document.getElementById('btn-open-room-transfer'),
        btnOpenRoomAdjustment: document.getElementById('btn-open-room-adjustment'),
        btnRefreshRoomInventory: document.getElementById('btn-refresh-room-inventory'),
        btnRefreshBom: document.getElementById('btn-refresh-bom'),
        btnRefreshAlerts: document.getElementById('btn-refresh-alerts'),
        btnRefreshPurchases: document.getElementById('btn-refresh-purchases'),
        btnRefreshMovements: document.getElementById('btn-refresh-movements'),
        btnRefreshWarehouseSummary: document.getElementById('btn-refresh-warehouse-summary'),
        itemUnitSelect: document.getElementById('item-unit-select'),
        itemUnitCustom: document.getElementById('item-unit-custom'),
        itemWarehouseSelect: document.getElementById('item-warehouse-select'),
        purchaseWarehouseSelect: document.getElementById('purchase-warehouse-select'),
        roomTransferRoomSelect: document.getElementById('room-transfer-room-select'),
        roomTransferItemSelect: document.getElementById('room-transfer-item-select'),
        roomTransferStockHint: document.getElementById('room-transfer-stock-hint'),
        roomAdjustmentRoomSelect: document.getElementById('room-adjustment-room-select'),
        roomAdjustmentItemSelect: document.getElementById('room-adjustment-item-select'),
        roomAdjustmentStockHint: document.getElementById('room-adjustment-stock-hint'),
        warehouseRoomFilter: document.getElementById('warehouse-room-filter'),
        warehouseRoomChecklist: document.getElementById('warehouse-room-checklist'),
        bomRoomFilter: document.getElementById('bom-room-filter'),
        bomRoomChecklist: document.getElementById('bom-room-checklist'),
        purchaseLinesContainer: document.getElementById('purchase-lines-container'),
        btnAddPurchaseLine: document.getElementById('btn-add-purchase-line'),
        adjustmentItemSelect: document.getElementById('adjustment-item-select'),
        bomLinesContainer: document.getElementById('bom-lines-container'),
        btnAddBomLine: document.getElementById('btn-add-bom-line')
    };

    const isMasterAdmin = Boolean(window.isMasterAdmin);
    const canManageInventory = Boolean(window.canManageInventory || window.isMasterAdmin);
    const canAdjustInventory = Boolean(window.canAdjustInventory || window.isMasterAdmin);
    const canViewInventoryDashboard = Boolean(window.canViewInventoryDashboard);
    let loadingModalCount = 0;

    const toggleSpinner = (show) => {
        if (!el.spinner) return;
        el.spinner.classList.toggle('hidden', !show);
    };

    const collectErrorMessages = (payload) => {
        if (!payload) return [];

        if (typeof payload === 'string') {
            return [payload];
        }

        if (Array.isArray(payload)) {
            return payload.flatMap((entry) => collectErrorMessages(entry));
        }

        const messages = [];
        if (typeof payload.message === 'string' && payload.message.trim()) {
            messages.push(payload.message.trim());
        }
        if (typeof payload.error === 'string' && payload.error.trim()) {
            messages.push(payload.error.trim());
        }
        if (Array.isArray(payload.error)) {
            messages.push(...collectErrorMessages(payload.error));
        }
        if (Array.isArray(payload.errors)) {
            messages.push(...collectErrorMessages(payload.errors));
        }
        if (typeof payload.msg === 'string' && payload.msg.trim()) {
            messages.push(payload.msg.trim());
        }

        return messages.filter(Boolean);
    };

    const extractErrorMessage = (payload) => {
        const messages = [...new Set(collectErrorMessages(payload))];
        if (messages.length === 0) {
            return 'Error de comunicacion con inventario';
        }
        return messages.join('\n');
    };

    const request = async (path, options = {}) => {
        const response = await fetch(`${apiBase}${path}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(extractErrorMessage(data));
            error.payload = data;
            error.status = response.status;
            throw error;
        }
        return data;
    };

    const money = (value) => Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatDateTime = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDateTimeLocalInput = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return localDate.toISOString().slice(0, 16);
    };

    const getMexicoCityNowForInput = () => {
        const formatter = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Mexico_City',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        });

        return formatter.format(new Date()).replace(' ', 'T');
    };

    const parseDateTimeLocalInput = (value) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString();
    };

    const movementTypeLabel = (value) => ({
        purchase_entry: 'Compra',
        manual_adjustment_in: 'Ajuste +',
        manual_adjustment_out: 'Ajuste -',
        checkout_exit: 'Checkout',
        transfer_in: 'Transferencia +',
        transfer_out: 'Transferencia -',
        initial_balance: 'Saldo inicial'
    }[value] || value || '-');

    const chartPalette = ['#0F766E', '#0EA5E9', '#14B8A6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    const formatMovementNote = (value) => {
        const note = String(value || '').trim();
        if (!note) return '-';

        if (note === 'Initial stock on item creation') {
            return 'Stock inicial al crear el item';
        }

        if (note.startsWith('Purchase entry ')) {
            return note.replace(/^Purchase entry\s*/i, 'Entrada por compra ');
        }

        if (note === 'Purchase entry') {
            return 'Entrada por compra';
        }

        if (note.startsWith('Automatic checkout consumption for reservation ')) {
            return note.replace(/^Automatic checkout consumption for reservation\s*/i, 'Consumo automatico por checkout de la reserva ');
        }

        return note;
    };

    const movementLocationLabel = (movement) => {
        if (!movement) return '-';

        if (movement.balanceScope === 'room') {
            return movement.cabin ? `Habitacion: ${roomDisplayName(movement.cabin)}` : 'Habitacion';
        }

        if (movement.cabin && movement.movementType === 'checkout_exit') {
            return `${warehouseDisplayName(movement.warehouse)} / ${roomDisplayName(movement.cabin)}`;
        }

        return warehouseDisplayName(movement.warehouse);
    };

    const getSwal = () => window.Swal || window.swal || null;

    const showSuccess = async (message, title = 'Operacion completada') => {
        const swal = getSwal();
        if (!swal?.fire) {
            return;
        }

        await swal.fire({
            icon: 'success',
            title,
            text: message,
            timer: 1800,
            timerProgressBar: true,
            showConfirmButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false
        });
    };

    const showError = async (error) => {
        console.error(error);
        const swal = getSwal();
        const message = error?.message || 'Ocurrio un error inesperado';
        if (!swal?.fire) {
            return;
        }

        await swal.fire({
            icon: 'error',
            title: 'No se pudo completar la accion',
            text: message,
            confirmButtonText: 'Cerrar',
            allowOutsideClick: true,
            allowEscapeKey: true
        });
    };

    const confirmAction = async ({ title = 'Confirmar accion', text, confirmButtonText = 'Continuar', cancelButtonText = 'Cancelar' }) => {
        const swal = getSwal();
        if (!swal?.fire) {
            return true;
        }

        const result = await swal.fire({
            icon: 'warning',
            title,
            text,
            showCancelButton: true,
            confirmButtonText,
            cancelButtonText,
            reverseButtons: true,
            focusCancel: true,
            allowOutsideClick: true,
            allowEscapeKey: true
        });

        return Boolean(result.isConfirmed);
    };

    const openLoadingDialog = (title = 'Procesando...', text = 'Espera un momento.') => {
        const swal = getSwal();
        loadingModalCount += 1;

        if (!swal?.fire || loadingModalCount > 1) {
            return;
        }

        swal.fire({
            title,
            text,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                swal.showLoading();
                swal.getPopup()?.setAttribute('aria-busy', 'true');
            }
        });
    };

    const closeLoadingDialog = () => {
        const swal = getSwal();
        loadingModalCount = Math.max(loadingModalCount - 1, 0);
        if (loadingModalCount === 0 && swal?.isVisible?.()) {
            swal.close();
        }
    };

    const setPendingState = (target, busy, busyText = 'Procesando...') => {
        if (!target) return () => {};

        const elements = target.tagName === 'FORM'
            ? Array.from(target.querySelectorAll('button, input, select, textarea'))
            : [target];

        const snapshot = elements.map((element) => ({
            element,
            disabled: element.disabled,
            text: element.tagName === 'BUTTON' ? element.textContent : null
        }));

        snapshot.forEach(({ element }) => {
            element.disabled = busy;
            if (busy && element.tagName === 'BUTTON' && element === target && busyText) {
                element.textContent = busyText;
            }
        });

        if (target.setAttribute) {
            target.setAttribute('aria-busy', busy ? 'true' : 'false');
        }

        return () => {
            snapshot.forEach(({ element, disabled, text }) => {
                element.disabled = disabled;
                if (text !== null) {
                    element.textContent = text;
                }
            });
            if (target.removeAttribute) {
                target.removeAttribute('aria-busy');
            }
        };
    };

    const runBusyAction = async ({ target, busyText, loadingTitle, loadingText, successMessage, successTitle, action }) => {
        const releasePendingState = setPendingState(target, true, busyText);
        openLoadingDialog(loadingTitle, loadingText);

        try {
            const result = await action();
            closeLoadingDialog();
            if (successMessage) {
                await showSuccess(successMessage, successTitle);
            }
            return result;
        } catch (error) {
            closeLoadingDialog();
            throw error;
        } finally {
            releasePendingState();
        }
    };

    const escapeHtml = (value) => String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const roomDisplayName = (room) => {
        if (!room) return 'Bodega Global';
        return room?.propertyDetails?.name || room?.name || 'Habitacion';
    };

    const warehouseDisplayName = (warehouse) => {
        if (!warehouse) return 'Sin bodega';
        return warehouse?.name || 'Bodega';
    };

    const getSelectedRoomInventoryRoomId = () => String(el.roomInventoryRoomSelect?.value || state.selectedRoomInventoryId || '');

    const populateRoomSelect = (select, selectedValue = '') => {
        if (!select) return;
        select.innerHTML = [
            '<option value="">Selecciona habitacion</option>',
            ...state.rooms.map((room) => `<option value="${room._id}" ${String(selectedValue) === String(room._id) ? 'selected' : ''}>${escapeHtml(roomDisplayName(room))}</option>`)
        ].join('');
    };

    const setRoomInventoryLoading = (loading) => {
        el.roomInventoryLoading?.classList.toggle('hidden', !loading);
        if (el.roomInventoryRoomSelect) {
            el.roomInventoryRoomSelect.disabled = loading;
        }
        if (el.roomInventoryTypeFilter) {
            el.roomInventoryTypeFilter.disabled = loading;
        }
        if (el.btnRefreshRoomInventory) {
            el.btnRefreshRoomInventory.disabled = loading;
        }
    };

    const getWarehouseItems = (warehouseId, items = state.items) => {
        return (items || []).filter((item) => String(item.warehouse?._id || item.warehouse || '') === String(warehouseId || ''));
    };

    const buildWarehouseVisualCards = (summaries = [], items = []) => {
        if (!el.warehouseVisualSummary) return;

        if (!Array.isArray(summaries) || summaries.length === 0) {
            el.warehouseVisualSummary.innerHTML = '<div class="warehouse-summary-empty xl:col-span-2">No hay bodegas para mostrar en el resumen.</div>';
            return;
        }

        el.warehouseVisualSummary.innerHTML = summaries.map((summary) => {
            const warehouse = summary.warehouse || {};
            const warehouseItems = getWarehouseItems(warehouse._id, items);
            const lowStockItems = warehouseItems.filter((item) => Number(item.stockCurrent || 0) <= Number(item.stockMin || 0));
            const roomChips = (warehouse.cabins || []).map((room) => `<span class="warehouse-summary-chip">${escapeHtml(roomDisplayName(room))}</span>`).join('');
            const itemRows = warehouseItems.map((item) => {
                const isLow = Number(item.stockCurrent || 0) <= Number(item.stockMin || 0);
                return `
                    <div class="warehouse-item-row ${isLow ? 'warehouse-item-row--low' : ''}">
                        <div>
                            <p class="mb-0 text-sm font-semibold text-gray-900">${escapeHtml(item.name)}</p>
                            <div class="warehouse-item-meta">
                                ${item.partNumber ? `<span class="warehouse-item-badge">Parte ${escapeHtml(item.partNumber)}</span>` : ''}
                                <span class="warehouse-item-badge">${escapeHtml(item.itemType || '-')}</span>
                                <span class="warehouse-item-badge">Min ${escapeHtml(String(item.stockMin ?? 0))}</span>
                                ${isLow ? '<span class="warehouse-item-badge warehouse-item-badge--low">Bajo stock</span>' : ''}
                            </div>
                        </div>
                        <div class="text-end shrink-0">
                            <p class="mb-0 text-sm font-semibold text-gray-900">${escapeHtml(String(item.stockCurrent ?? 0))} ${escapeHtml(item.unit || '')}</p>
                            <p class="mb-0 text-xs text-gray-500">Existencia actual</p>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <article class="warehouse-summary-card">
                    <div class="warehouse-summary-card__header">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <h4 class="text-lg font-semibold text-gray-900 mb-1">${escapeHtml(warehouse.name || 'Bodega')}</h4>
                                <p class="mb-0 text-xs text-gray-600">${escapeHtml(warehouse.description || 'Sin descripcion registrada')}</p>
                            </div>
                            <span class="warehouse-summary-chip">${summary.roomCount || 0} habitaciones</span>
                        </div>
                    </div>
                    <div class="warehouse-summary-card__body">
                        <div class="warehouse-summary-stat-grid">
                            <div class="warehouse-summary-stat">
                                <p class="mb-1 text-xs text-gray-500 uppercase">Items</p>
                                <p class="mb-0 text-2xl font-bold text-gray-900">${summary.itemCount || 0}</p>
                            </div>
                            <div class="warehouse-summary-stat">
                                <p class="mb-1 text-xs text-gray-500 uppercase">Stock</p>
                                <p class="mb-0 text-2xl font-bold text-gray-900">${money(summary.totalStock || 0)}</p>
                            </div>
                            <div class="warehouse-summary-stat">
                                <p class="mb-1 text-xs text-gray-500 uppercase">Con BOM</p>
                                <p class="mb-0 text-2xl font-bold text-emerald-700">${summary.roomsWithBomCount || 0}</p>
                            </div>
                            <div class="warehouse-summary-stat">
                                <p class="mb-1 text-xs text-gray-500 uppercase">Bajo stock</p>
                                <p class="mb-0 text-2xl font-bold text-rose-700">${lowStockItems.length}</p>
                            </div>
                        </div>

                        <div class="mb-3">
                            <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Habitaciones</p>
                            <div class="warehouse-summary-chip-list">
                                ${roomChips || '<span class="text-sm text-gray-500">Sin habitaciones asignadas</span>'}
                            </div>
                        </div>

                        <div>
                            <div class="flex items-center justify-between gap-2 mb-2">
                                <p class="text-xs font-semibold text-gray-500 uppercase mb-0">Items de la bodega</p>
                                <span class="text-xs text-gray-500">${warehouseItems.length} registrados</span>
                            </div>
                            <div class="warehouse-item-list">
                                ${itemRows || '<div class="warehouse-summary-empty">Esta bodega aun no tiene items registrados.</div>'}
                            </div>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    };

    const sortAlphabetically = (items, getLabel) => {
        if (!Array.isArray(items)) return [];

        return [...items].sort((left, right) => String(getLabel(left) || '').localeCompare(
            String(getLabel(right) || ''),
            'es',
            { sensitivity: 'base', numeric: true }
        ));
    };

    const populateWarehouseSelect = (select, selectedWarehouseId = '') => {
        if (!select) return;

        select.innerHTML = [
            '<option value="">Selecciona bodega</option>',
            ...state.warehouses.map((warehouse) => `<option value="${warehouse._id}" ${String(selectedWarehouseId) === String(warehouse._id) ? 'selected' : ''}>${escapeHtml(warehouse.name)}</option>`)
        ].join('');
    };

    const populateWarehouseSelects = () => {
        populateWarehouseSelect(el.itemWarehouseSelect, el.itemWarehouseSelect?.value || '');
        populateWarehouseSelect(el.purchaseWarehouseSelect, el.purchaseWarehouseSelect?.value || '');
    };

    const populateRoomInventorySelectors = () => {
        const selectedRoomId = getSelectedRoomInventoryRoomId();
        populateRoomSelect(el.roomInventoryRoomSelect, selectedRoomId);
        populateRoomSelect(el.roomTransferRoomSelect, el.roomTransferRoomSelect?.value || selectedRoomId);
        populateRoomSelect(el.roomAdjustmentRoomSelect, el.roomAdjustmentRoomSelect?.value || selectedRoomId);
        state.selectedRoomInventoryId = String(el.roomInventoryRoomSelect?.value || selectedRoomId || '');
    };

    const populateRoomTransferItemSelect = (selectedItemId = '') => {
        if (!el.roomTransferItemSelect) return;

        el.roomTransferItemSelect.innerHTML = [
            '<option value="">Selecciona item</option>',
            ...state.roomInventoryTransferCandidates.map((item) => `<option value="${item._id}" ${String(selectedItemId) === String(item._id) ? 'selected' : ''}>${escapeHtml(item.name)} | ${escapeHtml(item.itemType)} | Bodega ${item.stockCurrent} ${escapeHtml(item.unit || '')}</option>`)
        ].join('');
    };

    const populateRoomAdjustmentItemSelect = (selectedItemId = '') => {
        if (!el.roomAdjustmentItemSelect) return;

        el.roomAdjustmentItemSelect.innerHTML = [
            '<option value="">Selecciona item</option>',
            ...state.roomInventoryEntries.map((entry) => `<option value="${entry.item?._id || ''}" ${String(selectedItemId) === String(entry.item?._id || '') ? 'selected' : ''}>${escapeHtml(entry.item?.name || 'Item')} | Habitacion ${entry.stockCurrent} ${escapeHtml(entry.item?.unit || '')}</option>`)
        ].join('');
    };

    const renderRoomInventorySummary = (warehouse) => {
        if (!el.roomInventorySummary) return;

        const totalItems = state.roomInventoryEntries.length;
        const totalUnits = state.roomInventoryEntries.reduce((sum, entry) => sum + Number(entry.stockCurrent || 0), 0);
        const lowStockCount = state.roomInventoryEntries.filter((entry) => Number(entry.stockCurrent || 0) <= Number(entry.item?.stockMin || 0)).length;

        el.roomInventorySummary.innerHTML = `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p class="text-xs uppercase text-gray-500 mb-1">Bodega fuente</p>
                <p class="text-base font-semibold text-gray-900 mb-0">${escapeHtml(warehouseDisplayName(warehouse))}</p>
            </div>
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p class="text-xs uppercase text-gray-500 mb-1">Items en habitacion</p>
                <p class="text-2xl font-bold text-gray-900 mb-0">${totalItems}</p>
            </div>
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p class="text-xs uppercase text-gray-500 mb-1">Unidades / bajo stock</p>
                <p class="text-2xl font-bold text-gray-900 mb-0">${money(totalUnits)} <span class="text-sm font-medium text-rose-600">| ${lowStockCount}</span></p>
            </div>
        `;
    };

    const renderRoomInventory = async () => {
        const roomId = getSelectedRoomInventoryRoomId();
        if (!roomId) {
            state.roomInventoryEntries = [];
            state.roomInventoryTransferCandidates = [];
            setRoomInventoryLoading(false);
            if (el.roomInventorySummary) el.roomInventorySummary.innerHTML = '';
            if (el.roomInventoryTableBody) {
                el.roomInventoryTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500">Selecciona una habitacion para consultar su inventario.</td></tr>';
            }
            populateRoomTransferItemSelect();
            populateRoomAdjustmentItemSelect();
            return;
        }

        setRoomInventoryLoading(true);
        try {
            const result = await request(`/room-inventory/${roomId}?itemType=${encodeURIComponent(state.selectedRoomInventoryType || 'all')}`);
            const payload = result.data || {};

            state.roomInventoryEntries = sortAlphabetically(payload.entries || [], (entry) => entry?.item?.name);
            state.roomInventoryTransferCandidates = sortAlphabetically(payload.transferCandidates || [], (entry) => entry?.name);

            renderRoomInventorySummary(payload.warehouse);
            populateRoomTransferItemSelect();
            populateRoomAdjustmentItemSelect();

            if (!el.roomInventoryTableBody) return;

            const rows = state.roomInventoryEntries.map((entry) => `
                <tr>
                    <td>${escapeHtml(entry.item?.name || '-')}</td>
                    <td>${escapeHtml(entry.item?.partNumber || '-')}</td>
                    <td>${escapeHtml(entry.item?.itemType || '-')}</td>
                    <td>${escapeHtml(entry.item?.unit || '-')}</td>
                    <td>${escapeHtml(String(entry.item?.stockCurrent ?? 0))}</td>
                    <td>${escapeHtml(String(entry.stockCurrent ?? 0))}</td>
                    <td>${escapeHtml(formatDateTime(entry.updatedAt))}</td>
                    <td>
                        ${canAdjustInventory ? `<button type="button" class="btn btn-outline-dark btn-sm" data-room-adjust-item="${entry.item?._id || ''}">Ajustar</button>` : '<span class="text-xs text-gray-400">Sin acciones</span>'}
                    </td>
                </tr>
            `).join('');

            el.roomInventoryTableBody.innerHTML = rows || '<tr><td colspan="8" class="text-center text-gray-500">La habitacion no tiene inventario cargado para este filtro.</td></tr>';
            el.roomInventoryTableBody.querySelectorAll('[data-room-adjust-item]').forEach((button) => {
                button.addEventListener('click', () => {
                    if (!el.roomAdjustmentRoomSelect) return;
                    el.roomAdjustmentRoomSelect.value = roomId;
                    populateRoomAdjustmentItemSelect(button.getAttribute('data-room-adjust-item'));
                    updateRoomAdjustmentHint();
                    showModal(el.modalRoomAdjustment);
                });
            });
        } catch (error) {
            state.roomInventoryEntries = [];
            state.roomInventoryTransferCandidates = [];
            if (el.roomInventorySummary) el.roomInventorySummary.innerHTML = '';
            populateRoomTransferItemSelect();
            populateRoomAdjustmentItemSelect();
            if (el.roomInventoryTableBody) {
                el.roomInventoryTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500">${escapeHtml(error.message || 'No se pudo cargar el inventario de la habitacion.')}</td></tr>`;
            }
        } finally {
            setRoomInventoryLoading(false);
        }
    };

    const getSelectedPurchaseWarehouseId = () => String(el.purchaseWarehouseSelect?.value || '');

    const getSelectedBomWarehouseId = () => {
        const selectedRoomIds = getCheckedRooms('.bom-room-checkbox').map((room) => String(room.id));
        if (selectedRoomIds.length === 0) {
            return '';
        }

        const selectedWarehouseIds = [...new Set(state.warehouses.filter((warehouse) => {
            const cabinIds = (warehouse.cabins || []).map((room) => String(room._id || room));
            return selectedRoomIds.some((roomId) => cabinIds.includes(roomId));
        }).map((warehouse) => String(warehouse._id)))];

        return selectedWarehouseIds.length === 1 ? selectedWarehouseIds[0] : '';
    };

    const normalizeSearchText = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const getBootstrapModal = (element) => {
        if (!element || !window.bootstrap?.Modal) return null;
        return window.bootstrap.Modal.getOrCreateInstance(element);
    };

    const showModal = (element) => {
        getBootstrapModal(element)?.show();
    };

    const hideModal = (element) => {
        getBootstrapModal(element)?.hide();
    };

    const destroyDashboardChart = (chartKey) => {
        if (dashboardCharts[chartKey]) {
            dashboardCharts[chartKey].destroy();
            dashboardCharts[chartKey] = null;
        }
    };

    const buildChartFallback = (canvas, message) => {
        const container = canvas?.parentElement;
        if (!container) return;
        container.innerHTML = `<div class="h-full w-full flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 text-center p-4">${escapeHtml(message)}</div>`;
    };

    const renderStockByCabinChart = (stockByCabin) => {
        destroyDashboardChart('stockByCabin');

        if (!el.stockByCabinChart) return;
        if (typeof window.Chart !== 'function') {
            buildChartFallback(el.stockByCabinChart, 'No se pudo cargar la grafica de stock por ubicacion.');
            return;
        }

        const entries = Object.entries(stockByCabin)
            .map(([cabinName, values]) => ({
                cabinName,
                stockUnits: Number(values.stockUnits || 0),
                items: Number(values.items || 0)
            }))
            .sort((left, right) => right.stockUnits - left.stockUnits)
            .slice(0, 8);

        if (entries.length === 0) {
            buildChartFallback(el.stockByCabinChart, 'Sin informacion suficiente para la grafica.');
            return;
        }

        dashboardCharts.stockByCabin = new window.Chart(el.stockByCabinChart, {
            type: 'bar',
            data: {
                labels: entries.map((entry) => entry.cabinName.length > 26 ? `${entry.cabinName.slice(0, 26)}...` : entry.cabinName),
                datasets: [{
                    label: 'Unidades',
                    data: entries.map((entry) => entry.stockUnits),
                    borderRadius: 8,
                    borderSkipped: false,
                    backgroundColor: entries.map((_, index) => chartPalette[index % chartPalette.length])
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${money(context.parsed.x)} unidades`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => money(value)
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.18)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#475569',
                            font: { size: 11 }
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    };

    const renderStockHealthChart = (totalItems, lowStockCount) => {
        destroyDashboardChart('stockHealth');

        if (!el.stockHealthChart) return;
        if (typeof window.Chart !== 'function') {
            buildChartFallback(el.stockHealthChart, 'No se pudo cargar la grafica de salud del inventario.');
            return;
        }

        const healthyItems = Math.max(Number(totalItems || 0) - Number(lowStockCount || 0), 0);
        const chartValues = totalItems > 0 ? [healthyItems, Number(lowStockCount || 0)] : [1];
        const chartLabels = totalItems > 0 ? ['Stock saludable', 'Bajo stock'] : ['Sin datos'];
        const chartColors = totalItems > 0 ? ['#0F766E', '#DC2626'] : ['#CBD5E1'];

        dashboardCharts.stockHealth = new window.Chart(el.stockHealthChart, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartValues,
                    backgroundColor: chartColors,
                    borderColor: '#FFFFFF',
                    borderWidth: 4,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 16,
                            color: '#475569'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.label}: ${context.parsed}`
                        }
                    }
                }
            }
        });
    };

    const populateAdjustmentItemSelect = () => {
        if (!el.adjustmentItemSelect) return;
        el.adjustmentItemSelect.innerHTML = [
            '<option value="">Selecciona item</option>',
            ...state.items.map((item) => `<option value="${item._id}">${escapeHtml(item.name)} | ${escapeHtml(warehouseDisplayName(item.warehouse))} | Stock ${item.stockCurrent} ${escapeHtml(item.unit)}</option>`)
        ].join('');
    };

    const createChecklistOption = ({ checkboxClass, value, title, helper }) => {
        const optionCard = document.createElement('label');
        optionCard.className = 'room-option-card flex items-center gap-2 cursor-pointer';
        optionCard.dataset.filterLabel = normalizeSearchText(`${title} ${helper || ''}`);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = checkboxClass;
        checkbox.value = value;

        const copyWrapper = document.createElement('div');

        const titleNode = document.createElement('p');
        titleNode.className = 'mb-0 text-sm font-medium text-gray-800';
        titleNode.textContent = title;
        copyWrapper.appendChild(titleNode);

        if (helper) {
            const helperNode = document.createElement('p');
            helperNode.className = 'mb-0 text-xs text-gray-500';
            helperNode.textContent = helper;
            copyWrapper.appendChild(helperNode);
        }

        optionCard.appendChild(checkbox);
        optionCard.appendChild(copyWrapper);
        return optionCard;
    };

    const renderRoomChecklist = (container, checkboxClass, helperText, includeGlobal = false) => {
        if (!container) return;

        container.innerHTML = '';

        if (includeGlobal) {
            container.appendChild(createChecklistOption({
                checkboxClass,
                value: 'GLOBAL',
                title: '🏭 Bodega Global',
                helper: 'Stock centralizado, sin habitacion especifica'
            }));
        }

        if (!Array.isArray(state.rooms) || state.rooms.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No hay habitaciones disponibles.</p>';
            return;
        }

        state.rooms.forEach((room) => {
            container.appendChild(createChecklistOption({
                checkboxClass,
                value: room._id,
                title: roomDisplayName(room),
                helper: helperText
            }));
        });
    };

    const applyChecklistFilter = (input, container) => {
        if (!container) return;
        const query = normalizeSearchText(input?.value || '');
        container.querySelectorAll('.room-option-card').forEach((optionCard) => {
            const label = optionCard.dataset.filterLabel || normalizeSearchText(optionCard.textContent || '');
            optionCard.classList.toggle('hidden', Boolean(query) && !label.includes(query));
        });
    };

    const resetChecklistFilter = (input, container) => {
        if (!input) return;
        input.value = '';
        applyChecklistFilter(input, container);
    };

    const setupChecklistFilter = (input, container) => {
        if (!input || !container) return;
        const handleFilter = () => applyChecklistFilter(input, container);
        input.addEventListener('input', handleFilter);
        input.addEventListener('change', handleFilter);
        input.addEventListener('search', handleFilter);
    };

    const setCheckedRooms = (selector, roomIds) => {
        const selectedIds = new Set((roomIds || []).map(String));
        document.querySelectorAll(selector).forEach((checkbox) => {
            checkbox.checked = selectedIds.has(String(checkbox.value));
        });
    };

    const setBOMRoomSelectionLocked = (locked) => {
        state.bomRoomSelectionLocked = Boolean(locked);
        document.querySelectorAll('.bom-room-checkbox').forEach((checkbox) => {
            checkbox.disabled = state.bomRoomSelectionLocked;
        });
        if (el.bomRoomFilter) {
            el.bomRoomFilter.disabled = state.bomRoomSelectionLocked;
        }
    };

    const getCheckedRooms = (selector) => {
        return Array.from(document.querySelectorAll(`${selector}:checked`)).map((checkbox) => ({ id: checkbox.value }));
    };

    const createBomLineRow = () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'bom-line-row';
        const selectedWarehouseId = getSelectedBomWarehouseId();
        const itemOptions = [
            '<option value="">Producto</option>',
            ...state.items
                .filter((item) => String(item.warehouse?._id || item.warehouse || '') === selectedWarehouseId)
                .map((item) => `<option value="${item._id}">${escapeHtml(item.name)} (${escapeHtml(item.unit)})</option>`)
        ].join('');

        wrapper.innerHTML = `
            <select class="form-select bom-line-item">${itemOptions}</select>
            <input type="number" min="0" step="0.01" class="form-control bom-line-qty" placeholder="Cantidad base por noche">
            <input type="number" min="0" step="0.01" class="form-control bom-line-factor" placeholder="Factor (1 normal)" value="1" aria-label="Factor de uso (valor por defecto 1)">
            <button type="button" class="btn btn-outline-danger btn-sm bom-line-remove">Quitar</button>
        `;

        wrapper.querySelector('.bom-line-remove')?.addEventListener('click', () => {
            wrapper.remove();
        });

        return wrapper;
    };

    const buildPurchaseItemOptions = (selectedItemId = '') => {
        const selectedWarehouseId = getSelectedPurchaseWarehouseId();
        const items = state.items.filter((item) => String(item.warehouse?._id || item.warehouse || '') === selectedWarehouseId);
        return [
            '<option value="">Item</option>',
            ...items.map((item) => `<option value="${item._id}" ${String(selectedItemId) === String(item._id) ? 'selected' : ''}>${escapeHtml(item.name)} (${escapeHtml(item.unit)})</option>`)
        ].join('');
    };

    const createPurchaseLineRow = (line = {}) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'purchase-line-row';
        wrapper.innerHTML = `
            <select class="form-select purchase-line-item">${buildPurchaseItemOptions(line.item?._id || line.item || '')}</select>
            <input type="number" min="0.01" step="0.01" class="form-control purchase-line-qty" placeholder="Cantidad" value="${line.quantity ?? ''}">
            <input type="number" min="0" step="0.01" class="form-control purchase-line-cost" placeholder="Costo unitario" value="${line.unitCost ?? ''}">
            <button type="button" class="btn btn-outline-danger btn-sm purchase-line-remove">Quitar</button>
        `;
        wrapper.querySelector('.purchase-line-remove')?.addEventListener('click', () => {
            wrapper.remove();
            ensureOnePurchaseLine();
        });
        return wrapper;
    };

    const ensureOnePurchaseLine = () => {
        if (!el.purchaseLinesContainer) return;
        if (el.purchaseLinesContainer.children.length === 0) {
            el.purchaseLinesContainer.appendChild(createPurchaseLineRow());
        }
    };

    const syncPurchaseLineOptions = () => {
        if (!el.purchaseLinesContainer) return;
        Array.from(el.purchaseLinesContainer.children).forEach((row) => {
            const select = row.querySelector('.purchase-line-item');
            if (!select) return;
            const previousValue = select.value;
            select.innerHTML = buildPurchaseItemOptions(previousValue);
            if (!Array.from(select.options).some((option) => option.value === previousValue)) {
                select.value = '';
            }
        });
    };

    const syncBomLineOptions = () => {
        if (!el.bomLinesContainer) return;
        Array.from(el.bomLinesContainer.children).forEach((row) => {
            const select = row.querySelector('.bom-line-item');
            if (!select) return;
            const previousValue = select.value;
            const selectedWarehouseId = getSelectedBomWarehouseId();
            select.innerHTML = [
                '<option value="">Producto</option>',
                ...state.items
                    .filter((item) => String(item.warehouse?._id || item.warehouse || '') === selectedWarehouseId)
                    .map((item) => `<option value="${item._id}">${escapeHtml(item.name)} (${escapeHtml(item.unit)})</option>`)
            ].join('');
            if (Array.from(select.options).some((option) => option.value === previousValue)) {
                select.value = previousValue;
            }
        });
    };

    const getPurchaseLinesPayload = () => {
        if (!el.purchaseLinesContainer) return [];
        return Array.from(el.purchaseLinesContainer.children).map((row) => ({
            item: row.querySelector('.purchase-line-item')?.value,
            quantity: Number(row.querySelector('.purchase-line-qty')?.value || 0),
            unitCost: Number(row.querySelector('.purchase-line-cost')?.value || 0)
        })).filter((line) => line.item && line.quantity > 0);
    };

    const ensureOneBomLine = () => {
        if (!el.bomLinesContainer) return;
        if (el.bomLinesContainer.children.length === 0) {
            el.bomLinesContainer.appendChild(createBomLineRow());
        }
    };

    const getBomLinesPayload = () => {
        if (!el.bomLinesContainer) return [];
        return Array.from(el.bomLinesContainer.children).map((row) => {
            const item = row.querySelector('.bom-line-item')?.value;
            const quantityPerNight = Number(row.querySelector('.bom-line-qty')?.value || 0);
            const useFactor = Number(row.querySelector('.bom-line-factor')?.value || 1);
            return { item, quantityPerNight, useFactor };
        }).filter((line) => line.item && line.quantityPerNight > 0);
    };

    const setBomLines = (lines) => {
        if (!el.bomLinesContainer) return;
        el.bomLinesContainer.innerHTML = '';
        (lines || []).forEach((line) => {
            const row = createBomLineRow();
            row.querySelector('.bom-line-item').value = line.item?._id || line.item || '';
            row.querySelector('.bom-line-qty').value = line.quantityPerNight ?? '';
            row.querySelector('.bom-line-factor').value = line.useFactor ?? 1;
            el.bomLinesContainer.appendChild(row);
        });
        ensureOneBomLine();
    };

    const toggleItemUnitCustom = () => {
        if (!el.itemUnitSelect || !el.itemUnitCustom) return;
        const isCustom = el.itemUnitSelect.value === 'otra';
        el.itemUnitCustom.classList.toggle('hidden', !isCustom);
        el.itemUnitCustom.required = isCustom;
        if (!isCustom) {
            el.itemUnitCustom.value = '';
        }
    };

    const toggleInitialPurchaseSection = () => {
        if (!el.itemInitialPurchaseSection) return;
        el.itemInitialPurchaseSection.classList.toggle('hidden', Boolean(state.editingItemId));
    };

    const resetItemFormMode = () => {
        state.editingItemId = null;
        el.formItem?.reset();
        if (el.modalItemTitle) el.modalItemTitle.textContent = 'Nuevo Item';
        if (el.modalItemSubmit) el.modalItemSubmit.textContent = 'Guardar';
        populateWarehouseSelect(el.itemWarehouseSelect);
        toggleItemUnitCustom();
        toggleInitialPurchaseSection();
    };

    const resetPurchaseFormMode = () => {
        el.formPurchase?.reset();
        populateWarehouseSelect(el.purchaseWarehouseSelect);
        if (el.purchaseLinesContainer) {
            el.purchaseLinesContainer.innerHTML = '';
        }
        ensureOnePurchaseLine();
        syncPurchaseLineOptions();
    };

    const resetAdjustmentFormMode = () => {
        el.formAdjustment?.reset();
    };

    const updateRoomTransferHint = () => {
        if (!el.roomTransferStockHint) return;
        const selectedItem = state.roomInventoryTransferCandidates.find((item) => String(item._id) === String(el.roomTransferItemSelect?.value || ''));
        el.roomTransferStockHint.textContent = selectedItem
            ? `Disponible en bodega: ${selectedItem.stockCurrent} ${selectedItem.unit || ''}`
            : 'Selecciona un item para ver el stock disponible en bodega.';
    };

    const updateRoomAdjustmentHint = () => {
        if (!el.roomAdjustmentStockHint) return;
        const selectedEntry = state.roomInventoryEntries.find((entry) => String(entry.item?._id || '') === String(el.roomAdjustmentItemSelect?.value || ''));
        el.roomAdjustmentStockHint.textContent = selectedEntry
            ? `Disponible en habitacion: ${selectedEntry.stockCurrent} ${selectedEntry.item?.unit || ''}`
            : 'Selecciona un item para ver el stock actual en habitacion.';
    };

    const resetRoomTransferFormMode = () => {
        el.formRoomTransfer?.reset();
        populateRoomSelect(el.roomTransferRoomSelect, getSelectedRoomInventoryRoomId());
        populateRoomTransferItemSelect();
        updateRoomTransferHint();
    };

    const resetRoomAdjustmentFormMode = () => {
        el.formRoomAdjustment?.reset();
        populateRoomSelect(el.roomAdjustmentRoomSelect, getSelectedRoomInventoryRoomId());
        populateRoomAdjustmentItemSelect();
        updateRoomAdjustmentHint();
    };

    const resetBOMFormMode = () => {
        state.editingBOMId = null;
        el.formBOMTemplate?.reset();
        if (el.modalBOMTitle) el.modalBOMTitle.textContent = 'Nueva Regla de Consumo BOM';
        if (el.modalBOMSubmit) el.modalBOMSubmit.textContent = 'Guardar BOM';
        if (el.bomEffectiveFrom) el.bomEffectiveFrom.value = getMexicoCityNowForInput();
        setBOMRoomSelectionLocked(false);
        setCheckedRooms('.bom-room-checkbox', []);
        resetChecklistFilter(el.bomRoomFilter, el.bomRoomChecklist);
        setBomLines([]);
    };

    const resetWarehouseFormMode = () => {
        state.editingWarehouseId = null;
        el.formWarehouse?.reset();
        setCheckedRooms('.warehouse-room-checkbox', []);
        resetChecklistFilter(el.warehouseRoomFilter, el.warehouseRoomChecklist);
        if (el.modalWarehouseTitle) el.modalWarehouseTitle.textContent = 'Nueva Bodega';
        if (el.modalWarehouseSubmit) el.modalWarehouseSubmit.textContent = 'Guardar';
    };

    const setupTabs = () => {
        el.tabs.forEach((button) => {
            button.addEventListener('click', () => {
                const tab = button.getAttribute('data-tab');
                el.tabs.forEach((btn) => btn.classList.remove('active', 'border-teal-500', 'text-teal-600'));
                button.classList.add('active', 'border-teal-500', 'text-teal-600');
                el.tabContents.forEach((content) => {
                    content.classList.add('hidden');
                    content.classList.remove('active');
                });
                const target = document.getElementById(`inventory-tab-${tab}`);
                if (target) {
                    target.classList.remove('hidden');
                    target.classList.add('active');
                }
            });
        });
    };

    const renderDashboard = async () => {
        if (!canViewInventoryDashboard) return;
        const result = await request('/dashboard/stock');
        const data = result.data || {};
        const stockByCabin = data.stockByCabin || {};
        const lowStockItems = data.lowStockItems || [];

        if (el.totalItems) el.totalItems.textContent = data.totalItems || 0;
        if (el.lowStock) el.lowStock.textContent = data.lowStockCount || 0;
        if (el.roomCount) el.roomCount.textContent = Object.keys(stockByCabin).length;

        const totalUnits = Object.values(stockByCabin).reduce((sum, cabin) => sum + Number(cabin.stockUnits || 0), 0);
        if (el.totalUnits) el.totalUnits.textContent = money(totalUnits);

        renderStockByCabinChart(stockByCabin);
        renderStockHealthChart(data.totalItems || 0, data.lowStockCount || 0);

        if (el.stockByCabin) {
            el.stockByCabin.innerHTML = Object.entries(stockByCabin).map(([cabinName, values]) => `
                <div class="flex items-center justify-between bg-gray-100 rounded p-2">
                    <span class="font-medium text-gray-700">${escapeHtml(cabinName)}</span>
                    <span class="text-sm text-gray-600">Items: ${values.items} | Unidades: ${money(values.stockUnits)}</span>
                </div>
            `).join('') || '<p class="text-gray-500">Sin informacion de stock.</p>';
        }

        if (el.criticalItems) {
            el.criticalItems.innerHTML = lowStockItems.map((item) => `
                <div class="border border-red-200 bg-red-50 rounded p-2">
                    <p class="font-semibold text-red-700">${escapeHtml(item.name)}</p>
                    <p class="text-xs text-red-600">Stock ${item.stockCurrent} / Min ${item.stockMin} | ${escapeHtml(item.unit)}</p>
                    <p class="text-xs text-red-500 mt-1">Bodega: ${escapeHtml(warehouseDisplayName(item.warehouse))}</p>
                </div>
            `).join('') || '<p class="text-gray-500">No hay items en bajo stock.</p>';
        }
    };

    const renderItems = async () => {
        const result = await request('/items');
        state.items = sortAlphabetically(result.data || [], (item) => item?.name);
        populateAdjustmentItemSelect();
        syncPurchaseLineOptions();
        const rows = state.items.map((item) => `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.partNumber || '-')}</td>
                <td>${escapeHtml(item.itemType)}</td>
                <td>${escapeHtml(item.unit)}</td>
                <td>${item.stockCurrent}</td>
                <td>${item.stockMin}</td>
                <td>${escapeHtml(warehouseDisplayName(item.warehouse))}</td>
                <td>
                    ${canManageInventory ? `
                        <div class="flex gap-2">
                            <button type="button" class="btn btn-outline-primary btn-sm" data-edit-item="${item._id}">Editar</button>
                            <button type="button" class="btn btn-outline-danger btn-sm" data-delete-item="${item._id}">Eliminar</button>
                        </div>
                    ` : '<span class="text-xs text-gray-400">Sin acciones</span>'}
                </td>
            </tr>
        `).join('');

        if (el.itemsTableBody) {
            el.itemsTableBody.innerHTML = rows || '<tr><td colspan="8" class="text-center text-gray-500">Sin items</td></tr>';
            el.itemsTableBody.querySelectorAll('[data-edit-item]').forEach((button) => {
                button.addEventListener('click', () => {
                    const item = state.items.find((entry) => String(entry._id) === button.getAttribute('data-edit-item'));
                    if (!item || !el.formItem) return;
                    state.editingItemId = item._id;
                    if (el.modalItemTitle) el.modalItemTitle.textContent = `Editar Item: ${item.name}`;
                    if (el.modalItemSubmit) el.modalItemSubmit.textContent = 'Actualizar';
                    el.formItem.elements.name.value = item.name || '';
                    el.formItem.elements.partNumber.value = item.partNumber || '';
                    el.formItem.elements.description.value = item.description || '';
                    el.formItem.elements.itemType.value = item.itemType || 'directo';
                    const unitOptionExists = Array.from(el.itemUnitSelect?.options || []).some((option) => option.value === item.unit);
                    if (el.itemUnitSelect) el.itemUnitSelect.value = unitOptionExists ? item.unit : 'otra';
                    if (el.itemUnitCustom) el.itemUnitCustom.value = unitOptionExists ? '' : (item.unit || '');
                    if (el.itemWarehouseSelect) {
                        populateWarehouseSelect(el.itemWarehouseSelect, item.warehouse?._id || item.warehouse || '');
                    }
                    el.formItem.elements.stockCurrent.value = item.stockCurrent ?? 0;
                    el.formItem.elements.stockMin.value = item.stockMin ?? 0;
                    if (el.formItem.elements.initialUnitCost) el.formItem.elements.initialUnitCost.value = '';
                    if (el.formItem.elements.initialSupplier) el.formItem.elements.initialSupplier.value = '';
                    if (el.formItem.elements.initialInvoiceNumber) el.formItem.elements.initialInvoiceNumber.value = '';
                    if (el.formItem.elements.initialPurchaseDate) el.formItem.elements.initialPurchaseDate.value = '';
                    toggleItemUnitCustom();
                    toggleInitialPurchaseSection();
                    showModal(el.modalItem);
                });
            });
            el.itemsTableBody.querySelectorAll('[data-delete-item]').forEach((button) => {
                button.addEventListener('click', async () => {
                    try {
                        const confirmed = await confirmAction({
                            title: 'Eliminar item',
                            text: 'Se eliminara el item seleccionado. Esta accion no se puede deshacer.',
                            confirmButtonText: 'Si, eliminar'
                        });
                        if (!confirmed) return;

                        await runBusyAction({
                            target: button,
                            busyText: 'Eliminando...',
                            loadingTitle: 'Eliminando item',
                            loadingText: 'Estamos actualizando el inventario.',
                            successTitle: 'Item eliminado',
                            successMessage: 'Item eliminado correctamente',
                            action: async () => {
                                await request(`/items/${button.getAttribute('data-delete-item')}`, { method: 'DELETE' });
                                await Promise.all([renderItems(), renderDashboard(), renderWarehouseSummary()]);
                            }
                        });
                    } catch (error) {
                        await showError(error);
                    }
                });
            });
        }

        if (el.bomLinesContainer) {
            const existingRows = Array.from(el.bomLinesContainer.children);
            const oldValues = existingRows.map((row) => ({
                item: row.querySelector('.bom-line-item')?.value,
                qty: row.querySelector('.bom-line-qty')?.value,
                factor: row.querySelector('.bom-line-factor')?.value
            }));
            el.bomLinesContainer.innerHTML = '';
            oldValues.forEach((value) => {
                const row = createBomLineRow();
                row.querySelector('.bom-line-item').value = value.item || '';
                row.querySelector('.bom-line-qty').value = value.qty || '';
                row.querySelector('.bom-line-factor').value = value.factor || '1';
                el.bomLinesContainer.appendChild(row);
            });
            ensureOneBomLine();
            syncBomLineOptions();
        }
    };

    const renderWarehouses = async () => {
        const result = await request('/warehouses');
        state.warehouses = sortAlphabetically(result.data || [], (warehouse) => warehouse?.name);
        populateWarehouseSelects();
        populateRoomInventorySelectors();
        syncPurchaseLineOptions();
        syncBomLineOptions();
        if (el.warehousesList) {
            el.warehousesList.innerHTML = state.warehouses.map((warehouse) => `
                <div class="border border-gray-200 rounded-lg p-3">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <h4 class="font-semibold text-gray-800">${escapeHtml(warehouse.name)}</h4>
                            <p class="text-xs text-gray-500 mt-1">${escapeHtml(warehouse.description || 'Sin descripcion')}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs px-2 py-1 rounded bg-sky-100 text-sky-700">${(warehouse.cabins || []).length} habitaciones</span>
                            ${canManageInventory ? `<button type="button" class="btn btn-outline-primary btn-sm" data-edit-warehouse="${warehouse._id}">Editar</button><button type="button" class="btn btn-outline-danger btn-sm" data-delete-warehouse="${warehouse._id}">Desactivar</button>` : ''}
                        </div>
                    </div>
                    <p class="text-sm text-gray-700 mt-3">${(warehouse.cabins || []).map((room) => escapeHtml(roomDisplayName(room))).join(', ') || 'Sin habitaciones asignadas'}</p>
                </div>
            `).join('') || '<p class="text-gray-500">No hay bodegas registradas.</p>';

            el.warehousesList.querySelectorAll('[data-edit-warehouse]').forEach((button) => {
                button.addEventListener('click', () => {
                    const warehouse = state.warehouses.find((entry) => String(entry._id) === button.getAttribute('data-edit-warehouse'));
                    if (!warehouse || !el.formWarehouse) return;
                    state.editingWarehouseId = warehouse._id;
                    if (el.modalWarehouseTitle) el.modalWarehouseTitle.textContent = `Editar Bodega: ${warehouse.name}`;
                    if (el.modalWarehouseSubmit) el.modalWarehouseSubmit.textContent = 'Actualizar';
                    el.formWarehouse.elements.name.value = warehouse.name || '';
                    el.formWarehouse.elements.description.value = warehouse.description || '';
                    setCheckedRooms('.warehouse-room-checkbox', (warehouse.cabins || []).map((room) => room._id || room));
                    showModal(el.modalWarehouse);
                });
            });

            el.warehousesList.querySelectorAll('[data-delete-warehouse]').forEach((button) => {
                button.addEventListener('click', async () => {
                    try {
                        const confirmed = await confirmAction({
                            title: 'Desactivar bodega',
                            text: 'La bodega se desactivara y sus habitaciones podran reasignarse a otra bodega activa.',
                            confirmButtonText: 'Si, desactivar'
                        });
                        if (!confirmed) return;

                        await runBusyAction({
                            target: button,
                            busyText: 'Desactivando...',
                            loadingTitle: 'Desactivando bodega',
                            loadingText: 'Actualizando asignacion operativa.',
                            successTitle: 'Bodega desactivada',
                            successMessage: 'Bodega desactivada correctamente',
                            action: async () => {
                                await request(`/warehouses/${button.getAttribute('data-delete-warehouse')}`, { method: 'DELETE' });
                                await Promise.all([renderWarehouses(), renderWarehouseSummary()]);
                            }
                        });
                    } catch (error) {
                        await showError(error);
                    }
                });
            });
        }
    };

    const renderPurchases = async () => {
        const result = await request('/purchases?limit=100');
        state.purchases = result.data || [];
        if (el.purchasesTableBody) {
            el.purchasesTableBody.innerHTML = state.purchases.map((purchase) => {
                const lineSummary = (purchase.lines || []).map((line) => `${escapeHtml(line.item?.name || 'Item')}: ${line.quantity} x ${money(line.unitCost)}`).join('<br>');
                return `
                    <tr>
                        <td>${escapeHtml(formatDateTime(purchase.purchaseDate))}</td>
                        <td>${escapeHtml(warehouseDisplayName(purchase.warehouse))}</td>
                        <td>${escapeHtml(purchase.supplier || '-')}</td>
                        <td>${escapeHtml(purchase.invoiceNumber || '-')}</td>
                        <td>${lineSummary || '-'}</td>
                        <td>${money(purchase.totalAmount)}</td>
                    </tr>
                `;
            }).join('') || '<tr><td colspan="6" class="text-center text-gray-500">Sin compras registradas</td></tr>';
        }
    };

    const renderMovements = async () => {
        const result = await request('/movements?limit=100');
        state.movements = result.data || [];
        if (el.movementsTableBody) {
            el.movementsTableBody.innerHTML = state.movements.map((movement) => `
                <tr>
                    <td>${escapeHtml(formatDateTime(movement.createdAt))}</td>
                    <td>${escapeHtml(movementTypeLabel(movement.movementType))}</td>
                    <td>${escapeHtml(movement.item?.name || '-')}</td>
                    <td>${escapeHtml(movementLocationLabel(movement))}</td>
                    <td>${movement.quantity}</td>
                    <td>${money(movement.totalCost || 0)}</td>
                    <td>${movement.stockBefore ?? '-'}</td>
                    <td>${movement.stockAfter ?? '-'}</td>
                    <td>${escapeHtml(formatMovementNote(movement.note))}</td>
                </tr>
            `).join('') || '<tr><td colspan="9" class="text-center text-gray-500">Sin movimientos registrados</td></tr>';
        }
    };

    const renderBOM = async () => {
        const result = await request('/bom-templates?active=true');
        state.bomTemplates = result.data || [];
        if (el.bomList) {
            el.bomList.innerHTML = state.bomTemplates.map((template) => {
                const lines = (template.lines || []).map((line) => `${escapeHtml(line.item?.name || 'Item')}: ${line.quantityPerNight} x factor ${line.useFactor || 1}`).join('<br>');
                return `
                    <div class="border border-gray-200 rounded-lg p-3">
                        <div class="flex items-center justify-between">
                            <h4 class="font-semibold text-gray-800">${escapeHtml(template.name)}</h4>
                            <div class="flex items-center gap-2">
                                <span class="text-xs px-2 py-1 rounded bg-teal-100 text-teal-700">Habitacion</span>
                                ${canManageInventory ? `<button type="button" class="btn btn-outline-primary btn-sm" data-edit-bom="${template._id}">Editar</button>` : ''}
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Habitacion: ${escapeHtml(roomDisplayName(template.cabin))}</p>
                        <p class="text-xs text-gray-500 mt-1">Vigente desde: ${escapeHtml(formatDateTime(template.effectiveFrom))}</p>
                        <p class="text-sm text-gray-700 mt-2">${lines || 'Sin lineas'}</p>
                    </div>
                `;
            }).join('') || '<p class="text-gray-500">No hay plantillas BOM.</p>';

            el.bomList.querySelectorAll('[data-edit-bom]').forEach((button) => {
                button.addEventListener('click', () => {
                    const template = state.bomTemplates.find((entry) => String(entry._id) === button.getAttribute('data-edit-bom'));
                    if (!template || !el.formBOMTemplate) return;
                    state.editingBOMId = template._id;
                    if (el.modalBOMTitle) el.modalBOMTitle.textContent = `Editar BOM: ${template.name}`;
                    if (el.modalBOMSubmit) el.modalBOMSubmit.textContent = 'Actualizar BOM';
                    el.formBOMTemplate.elements.name.value = template.name || '';
                    if (el.bomEffectiveFrom) el.bomEffectiveFrom.value = formatDateTimeLocalInput(template.effectiveFrom);
                    setBOMRoomSelectionLocked(true);
                    setCheckedRooms('.bom-room-checkbox', [template.cabin?._id || template.cabin].filter(Boolean));
                    setBomLines(template.lines || []);
                    showModal(el.modalBOMTemplate);
                });
            });
        }
    };

    const renderAlerts = async () => {
        const result = await request('/alerts?status=open');
        if (el.alertsList) {
            el.alertsList.innerHTML = (result.data || []).map((alertItem) => `
                <div class="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                    <div class="flex items-center justify-between gap-2">
                        <p class="font-semibold text-yellow-800">${escapeHtml(alertItem.alertType)}</p>
                        ${canManageInventory ? `<button class="btn btn-sm btn-outline-success" data-resolve-alert="${alertItem._id}">Resolver</button>` : ''}
                    </div>
                    <p class="text-sm text-yellow-700 mt-2">${escapeHtml(alertItem.message)}</p>
                    <p class="text-xs text-yellow-600 mt-1">Item: ${escapeHtml(alertItem.item?.name || '-')} | Bodega: ${escapeHtml(warehouseDisplayName(alertItem.warehouse))}</p>
                </div>
            `).join('') || '<p class="text-gray-500">Sin alertas abiertas.</p>';

            el.alertsList.querySelectorAll('[data-resolve-alert]').forEach((button) => {
                button.addEventListener('click', async () => {
                    try {
                        await runBusyAction({
                            target: button,
                            busyText: 'Resolviendo...',
                            loadingTitle: 'Resolviendo alerta',
                            loadingText: 'Actualizando estado del inventario.',
                            successTitle: 'Alerta resuelta',
                            successMessage: 'La alerta fue resuelta correctamente',
                            action: async () => {
                                await request(`/alerts/${button.getAttribute('data-resolve-alert')}/resolve`, { method: 'PUT' });
                                await Promise.all([renderAlerts(), renderDashboard()]);
                            }
                        });
                    } catch (error) {
                        await showError(error);
                    }
                });
            });
        }
    };

    const renderWarehouseSummary = async () => {
        if (!canViewInventoryDashboard) return;
        const [warehousesResult, itemsResult] = await Promise.all([
            request('/warehouses'),
            request('/items')
        ]);

        state.warehouses = sortAlphabetically(warehousesResult.data || [], (warehouse) => warehouse?.name);
        state.items = sortAlphabetically(itemsResult.data || [], (item) => item?.name);
        populateWarehouseSelects();

        const summaries = await Promise.all(state.warehouses.map(async (warehouse) => {
            try {
                const result = await request(`/warehouses/${warehouse._id}/summary`);
                return result.data;
            } catch (error) {
                return null;
            }
        }));

        const validSummaries = summaries.filter(Boolean);
        const totalWarehouses = validSummaries.length;
        const totalItems = validSummaries.reduce((sum, summary) => sum + Number(summary.itemCount || 0), 0);
        const totalStock = validSummaries.reduce((sum, summary) => sum + Number(summary.totalStock || 0), 0);
        const lowStockCount = validSummaries.reduce((sum, summary) => sum + Number(summary.lowStockCount || 0), 0);

        if (el.warehouseSummaryTotalWarehouses) el.warehouseSummaryTotalWarehouses.textContent = totalWarehouses;
        if (el.warehouseSummaryTotalItems) el.warehouseSummaryTotalItems.textContent = totalItems;
        if (el.warehouseSummaryTotalStock) el.warehouseSummaryTotalStock.textContent = money(totalStock);
        if (el.warehouseSummaryLowStock) el.warehouseSummaryLowStock.textContent = lowStockCount;

        buildWarehouseVisualCards(validSummaries, state.items);

        const rows = validSummaries.map((summary) => `
            <tr>
                <td>${escapeHtml(summary.warehouse?.name || '-')}</td>
                <td>${summary.roomCount || 0}</td>
                <td>${summary.itemCount || 0}</td>
                <td>${money(summary.totalStock || 0)}</td>
                <td>${summary.roomsWithBomCount || 0}</td>
                <td>${summary.roomsWithoutBomCount || 0}</td>
            </tr>
        `).join('');

        if (el.warehouseSummaryTableBody) {
            el.warehouseSummaryTableBody.innerHTML = rows || '<tr><td colspan="6" class="text-center text-gray-500">Sin bodegas</td></tr>';
        }
    };

    const loadRooms = async () => {
        const response = await fetch('/api/habitaciones');
        if (!response.ok) {
            throw new Error('No se pudieron cargar las habitaciones');
        }
        const rooms = await response.json();
        state.rooms = sortAlphabetically(rooms, (room) => roomDisplayName(room));
        if (!state.selectedRoomInventoryId && state.rooms[0]?._id) {
            state.selectedRoomInventoryId = state.rooms[0]._id;
        }
        renderRoomChecklist(el.warehouseRoomChecklist, 'warehouse-room-checkbox', 'Se asignara a la bodega. Una habitacion solo puede pertenecer a una bodega activa');
        renderRoomChecklist(el.bomRoomChecklist, 'bom-room-checkbox', 'Se creara una regla individual para esta habitacion');
        populateRoomInventorySelectors();
        applyChecklistFilter(el.warehouseRoomFilter, el.warehouseRoomChecklist);
        applyChecklistFilter(el.bomRoomFilter, el.bomRoomChecklist);
        syncBomLineOptions();
    };

    const setupForms = () => {
        if (el.formWarehouse) {
            el.formWarehouse.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formWarehouse);
                    const payload = Object.fromEntries(fd.entries());
                    payload.cabins = getCheckedRooms('.warehouse-room-checkbox').map((room) => room.id);
                    if (payload.cabins.length === 0) {
                        throw new Error('Selecciona al menos una habitacion');
                    }
                    const isEditingWarehouse = Boolean(state.editingWarehouseId);
                    const path = isEditingWarehouse ? `/warehouses/${state.editingWarehouseId}` : '/warehouses';
                    const method = isEditingWarehouse ? 'PUT' : 'POST';
                    await runBusyAction({
                        target: el.formWarehouse,
                        loadingTitle: isEditingWarehouse ? 'Actualizando bodega' : 'Creando bodega',
                        loadingText: 'Guardando asignacion operativa de habitaciones.',
                        successTitle: isEditingWarehouse ? 'Bodega actualizada' : 'Bodega creada',
                        successMessage: isEditingWarehouse ? 'Bodega actualizada correctamente' : 'Bodega creada correctamente',
                        action: async () => {
                            await request(path, { method, body: JSON.stringify(payload) });
                            resetWarehouseFormMode();
                            hideModal(el.modalWarehouse);
                            await Promise.all([renderWarehouses(), renderWarehouseSummary()]);
                        }
                    });
                } catch (error) {
                    await showError(error);
                }
            });
        }

        if (el.formItem) {
            el.formItem.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formItem);
                    const payload = Object.fromEntries(fd.entries());
                    if (payload.unit === 'otra') {
                        const customUnit = String(payload.unitCustom || '').trim();
                        if (!customUnit) {
                            throw new Error('Especifica la unidad personalizada');
                        }
                        payload.unit = customUnit;
                    }
                    delete payload.unitCustom;
                    payload.stockCurrent = Number(payload.stockCurrent || 0);
                    payload.stockMin = Number(payload.stockMin || 0);
                    const isEditingItem = Boolean(state.editingItemId);
                    delete payload.cabin;
                    delete payload.cabinIds;
                    delete payload.isGlobal;
                    if (!payload.warehouse) {
                        throw new Error('Selecciona la bodega del item');
                    }
                    if (isEditingItem) {
                        delete payload.initialUnitCost;
                        delete payload.initialSupplier;
                        delete payload.initialInvoiceNumber;
                        delete payload.initialPurchaseDate;
                    } else if (payload.initialUnitCost !== undefined && payload.initialUnitCost !== '') {
                        payload.initialUnitCost = Number(payload.initialUnitCost || 0);
                    }
                    const path = isEditingItem ? `/items/${state.editingItemId}` : '/items';
                    const method = isEditingItem ? 'PUT' : 'POST';
                    await runBusyAction({
                        target: el.formItem,
                        loadingTitle: isEditingItem ? 'Actualizando item' : 'Creando item',
                        loadingText: 'Guardando informacion del inventario.',
                        successTitle: isEditingItem ? 'Item actualizado' : 'Item creado',
                        successMessage: isEditingItem ? 'Item actualizado correctamente' : 'Item creado correctamente',
                        action: async () => {
                            await request(path, { method, body: JSON.stringify(payload) });
                            resetItemFormMode();
                            hideModal(el.modalItem);
                                await Promise.all([renderItems(), renderDashboard(), renderWarehouseSummary()]);
                        }
                    });
                } catch (error) {
                    await showError(error);
                }
            });
        }

        if (el.formBOMTemplate) {
            el.formBOMTemplate.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formBOMTemplate);
                    const payload = Object.fromEntries(fd.entries());
                    const selectedRooms = getCheckedRooms('.bom-room-checkbox');
                    const lines = getBomLinesPayload();
                    if (selectedRooms.length === 0) {
                        throw new Error('Selecciona al menos una habitacion');
                    }
                    if (lines.length === 0) {
                        throw new Error('Agrega al menos una linea de consumo valida');
                    }
                    if (state.editingBOMId && selectedRooms.length !== 1) {
                        throw new Error('Para editar una regla individual debes seleccionar una sola habitacion');
                    }
                    if (!state.editingBOMId) {
                        const selectedRoomIds = selectedRooms.map((room) => String(room.id));
                        const existingRoomNames = state.bomTemplates
                            .filter((template) => selectedRoomIds.includes(String(template.cabin?._id || template.cabin || '')))
                            .map((template) => roomDisplayName(template.cabin));

                        if (existingRoomNames.length > 0) {
                            throw new Error(`Ya existe una BOM para: ${existingRoomNames.join(', ')}. Debes editar la existente.`);
                        }
                    }
                    payload.effectiveFrom = parseDateTimeLocalInput(payload.effectiveFrom);
                    if (!payload.effectiveFrom) {
                        throw new Error('Selecciona una fecha y hora valida para la vigencia de la BOM');
                    }
                    payload.lines = lines;
                    payload.scopeType = 'cabana';
                    if (state.editingBOMId) {
                        payload.cabin = selectedRooms[0].id;
                    } else {
                        payload.cabinIds = selectedRooms.map((room) => room.id);
                    }
                    const isEditingBOM = Boolean(state.editingBOMId);
                    const path = isEditingBOM ? `/bom-templates/${state.editingBOMId}` : '/bom-templates';
                    const method = isEditingBOM ? 'PUT' : 'POST';
                    await runBusyAction({
                        target: el.formBOMTemplate,
                        loadingTitle: isEditingBOM ? 'Actualizando regla BOM' : 'Creando regla BOM',
                        loadingText: 'Guardando configuracion de consumo.',
                        successTitle: isEditingBOM ? 'Regla actualizada' : 'Regla creada',
                        successMessage: isEditingBOM ? 'Regla BOM actualizada correctamente' : 'Regla BOM creada correctamente',
                        action: async () => {
                            await request(path, { method, body: JSON.stringify(payload) });
                            resetBOMFormMode();
                            hideModal(el.modalBOMTemplate);
                            await renderBOM();
                        }
                    });
                } catch (error) {
                    await showError(error);
                }
            });
        }

        if (el.formPurchase) {
            el.formPurchase.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formPurchase);
                    const payload = Object.fromEntries(fd.entries());
                    if (!payload.warehouse) {
                        throw new Error('Selecciona la bodega de la compra');
                    }
                    payload.lines = getPurchaseLinesPayload();
                    delete payload.cabin;
                    delete payload.isGlobal;
                    if (payload.lines.length === 0) {
                        throw new Error('Agrega al menos una linea de compra valida');
                    }
                    await runBusyAction({
                        target: el.formPurchase,
                        loadingTitle: 'Registrando compra',
                        loadingText: 'Actualizando stock y movimientos.',
                        successTitle: 'Compra registrada',
                        successMessage: 'Compra registrada correctamente',
                        action: async () => {
                            await request('/purchases', { method: 'POST', body: JSON.stringify(payload) });
                            resetPurchaseFormMode();
                            hideModal(el.modalPurchase);
                            await Promise.all([renderItems(), renderDashboard(), renderPurchases(), renderMovements(), renderAlerts(), renderWarehouseSummary()]);
                        }
                    });
                } catch (error) {
                    await showError(error);
                }
            });
        }

        if (el.formAdjustment) {
            el.formAdjustment.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formAdjustment);
                    const payload = Object.fromEntries(fd.entries());
                    payload.quantity = Number(payload.quantity || 0);
                    await runBusyAction({
                        target: el.formAdjustment,
                        loadingTitle: 'Aplicando ajuste',
                        loadingText: 'Actualizando stock del item.',
                        successTitle: 'Ajuste aplicado',
                        successMessage: 'Ajuste aplicado correctamente',
                        action: async () => {
                            await request('/adjustments', { method: 'POST', body: JSON.stringify(payload) });
                            resetAdjustmentFormMode();
                            hideModal(el.modalAdjustment);
                            await Promise.all([renderItems(), renderDashboard(), renderMovements(), renderAlerts(), renderWarehouseSummary()]);
                        }
                    });
                } catch (error) {
                    await showError(error);
                }
            });
        }

        if (el.formRoomTransfer) {
            el.formRoomTransfer.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formRoomTransfer);
                    const payload = Object.fromEntries(fd.entries());
                    payload.quantity = Number(payload.quantity || 0);
                    await runBusyAction({
                        target: el.formRoomTransfer,
                        loadingTitle: 'Transfiriendo a habitacion',
                        loadingText: 'Actualizando bodega y balance de habitacion.',
                        successTitle: 'Transferencia aplicada',
                        successMessage: 'El stock fue transferido correctamente a la habitacion',
                        action: async () => {
                            await request('/room-inventory/transfer', { method: 'POST', body: JSON.stringify(payload) });
                            state.selectedRoomInventoryId = payload.cabinId;
                            resetRoomTransferFormMode();
                            hideModal(el.modalRoomTransfer);
                            await Promise.all([renderItems(), renderDashboard(), renderMovements(), renderAlerts(), renderWarehouseSummary(), renderRoomInventory()]);
                        }
                    });
                } catch (error) {
                    await showError(error);
                }
            });
        }

        if (el.formRoomAdjustment) {
            el.formRoomAdjustment.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formRoomAdjustment);
                    const payload = Object.fromEntries(fd.entries());
                    payload.quantity = Number(payload.quantity || 0);
                    await runBusyAction({
                        target: el.formRoomAdjustment,
                        loadingTitle: 'Ajustando inventario de habitacion',
                        loadingText: 'Guardando movimiento manual.',
                        successTitle: 'Ajuste aplicado',
                        successMessage: 'Inventario de habitacion ajustado correctamente',
                        action: async () => {
                            await request('/room-inventory/adjustments', { method: 'POST', body: JSON.stringify(payload) });
                            state.selectedRoomInventoryId = payload.cabinId;
                            resetRoomAdjustmentFormMode();
                            hideModal(el.modalRoomAdjustment);
                            await Promise.all([renderMovements(), renderRoomInventory()]);
                        }
                    });
                } catch (error) {
                    await showError(error);
                }
            });
        }
    };

    const setupActions = () => {
        setupChecklistFilter(el.warehouseRoomFilter, el.warehouseRoomChecklist);
        setupChecklistFilter(el.bomRoomFilter, el.bomRoomChecklist);
        el.itemUnitSelect?.addEventListener('change', toggleItemUnitCustom);
        el.roomInventoryRoomSelect?.addEventListener('change', async () => {
            state.selectedRoomInventoryId = el.roomInventoryRoomSelect.value || '';
            await renderRoomInventory();
        });
        el.roomInventoryTypeFilter?.addEventListener('change', async () => {
            state.selectedRoomInventoryType = el.roomInventoryTypeFilter.value || 'all';
            await renderRoomInventory();
        });
        el.roomTransferRoomSelect?.addEventListener('change', async () => {
            const roomId = el.roomTransferRoomSelect.value || '';
            if (roomId) {
                state.selectedRoomInventoryId = roomId;
                await renderRoomInventory();
            }
            populateRoomTransferItemSelect();
            updateRoomTransferHint();
        });
        el.roomTransferItemSelect?.addEventListener('change', updateRoomTransferHint);
        el.roomAdjustmentRoomSelect?.addEventListener('change', async () => {
            const roomId = el.roomAdjustmentRoomSelect.value || '';
            if (roomId) {
                state.selectedRoomInventoryId = roomId;
                await renderRoomInventory();
            }
            populateRoomAdjustmentItemSelect();
            updateRoomAdjustmentHint();
        });
        el.roomAdjustmentItemSelect?.addEventListener('change', updateRoomAdjustmentHint);
        el.purchaseWarehouseSelect?.addEventListener('change', () => {
            syncPurchaseLineOptions();
            ensureOnePurchaseLine();
        });
        el.bomRoomChecklist?.addEventListener('change', () => {
            syncBomLineOptions();
        });
        el.btnAddBomLine?.addEventListener('click', () => {
            el.bomLinesContainer?.appendChild(createBomLineRow());
        });
        el.btnAddPurchaseLine?.addEventListener('click', () => {
            el.purchaseLinesContainer?.appendChild(createPurchaseLineRow());
        });
        if (el.btnRunConsumption) {
            el.btnRunConsumption.addEventListener('click', async () => {
                try {
                    const result = await runBusyAction({
                        target: el.btnRunConsumption,
                        busyText: 'Ejecutando...',
                        loadingTitle: 'Ejecutando consumo',
                        loadingText: 'Revisando reservas y movimientos generados.',
                        action: async () => {
                            toggleSpinner(true);
                            const response = await request('/cron/run-checkout-consumption', { method: 'POST' });
                            await Promise.all([renderAlerts(), renderDashboard(), renderWarehouseSummary()]);
                            return response;
                        }
                    });
                    await showSuccess(`Reservas evaluadas: ${result.data?.totalCandidates || 0}`, 'Consumo ejecutado');
                } catch (error) {
                    await showError(error);
                } finally {
                    toggleSpinner(false);
                }
            });
        }

        el.btnRefreshItems?.addEventListener('click', renderItems);
        el.btnRefreshWarehouses?.addEventListener('click', renderWarehouses);
        el.btnOpenRoomTransfer?.addEventListener('click', () => {
            resetRoomTransferFormMode();
            showModal(el.modalRoomTransfer);
        });
        el.btnOpenRoomAdjustment?.addEventListener('click', () => {
            resetRoomAdjustmentFormMode();
            showModal(el.modalRoomAdjustment);
        });
        el.btnRefreshRoomInventory?.addEventListener('click', renderRoomInventory);
        el.btnRefreshBom?.addEventListener('click', renderBOM);
        el.btnRefreshAlerts?.addEventListener('click', renderAlerts);
        el.btnRefreshPurchases?.addEventListener('click', renderPurchases);
        el.btnRefreshMovements?.addEventListener('click', renderMovements);
        el.btnRefreshWarehouseSummary?.addEventListener('click', renderWarehouseSummary);
        el.modalWarehouse?.addEventListener('hidden.bs.modal', resetWarehouseFormMode);
        el.modalItem?.addEventListener('hidden.bs.modal', resetItemFormMode);
        el.modalPurchase?.addEventListener('hidden.bs.modal', resetPurchaseFormMode);
        el.modalAdjustment?.addEventListener('hidden.bs.modal', resetAdjustmentFormMode);
        el.modalRoomTransfer?.addEventListener('hidden.bs.modal', resetRoomTransferFormMode);
        el.modalRoomAdjustment?.addEventListener('hidden.bs.modal', resetRoomAdjustmentFormMode);
        el.modalBOMTemplate?.addEventListener('hidden.bs.modal', resetBOMFormMode);
        el.modalBOMTemplate?.addEventListener('show.bs.modal', () => {
            if (!state.editingBOMId) {
                resetBOMFormMode();
            }
        });
    };

    const initialize = async () => {
        try {
            toggleSpinner(true);
            setupTabs();
            setupForms();
            setupActions();
            await loadRooms();
            const tasks = [
                renderItems(),
                renderWarehouses(),
                renderRoomInventory(),
                renderBOM(),
                renderPurchases(),
                renderMovements(),
                renderAlerts()
            ];
            if (canViewInventoryDashboard) {
                tasks.push(renderDashboard(), renderWarehouseSummary());
            }
            await Promise.all(tasks);
            ensureOneBomLine();
            ensureOnePurchaseLine();
            resetBOMFormMode();
            resetRoomTransferFormMode();
            resetRoomAdjustmentFormMode();
            toggleItemUnitCustom();
            toggleInitialPurchaseSection();
        } catch (error) {
            await showError(error);
        } finally {
            toggleSpinner(false);
        }
    };

    initialize();
})();
