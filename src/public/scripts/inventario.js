(function () {
    const apiBase = '/api/inventory';
    const state = {
        rooms: [],
        items: [],
        purchases: [],
        movements: [],
        bomTemplates: [],
        metricGroups: [],
        editingMetricGroupId: null,
        editingItemId: null,
        editingBOMId: null
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
        metricGroupsList: document.getElementById('metric-groups-list'),
        bomList: document.getElementById('bom-list'),
        alertsList: document.getElementById('alerts-list'),
        consumptionMetricsTableBody: document.getElementById('consumption-metrics-table-body'),
        formMetricGroup: document.getElementById('form-metric-group'),
        formItem: document.getElementById('form-item'),
        formPurchase: document.getElementById('form-purchase'),
        formAdjustment: document.getElementById('form-adjustment'),
        formBOMTemplate: document.getElementById('form-bom-template'),
        modalMetricGroup: document.getElementById('modalMetricGroup'),
        modalItem: document.getElementById('modalItem'),
        modalPurchase: document.getElementById('modalPurchase'),
        modalAdjustment: document.getElementById('modalAdjustment'),
        modalBOMTemplate: document.getElementById('modalBOMTemplate'),
        modalMetricGroupTitle: document.getElementById('modal-metric-group-title'),
        modalMetricGroupSubmit: document.getElementById('modal-metric-group-submit'),
        modalItemTitle: document.getElementById('modal-item-title'),
        modalItemSubmit: document.getElementById('modal-item-submit'),
        modalBOMTitle: document.getElementById('modal-bom-title'),
        modalBOMSubmit: document.getElementById('modal-bom-submit'),
        bomEffectiveFrom: document.getElementById('bom-effective-from'),
        itemInitialPurchaseSection: document.getElementById('item-initial-purchase-section'),
        itemInitialUnitCost: document.getElementById('item-initial-unit-cost'),
        btnRunConsumption: document.getElementById('btn-run-checkout-consumption'),
        btnRefreshItems: document.getElementById('btn-refresh-items'),
        btnRefreshGroups: document.getElementById('btn-refresh-groups'),
        btnRefreshBom: document.getElementById('btn-refresh-bom'),
        btnRefreshAlerts: document.getElementById('btn-refresh-alerts'),
        btnRefreshPurchases: document.getElementById('btn-refresh-purchases'),
        btnRefreshMovements: document.getElementById('btn-refresh-movements'),
        btnRefreshConsumptionMetrics: document.getElementById('btn-refresh-consumption-metrics'),
        itemRoomChecklist: document.getElementById('item-room-checklist'),
        itemRoomFilter: document.getElementById('item-room-filter'),
        itemUnitSelect: document.getElementById('item-unit-select'),
        itemUnitCustom: document.getElementById('item-unit-custom'),
        metricGroupRoomFilter: document.getElementById('metric-group-room-filter'),
        metricGroupRoomChecklist: document.getElementById('metric-group-room-checklist'),
        bomRoomFilter: document.getElementById('bom-room-filter'),
        bomRoomChecklist: document.getElementById('bom-room-checklist'),
        purchaseCabinSelect: document.getElementById('purchase-cabin-select'),
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

    const roomDisplayName = (room) => room?.propertyDetails?.name || room?.name || 'Habitacion';

    const sortAlphabetically = (items, getLabel) => {
        if (!Array.isArray(items)) return [];

        return [...items].sort((left, right) => String(getLabel(left) || '').localeCompare(
            String(getLabel(right) || ''),
            'es',
            { sensitivity: 'base', numeric: true }
        ));
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
            buildChartFallback(el.stockByCabinChart, 'No se pudo cargar la grafica de stock por habitacion.');
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

    const populatePurchaseCabinSelect = () => {
        if (!el.purchaseCabinSelect) return;
        el.purchaseCabinSelect.innerHTML = [
            '<option value="">Selecciona habitacion</option>',
            ...state.rooms.map((room) => `<option value="${room._id}">${escapeHtml(roomDisplayName(room))}</option>`)
        ].join('');
    };

    const populateAdjustmentItemSelect = () => {
        if (!el.adjustmentItemSelect) return;
        el.adjustmentItemSelect.innerHTML = [
            '<option value="">Selecciona item</option>',
            ...state.items.map((item) => `<option value="${item._id}">${escapeHtml(item.name)} | ${escapeHtml(roomDisplayName(item.cabin))} | Stock ${item.stockCurrent} ${escapeHtml(item.unit)}</option>`)
        ].join('');
    };

    const renderRoomChecklist = (container, checkboxClass, helperText) => {
        if (!container) return;
        container.innerHTML = state.rooms.map((room) => `
            <label class="room-option-card flex items-center gap-2 cursor-pointer" data-filter-label="${escapeHtml(normalizeSearchText(roomDisplayName(room)))}">
                <input type="checkbox" class="${checkboxClass}" value="${room._id}">
                <div>
                    <p class="mb-0 text-sm font-medium text-gray-800">${escapeHtml(roomDisplayName(room))}</p>
                    ${helperText ? `<p class="mb-0 text-xs text-gray-500">${escapeHtml(helperText)}</p>` : ''}
                </div>
            </label>
        `).join('') || '<p class="text-gray-500 text-sm">No hay habitaciones disponibles.</p>';
    };

    const applyChecklistFilter = (input, container) => {
        if (!container) return;
        const query = normalizeSearchText(input?.value || '');
        container.querySelectorAll('.room-option-card').forEach((optionCard) => {
            const label = optionCard.getAttribute('data-filter-label') || '';
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
        input.addEventListener('input', () => {
            applyChecklistFilter(input, container);
        });
    };

    const setCheckedRooms = (selector, roomIds) => {
        const selectedIds = new Set((roomIds || []).map(String));
        document.querySelectorAll(selector).forEach((checkbox) => {
            checkbox.checked = selectedIds.has(String(checkbox.value));
        });
    };

    const getCheckedRooms = (selector) => {
        return Array.from(document.querySelectorAll(`${selector}:checked`)).map((checkbox) => ({ id: checkbox.value }));
    };

    const createBomLineRow = () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'bom-line-row';
        const itemOptions = [
            '<option value="">Producto</option>',
            ...state.items.map((item) => `<option value="${item._id}">${escapeHtml(item.name)} (${escapeHtml(item.unit)})</option>`)
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

    const getItemsByCabin = (cabinId) => state.items.filter((item) => String(item.cabin?._id || item.cabin) === String(cabinId));

    const buildPurchaseItemOptions = (cabinId, selectedItemId = '') => {
        const items = cabinId ? getItemsByCabin(cabinId) : [];
        return [
            '<option value="">Item</option>',
            ...items.map((item) => `<option value="${item._id}" ${String(selectedItemId) === String(item._id) ? 'selected' : ''}>${escapeHtml(item.name)} (${escapeHtml(item.unit)})</option>`)
        ].join('');
    };

    const createPurchaseLineRow = (cabinId = '', line = {}) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'purchase-line-row';
        wrapper.innerHTML = `
            <select class="form-select purchase-line-item">${buildPurchaseItemOptions(cabinId, line.item?._id || line.item || '')}</select>
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
            el.purchaseLinesContainer.appendChild(createPurchaseLineRow(el.purchaseCabinSelect?.value || ''));
        }
    };

    const syncPurchaseLineOptions = () => {
        if (!el.purchaseLinesContainer) return;
        const cabinId = el.purchaseCabinSelect?.value || '';
        Array.from(el.purchaseLinesContainer.children).forEach((row) => {
            const select = row.querySelector('.purchase-line-item');
            if (!select) return;
            const previousValue = select.value;
            select.innerHTML = buildPurchaseItemOptions(cabinId, previousValue);
            if (!Array.from(select.options).some((option) => option.value === previousValue)) {
                select.value = '';
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
        setCheckedRooms('.item-room-checkbox', []);
        resetChecklistFilter(el.itemRoomFilter, el.itemRoomChecklist);
        if (el.modalItemTitle) el.modalItemTitle.textContent = 'Nuevo Item';
        if (el.modalItemSubmit) el.modalItemSubmit.textContent = 'Guardar';
        toggleItemUnitCustom();
        toggleInitialPurchaseSection();
    };

    const resetPurchaseFormMode = () => {
        el.formPurchase?.reset();
        if (el.purchaseLinesContainer) {
            el.purchaseLinesContainer.innerHTML = '';
        }
        ensureOnePurchaseLine();
        syncPurchaseLineOptions();
    };

    const resetAdjustmentFormMode = () => {
        el.formAdjustment?.reset();
    };

    const resetBOMFormMode = () => {
        state.editingBOMId = null;
        el.formBOMTemplate?.reset();
        if (el.modalBOMTitle) el.modalBOMTitle.textContent = 'Nueva Regla de Consumo BOM';
        if (el.modalBOMSubmit) el.modalBOMSubmit.textContent = 'Guardar BOM';
        if (el.bomEffectiveFrom) el.bomEffectiveFrom.value = getMexicoCityNowForInput();
        setCheckedRooms('.bom-room-checkbox', []);
        resetChecklistFilter(el.bomRoomFilter, el.bomRoomChecklist);
        setBomLines([]);
    };

    const resetMetricGroupFormMode = () => {
        state.editingMetricGroupId = null;
        el.formMetricGroup?.reset();
        setCheckedRooms('.metric-group-room-checkbox', []);
        resetChecklistFilter(el.metricGroupRoomFilter, el.metricGroupRoomChecklist);
        if (el.modalMetricGroupTitle) el.modalMetricGroupTitle.textContent = 'Nuevo Grupo de Habitaciones';
        if (el.modalMetricGroupSubmit) el.modalMetricGroupSubmit.textContent = 'Guardar';
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
            `).join('') || '<p class="text-gray-500">Sin informacion por habitacion.</p>';
        }

        if (el.criticalItems) {
            el.criticalItems.innerHTML = lowStockItems.map((item) => `
                <div class="border border-red-200 bg-red-50 rounded p-2">
                    <p class="font-semibold text-red-700">${escapeHtml(item.name)}</p>
                    <p class="text-xs text-red-600">Stock ${item.stockCurrent} / Min ${item.stockMin} | ${escapeHtml(item.unit)}</p>
                    <p class="text-xs text-red-500 mt-1">Habitacion: ${escapeHtml(roomDisplayName(item.cabin))}</p>
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
                <td>${escapeHtml(item.itemType)}</td>
                <td>${escapeHtml(item.unit)}</td>
                <td>${item.stockCurrent}</td>
                <td>${item.stockMin}</td>
                <td>${escapeHtml(roomDisplayName(item.cabin))}</td>
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
            el.itemsTableBody.innerHTML = rows || '<tr><td colspan="7" class="text-center text-gray-500">Sin items</td></tr>';
            el.itemsTableBody.querySelectorAll('[data-edit-item]').forEach((button) => {
                button.addEventListener('click', () => {
                    const item = state.items.find((entry) => String(entry._id) === button.getAttribute('data-edit-item'));
                    if (!item || !el.formItem) return;
                    state.editingItemId = item._id;
                    if (el.modalItemTitle) el.modalItemTitle.textContent = `Editar Item: ${item.name}`;
                    if (el.modalItemSubmit) el.modalItemSubmit.textContent = 'Actualizar';
                    el.formItem.elements.name.value = item.name || '';
                    el.formItem.elements.description.value = item.description || '';
                    el.formItem.elements.itemType.value = item.itemType || 'directo';
                    const unitOptionExists = Array.from(el.itemUnitSelect?.options || []).some((option) => option.value === item.unit);
                    if (el.itemUnitSelect) el.itemUnitSelect.value = unitOptionExists ? item.unit : 'otra';
                    if (el.itemUnitCustom) el.itemUnitCustom.value = unitOptionExists ? '' : (item.unit || '');
                    setCheckedRooms('.item-room-checkbox', [item.cabin?._id || item.cabin].filter(Boolean));
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
                                await Promise.all([renderItems(), renderDashboard(), renderConsumptionMetrics()]);
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
        }
    };

    const renderMetricGroups = async () => {
        const result = await request('/metric-groups');
        state.metricGroups = sortAlphabetically(result.data || [], (group) => group?.name);
        if (el.metricGroupsList) {
            el.metricGroupsList.innerHTML = state.metricGroups.map((group) => `
                <div class="border border-gray-200 rounded-lg p-3">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <h4 class="font-semibold text-gray-800">${escapeHtml(group.name)}</h4>
                            <p class="text-xs text-gray-500 mt-1">${escapeHtml(group.description || 'Sin descripcion')}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs px-2 py-1 rounded bg-sky-100 text-sky-700">${(group.cabins || []).length} habitaciones</span>
                            ${canManageInventory ? `<button type="button" class="btn btn-outline-primary btn-sm" data-edit-metric-group="${group._id}">Editar</button><button type="button" class="btn btn-outline-danger btn-sm" data-delete-metric-group="${group._id}">Desactivar</button>` : ''}
                        </div>
                    </div>
                    <p class="text-sm text-gray-700 mt-3">${(group.cabins || []).map((room) => escapeHtml(roomDisplayName(room))).join(', ') || 'Sin habitaciones asignadas'}</p>
                </div>
            `).join('') || '<p class="text-gray-500">No hay grupos metricos registrados.</p>';

            el.metricGroupsList.querySelectorAll('[data-edit-metric-group]').forEach((button) => {
                button.addEventListener('click', () => {
                    const group = state.metricGroups.find((entry) => String(entry._id) === button.getAttribute('data-edit-metric-group'));
                    if (!group || !el.formMetricGroup) return;
                    state.editingMetricGroupId = group._id;
                    if (el.modalMetricGroupTitle) el.modalMetricGroupTitle.textContent = `Editar Grupo: ${group.name}`;
                    if (el.modalMetricGroupSubmit) el.modalMetricGroupSubmit.textContent = 'Actualizar';
                    el.formMetricGroup.elements.name.value = group.name || '';
                    el.formMetricGroup.elements.description.value = group.description || '';
                    setCheckedRooms('.metric-group-room-checkbox', (group.cabins || []).map((room) => room._id || room));
                    showModal(el.modalMetricGroup);
                });
            });

            el.metricGroupsList.querySelectorAll('[data-delete-metric-group]').forEach((button) => {
                button.addEventListener('click', async () => {
                    try {
                        const confirmed = await confirmAction({
                            title: 'Desactivar grupo metrico',
                            text: 'El grupo metrico se desactivara y dejara de aparecer en dashboards.',
                            confirmButtonText: 'Si, desactivar'
                        });
                        if (!confirmed) return;

                        await runBusyAction({
                            target: button,
                            busyText: 'Desactivando...',
                            loadingTitle: 'Desactivando grupo',
                            loadingText: 'Actualizando configuracion de metricas.',
                            successTitle: 'Grupo desactivado',
                            successMessage: 'Grupo metrico desactivado correctamente',
                            action: async () => {
                                await request(`/metric-groups/${button.getAttribute('data-delete-metric-group')}`, { method: 'DELETE' });
                                await Promise.all([renderMetricGroups(), renderConsumptionMetrics()]);
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
                        <td>${escapeHtml(roomDisplayName(purchase.cabin))}</td>
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
                    <td>${escapeHtml(roomDisplayName(movement.cabin))}</td>
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
                                ${canManageInventory ? `<button type="button" class="btn btn-outline-primary btn-sm" data-edit-bom="${template._id}">Editar</button><button type="button" class="btn btn-outline-danger btn-sm" data-delete-bom="${template._id}">Desactivar</button>` : ''}
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
                    setCheckedRooms('.bom-room-checkbox', [template.cabin?._id || template.cabin].filter(Boolean));
                    setBomLines(template.lines || []);
                    showModal(el.modalBOMTemplate);
                });
            });
            el.bomList.querySelectorAll('[data-delete-bom]').forEach((button) => {
                button.addEventListener('click', async () => {
                    try {
                        const confirmed = await confirmAction({
                            title: 'Desactivar regla BOM',
                            text: 'La regla BOM se desactivara y dejara de aplicarse en consumos futuros.',
                            confirmButtonText: 'Si, desactivar'
                        });
                        if (!confirmed) return;

                        await runBusyAction({
                            target: button,
                            busyText: 'Desactivando...',
                            loadingTitle: 'Desactivando BOM',
                            loadingText: 'Guardando cambios de consumo.',
                            successTitle: 'Regla desactivada',
                            successMessage: 'Regla BOM desactivada correctamente',
                            action: async () => {
                                await request(`/bom-templates/${button.getAttribute('data-delete-bom')}`, { method: 'DELETE' });
                                await renderBOM();
                            }
                        });
                    } catch (error) {
                        await showError(error);
                    }
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
                    <p class="text-xs text-yellow-600 mt-1">Item: ${escapeHtml(alertItem.item?.name || '-')} | Habitacion: ${escapeHtml(roomDisplayName(alertItem.cabin))}</p>
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

    const renderConsumptionMetrics = async () => {
        if (!canViewInventoryDashboard) return;
        await renderMetricGroups();
        const dashboards = await Promise.all(state.metricGroups.map(async (group) => {
            try {
                const result = await request(`/metric-groups/${group._id}/dashboard`);
                return result.data;
            } catch (error) {
                return null;
            }
        }));

        const rows = dashboards.filter(Boolean).map((dashboard) => `
            <tr>
                <td>${escapeHtml(dashboard.metricGroup?.name || '-')}</td>
                <td>${dashboard.metricGroup?.cabins?.length || 0}</td>
                <td>${dashboard.itemCount || 0}</td>
                <td>${money(dashboard.totalStock || 0)}</td>
            </tr>
        `).join('');

        if (el.consumptionMetricsTableBody) {
            el.consumptionMetricsTableBody.innerHTML = rows || '<tr><td colspan="4" class="text-center text-gray-500">Sin metricas</td></tr>';
        }
    };

    const loadRooms = async () => {
        const response = await fetch('/api/habitaciones');
        if (!response.ok) {
            throw new Error('No se pudieron cargar las habitaciones');
        }
        const rooms = await response.json();
        state.rooms = sortAlphabetically(rooms, (room) => roomDisplayName(room));
        populatePurchaseCabinSelect();
        renderRoomChecklist(el.itemRoomChecklist, 'item-room-checkbox');
        renderRoomChecklist(el.metricGroupRoomChecklist, 'metric-group-room-checkbox', 'Se asociara al grupo para metricas');
        renderRoomChecklist(el.bomRoomChecklist, 'bom-room-checkbox', 'Se creara una regla individual para esta habitacion');
        applyChecklistFilter(el.itemRoomFilter, el.itemRoomChecklist);
        applyChecklistFilter(el.metricGroupRoomFilter, el.metricGroupRoomChecklist);
        applyChecklistFilter(el.bomRoomFilter, el.bomRoomChecklist);
    };

    const setupForms = () => {
        if (el.formMetricGroup) {
            el.formMetricGroup.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formMetricGroup);
                    const payload = Object.fromEntries(fd.entries());
                    payload.cabins = getCheckedRooms('.metric-group-room-checkbox').map((room) => room.id);
                    if (payload.cabins.length === 0) {
                        throw new Error('Selecciona al menos una habitacion');
                    }
                    const isEditingMetricGroup = Boolean(state.editingMetricGroupId);
                    const path = isEditingMetricGroup ? `/metric-groups/${state.editingMetricGroupId}` : '/metric-groups';
                    const method = isEditingMetricGroup ? 'PUT' : 'POST';
                    await runBusyAction({
                        target: el.formMetricGroup,
                        loadingTitle: isEditingMetricGroup ? 'Actualizando grupo metrico' : 'Creando grupo metrico',
                        loadingText: 'Guardando configuracion de habitaciones.',
                        successTitle: isEditingMetricGroup ? 'Grupo actualizado' : 'Grupo creado',
                        successMessage: isEditingMetricGroup ? 'Grupo metrico actualizado correctamente' : 'Grupo metrico creado correctamente',
                        action: async () => {
                            await request(path, { method, body: JSON.stringify(payload) });
                            resetMetricGroupFormMode();
                            hideModal(el.modalMetricGroup);
                            await Promise.all([renderMetricGroups(), renderConsumptionMetrics()]);
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
                    const selectedRooms = getCheckedRooms('.item-room-checkbox').map((room) => room.id);
                    const isEditingItem = Boolean(state.editingItemId);
                    if (selectedRooms.length === 0) {
                        throw new Error('Selecciona al menos una habitacion');
                    }
                    if (isEditingItem) {
                        if (selectedRooms.length !== 1) {
                            throw new Error('Para editar un item debes seleccionar una sola habitacion');
                        }
                        payload.cabin = selectedRooms[0];
                    } else {
                        payload.cabinIds = selectedRooms;
                        delete payload.cabin;
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
                        successMessage: isEditingItem ? 'Item actualizado correctamente' : selectedRooms.length > 1 ? 'Items creados correctamente' : 'Item creado correctamente',
                        action: async () => {
                            await request(path, { method, body: JSON.stringify(payload) });
                            resetItemFormMode();
                            hideModal(el.modalItem);
                            await Promise.all([renderItems(), renderDashboard(), renderConsumptionMetrics()]);
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
                    payload.lines = getPurchaseLinesPayload();
                    if (!payload.cabin) {
                        throw new Error('Selecciona una habitacion');
                    }
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
                            await Promise.all([renderItems(), renderDashboard(), renderPurchases(), renderMovements(), renderAlerts(), renderConsumptionMetrics()]);
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
                            await Promise.all([renderItems(), renderDashboard(), renderMovements(), renderAlerts(), renderConsumptionMetrics()]);
                        }
                    });
                } catch (error) {
                    await showError(error);
                }
            });
        }
    };

    const setupActions = () => {
        setupChecklistFilter(el.itemRoomFilter, el.itemRoomChecklist);
        setupChecklistFilter(el.metricGroupRoomFilter, el.metricGroupRoomChecklist);
        setupChecklistFilter(el.bomRoomFilter, el.bomRoomChecklist);
        el.itemUnitSelect?.addEventListener('change', toggleItemUnitCustom);
        el.purchaseCabinSelect?.addEventListener('change', syncPurchaseLineOptions);
        el.btnAddBomLine?.addEventListener('click', () => {
            el.bomLinesContainer?.appendChild(createBomLineRow());
        });
        el.btnAddPurchaseLine?.addEventListener('click', () => {
            el.purchaseLinesContainer?.appendChild(createPurchaseLineRow(el.purchaseCabinSelect?.value || ''));
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
                            await Promise.all([renderAlerts(), renderDashboard(), renderConsumptionMetrics()]);
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
        el.btnRefreshGroups?.addEventListener('click', renderMetricGroups);
        el.btnRefreshBom?.addEventListener('click', renderBOM);
        el.btnRefreshAlerts?.addEventListener('click', renderAlerts);
        el.btnRefreshPurchases?.addEventListener('click', renderPurchases);
        el.btnRefreshMovements?.addEventListener('click', renderMovements);
        el.btnRefreshConsumptionMetrics?.addEventListener('click', renderConsumptionMetrics);
        el.modalMetricGroup?.addEventListener('hidden.bs.modal', resetMetricGroupFormMode);
        el.modalItem?.addEventListener('hidden.bs.modal', resetItemFormMode);
        el.modalPurchase?.addEventListener('hidden.bs.modal', resetPurchaseFormMode);
        el.modalAdjustment?.addEventListener('hidden.bs.modal', resetAdjustmentFormMode);
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
                renderMetricGroups(),
                renderBOM(),
                renderPurchases(),
                renderMovements(),
                renderAlerts()
            ];
            if (canViewInventoryDashboard) {
                tasks.push(renderDashboard(), renderConsumptionMetrics());
            }
            await Promise.all(tasks);
            ensureOneBomLine();
            ensureOnePurchaseLine();
            resetBOMFormMode();
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
