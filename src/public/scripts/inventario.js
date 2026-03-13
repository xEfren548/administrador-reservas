(function () {
    const apiBase = '/api/inventory';
    const state = {
        rooms: [],
        warehouses: [],
        items: []
    };

    const el = {
        spinner: document.getElementById('inventoryGlobalSpinner'),
        tabs: document.querySelectorAll('.inventory-tab-button'),
        tabContents: document.querySelectorAll('.inventory-tab-content'),
        totalItems: document.getElementById('dashboard-total-items'),
        lowStock: document.getElementById('dashboard-low-stock'),
        bankCount: document.getElementById('dashboard-bank-count'),
        totalUnits: document.getElementById('dashboard-total-units'),
        stockByBank: document.getElementById('stock-by-bank'),
        criticalItems: document.getElementById('critical-items'),
        itemsTableBody: document.getElementById('items-table-body'),
        warehousesTableBody: document.getElementById('warehouses-table-body'),
        bomList: document.getElementById('bom-list'),
        alertsList: document.getElementById('alerts-list'),
        consumptionMetricsTableBody: document.getElementById('consumption-metrics-table-body'),
        formWarehouse: document.getElementById('form-warehouse'),
        formItem: document.getElementById('form-item'),
        formBOMTemplate: document.getElementById('form-bom-template'),
        btnRunConsumption: document.getElementById('btn-run-checkout-consumption'),
        btnRefreshItems: document.getElementById('btn-refresh-items'),
        btnRefreshWarehouses: document.getElementById('btn-refresh-warehouses'),
        btnRefreshBom: document.getElementById('btn-refresh-bom'),
        btnRefreshAlerts: document.getElementById('btn-refresh-alerts'),
        btnRefreshConsumptionMetrics: document.getElementById('btn-refresh-consumption-metrics'),
        warehouseScopeType: document.getElementById('warehouse-scope-type'),
        warehouseCabinSelect: document.getElementById('warehouse-cabin-select'),
        warehouseGroupSelect: document.getElementById('warehouse-group-select'),
        itemWarehouseSelect: document.getElementById('item-warehouse-select'),
        itemUnitSelect: document.getElementById('item-unit-select'),
        itemUnitCustom: document.getElementById('item-unit-custom'),
        bomScopeType: document.getElementById('bom-scope-type'),
        bomRoomChecklist: document.getElementById('bom-room-checklist'),
        bomGroupHint: document.getElementById('bom-group-hint'),
        bomLinesContainer: document.getElementById('bom-lines-container'),
        btnAddBomLine: document.getElementById('btn-add-bom-line')
    };

    const toggleSpinner = (show) => {
        if (!el.spinner) return;
        el.spinner.classList.toggle('hidden', !show);
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
            throw new Error(data.message || 'Error de comunicación con inventario');
        }
        return data;
    };

    const money = (value) => Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const showError = (error) => {
        console.error(error);
        alert(error.message || 'Ocurrió un error inesperado');
    };

    const escapeHtml = (value) => String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const roomDisplayName = (room) => room?.propertyDetails?.name || room?.name || 'Habitación';

    const groupOptions = () => {
        const groups = Array.from(new Set(
            state.rooms
                .map((room) => room.roomGroup)
                .filter((group) => Boolean(group))
        ));

        return groups.sort();
    };

    const populateWarehouseInputs = () => {
        if (el.warehouseCabinSelect) {
            el.warehouseCabinSelect.innerHTML = [
                '<option value="">Selecciona habitación</option>',
                ...state.rooms.map((room) => `<option value="${room._id}">${escapeHtml(roomDisplayName(room))}</option>`)
            ].join('');
        }

        if (el.warehouseGroupSelect) {
            const groups = groupOptions();
            el.warehouseGroupSelect.innerHTML = [
                '<option value="">Selecciona grupo</option>',
                ...groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`)
            ].join('');
        }
    };

    const populateItemWarehouseSelect = () => {
        if (!el.itemWarehouseSelect) return;
        el.itemWarehouseSelect.innerHTML = [
            '<option value="">Selecciona bodega</option>',
            ...state.warehouses.map((warehouse) => {
                const scopeLabel = warehouse.scopeType === 'grupo'
                    ? `Grupo ${warehouse.roomGroup || '-'}`
                    : (warehouse.cabin?.propertyDetails?.name || 'Cabaña');
                return `<option value="${warehouse._id}">${escapeHtml(warehouse.name)} | ${escapeHtml(warehouse.bankName || '-') } | ${escapeHtml(scopeLabel)}</option>`;
            })
        ].join('');
    };

    const renderBomRoomChecklist = () => {
        if (!el.bomRoomChecklist) return;
        el.bomRoomChecklist.innerHTML = state.rooms.map((room) => `
            <label class="room-option-card flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="bom-room-checkbox" value="${room._id}" data-room-group="${escapeHtml(room.roomGroup || '')}">
                <div>
                    <p class="mb-0 text-sm font-medium text-gray-800">${escapeHtml(roomDisplayName(room))}</p>
                    <p class="mb-0 text-xs text-gray-500">Grupo: ${escapeHtml(room.roomGroup || 'Sin grupo')}</p>
                </div>
            </label>
        `).join('') || '<p class="text-gray-500 text-sm">No hay habitaciones disponibles.</p>';
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

    const ensureOneBomLine = () => {
        if (!el.bomLinesContainer) return;
        if (el.bomLinesContainer.children.length === 0) {
            el.bomLinesContainer.appendChild(createBomLineRow());
        }
    };

    const getSelectedBomRooms = () => {
        return Array.from(document.querySelectorAll('.bom-room-checkbox:checked')).map((checkbox) => ({
            id: checkbox.value,
            roomGroup: checkbox.getAttribute('data-room-group') || null
        }));
    };

    const getBomLinesPayload = () => {
        if (!el.bomLinesContainer) return [];
        const rows = Array.from(el.bomLinesContainer.children);
        return rows.map((row) => {
            const item = row.querySelector('.bom-line-item')?.value;
            const quantityPerNight = Number(row.querySelector('.bom-line-qty')?.value || 0);
            const useFactor = Number(row.querySelector('.bom-line-factor')?.value || 1);
            return { item, quantityPerNight, useFactor };
        }).filter((line) => line.item && line.quantityPerNight > 0);
    };

    const toggleWarehouseScopeInputs = () => {
        const isGroup = el.warehouseScopeType?.value === 'grupo';
        if (el.warehouseCabinSelect) {
            el.warehouseCabinSelect.classList.toggle('hidden', isGroup);
            el.warehouseCabinSelect.required = !isGroup;
            if (isGroup) el.warehouseCabinSelect.value = '';
        }
        if (el.warehouseGroupSelect) {
            el.warehouseGroupSelect.classList.toggle('hidden', !isGroup);
            el.warehouseGroupSelect.required = isGroup;
            if (!isGroup) el.warehouseGroupSelect.value = '';
        }
    };

    const toggleBomScopeHint = () => {
        const isGroup = el.bomScopeType?.value === 'grupo';
        if (el.bomGroupHint) {
            el.bomGroupHint.classList.toggle('hidden', !isGroup);
        }
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
        const result = await request('/dashboard/stock');
        const data = result.data || {};
        const stockByBank = data.stockByBank || {};
        const lowStockItems = data.lowStockItems || [];

        if (el.totalItems) el.totalItems.textContent = data.totalItems || 0;
        if (el.lowStock) el.lowStock.textContent = data.lowStockCount || 0;
        if (el.bankCount) el.bankCount.textContent = Object.keys(stockByBank).length;

        const totalUnits = Object.values(stockByBank).reduce((sum, bank) => sum + Number(bank.stockUnits || 0), 0);
        if (el.totalUnits) el.totalUnits.textContent = money(totalUnits);

        if (el.stockByBank) {
            el.stockByBank.innerHTML = Object.entries(stockByBank).map(([bank, values]) => `
                <div class="flex items-center justify-between bg-gray-100 rounded p-2">
                    <span class="font-medium text-gray-700">${bank}</span>
                    <span class="text-sm text-gray-600">Items: ${values.items} | Unidades: ${money(values.stockUnits)}</span>
                </div>
            `).join('') || '<p class="text-gray-500">Sin información por banco.</p>';
        }

        if (el.criticalItems) {
            el.criticalItems.innerHTML = lowStockItems.map((item) => `
                <div class="border border-red-200 bg-red-50 rounded p-2">
                    <p class="font-semibold text-red-700">${item.name}</p>
                    <p class="text-xs text-red-600">Stock ${item.stockCurrent} / Min ${item.stockMin} | ${item.unit}</p>
                </div>
            `).join('') || '<p class="text-gray-500">No hay items en bajo stock.</p>';
        }
    };

    const renderItems = async () => {
        const result = await request('/items');
        state.items = result.data || [];
        const rows = (result.data || []).map((item) => `
            <tr>
                <td>${item.name}</td>
                <td>${item.itemType}</td>
                <td>${item.unit}</td>
                <td>${item.stockCurrent}</td>
                <td>${item.stockMin}</td>
                <td>${item.warehouse?.name || '-'}</td>
                <td>${item.warehouse?.bankName || '-'}</td>
            </tr>
        `).join('');
        if (el.itemsTableBody) el.itemsTableBody.innerHTML = rows || '<tr><td colspan="7" class="text-center text-gray-500">Sin items</td></tr>';

        if (el.bomLinesContainer) {
            // Refresh product options in BOM rows
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

    const renderWarehouses = async () => {
        const result = await request('/warehouses');
        state.warehouses = result.data || [];
        const rows = (result.data || []).map((warehouse) => `
            <tr>
                <td>${warehouse.name}</td>
                <td>${warehouse.bankName || '-'}</td>
                <td>${warehouse.scopeType}</td>
                <td>${warehouse.cabin?.propertyDetails?.name || '-'}</td>
                <td>${warehouse.roomGroup || '-'}</td>
                <td>${warehouse.active ? 'Activa' : 'Inactiva'}</td>
            </tr>
        `).join('');
        if (el.warehousesTableBody) el.warehousesTableBody.innerHTML = rows || '<tr><td colspan="6" class="text-center text-gray-500">Sin bodegas</td></tr>';
        populateItemWarehouseSelect();
    };

    const renderBOM = async () => {
        const result = await request('/bom-templates');
        const cards = (result.data || []).map((template) => {
            const lines = (template.lines || []).map((line) => `${line.item?.name || 'Item'}: ${line.quantityPerNight} x factor ${line.useFactor || 1}`).join('<br>');
            return `
                <div class="border border-gray-200 rounded-lg p-3">
                    <div class="flex items-center justify-between">
                        <h4 class="font-semibold text-gray-800">${template.name}</h4>
                        <span class="text-xs px-2 py-1 rounded bg-teal-100 text-teal-700">${template.scopeType}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Cabaña: ${template.cabin?.propertyDetails?.name || '-'} | Grupo: ${template.roomGroup || '-'}</p>
                    <p class="text-sm text-gray-700 mt-2">${lines || 'Sin líneas'}</p>
                </div>
            `;
        }).join('');

        if (el.bomList) el.bomList.innerHTML = cards || '<p class="text-gray-500">No hay plantillas BOM.</p>';
    };

    const renderAlerts = async () => {
        const result = await request('/alerts?status=open');
        const cards = (result.data || []).map((alertItem) => `
            <div class="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                <div class="flex items-center justify-between gap-2">
                    <p class="font-semibold text-yellow-800">${alertItem.alertType}</p>
                    <button class="btn btn-sm btn-outline-success" data-resolve-alert="${alertItem._id}">Resolver</button>
                </div>
                <p class="text-sm text-yellow-700 mt-2">${alertItem.message}</p>
                <p class="text-xs text-yellow-600 mt-1">Item: ${alertItem.item?.name || '-'} | Bodega: ${alertItem.warehouse?.name || '-'}</p>
            </div>
        `).join('');

        if (el.alertsList) {
            el.alertsList.innerHTML = cards || '<p class="text-gray-500">Sin alertas abiertas.</p>';
            el.alertsList.querySelectorAll('[data-resolve-alert]').forEach((button) => {
                button.addEventListener('click', async () => {
                    try {
                        await request(`/alerts/${button.getAttribute('data-resolve-alert')}/resolve`, { method: 'PUT' });
                        await renderAlerts();
                        await renderDashboard();
                    } catch (error) {
                        showError(error);
                    }
                });
            });
        }
    };

    const renderConsumptionMetrics = async () => {
        const result = await request('/dashboard/stock');
        const stockByBank = result.data?.stockByBank || {};

        const rows = Object.entries(stockByBank).map(([bankName, values]) => `
            <tr>
                <td>${bankName}</td>
                <td>${values.items || 0}</td>
                <td>${money(values.stockUnits || 0)}</td>
            </tr>
        `).join('');

        if (el.consumptionMetricsTableBody) {
            el.consumptionMetricsTableBody.innerHTML = rows || '<tr><td colspan="3" class="text-center text-gray-500">Sin métricas</td></tr>';
        }
    };

    const setupForms = () => {
        if (el.formWarehouse) {
            el.formWarehouse.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formWarehouse);
                    const payload = Object.fromEntries(fd.entries());
                    if (payload.scopeType === 'cabana') {
                        delete payload.roomGroup;
                    } else {
                        delete payload.cabin;
                    }
                    if (!payload.cabin) delete payload.cabin;
                    if (!payload.roomGroup) delete payload.roomGroup;
                    await request('/warehouses', { method: 'POST', body: JSON.stringify(payload) });
                    el.formWarehouse.reset();
                    toggleWarehouseScopeInputs();
                    await renderWarehouses();
                    await renderDashboard();
                    alert('Bodega creada correctamente');
                } catch (error) {
                    showError(error);
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
                    await request('/items', { method: 'POST', body: JSON.stringify(payload) });
                    el.formItem.reset();
                    toggleItemUnitCustom();
                    await Promise.all([renderItems(), renderDashboard()]);
                    alert('Item creado correctamente');
                } catch (error) {
                    showError(error);
                }
            });
        }

        if (el.formBOMTemplate) {
            el.formBOMTemplate.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const fd = new FormData(el.formBOMTemplate);
                    const payload = Object.fromEntries(fd.entries());

                    const selectedRooms = getSelectedBomRooms();
                    const lines = getBomLinesPayload();

                    if (selectedRooms.length === 0) {
                        throw new Error('Selecciona al menos una habitación');
                    }

                    if (lines.length === 0) {
                        throw new Error('Agrega al menos una línea de consumo válida');
                    }

                    payload.lines = lines;

                    if (payload.scopeType === 'cabana') {
                        payload.cabinIds = selectedRooms.map((room) => room.id);
                        delete payload.cabin;
                        delete payload.roomGroup;
                    } else {
                        const nonEmptyGroups = selectedRooms.map((room) => room.roomGroup).filter(Boolean);
                        const uniqueGroups = Array.from(new Set(nonEmptyGroups));

                        if (uniqueGroups.length !== 1) {
                            throw new Error('Para scope grupo, selecciona habitaciones del mismo Room Group');
                        }

                        payload.roomGroup = uniqueGroups[0];
                    }

                    await request('/bom-templates', { method: 'POST', body: JSON.stringify(payload) });
                    el.formBOMTemplate.reset();
                    if (el.bomRoomChecklist) {
                        el.bomRoomChecklist.querySelectorAll('.bom-room-checkbox').forEach((checkbox) => {
                            checkbox.checked = false;
                        });
                    }
                    if (el.bomLinesContainer) {
                        el.bomLinesContainer.innerHTML = '';
                        ensureOneBomLine();
                        const firstFactorInput = el.bomLinesContainer.querySelector('.bom-line-factor');
                        if (firstFactorInput && !firstFactorInput.value) {
                            firstFactorInput.value = '1';
                        }
                    }
                    await renderBOM();
                    alert('Regla BOM creada correctamente');
                } catch (error) {
                    showError(error);
                }
            });
        }
    };

    const setupActions = () => {
        el.warehouseScopeType?.addEventListener('change', toggleWarehouseScopeInputs);
        el.itemUnitSelect?.addEventListener('change', toggleItemUnitCustom);
        el.bomScopeType?.addEventListener('change', toggleBomScopeHint);
        el.btnAddBomLine?.addEventListener('click', () => {
            el.bomLinesContainer?.appendChild(createBomLineRow());
        });

        if (el.btnRunConsumption) {
            el.btnRunConsumption.addEventListener('click', async () => {
                try {
                    toggleSpinner(true);
                    const result = await request('/cron/run-checkout-consumption', { method: 'POST' });
                    alert(`Consumo ejecutado. Reservas evaluadas: ${result.data?.totalCandidates || 0}`);
                    await Promise.all([renderAlerts(), renderDashboard()]);
                } catch (error) {
                    showError(error);
                } finally {
                    toggleSpinner(false);
                }
            });
        }

        el.btnRefreshItems?.addEventListener('click', renderItems);
        el.btnRefreshWarehouses?.addEventListener('click', renderWarehouses);
        el.btnRefreshBom?.addEventListener('click', renderBOM);
        el.btnRefreshAlerts?.addEventListener('click', renderAlerts);
        el.btnRefreshConsumptionMetrics?.addEventListener('click', renderConsumptionMetrics);
    };

    const loadRooms = async () => {
        const response = await fetch('/api/habitaciones');
        if (!response.ok) {
            throw new Error('No se pudieron cargar las habitaciones');
        }
        const rooms = await response.json();
        state.rooms = Array.isArray(rooms) ? rooms : [];
        populateWarehouseInputs();
        renderBomRoomChecklist();
    };

    const initialize = async () => {
        try {
            toggleSpinner(true);
            setupTabs();
            setupForms();
            setupActions();

            await loadRooms();
            await Promise.all([
                renderDashboard(),
                renderItems(),
                renderWarehouses(),
                renderBOM(),
                renderAlerts(),
                renderConsumptionMetrics()
            ]);

            ensureOneBomLine();
            toggleWarehouseScopeInputs();
            toggleBomScopeHint();
            toggleItemUnitCustom();
        } catch (error) {
            showError(error);
        } finally {
            toggleSpinner(false);
        }
    };

    initialize();
})();
