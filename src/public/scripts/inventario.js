(function () {
    const apiBase = '/api/inventory';
    const state = {
        rooms: [],
        items: [],
        bomTemplates: [],
        metricGroups: [],
        editingItemId: null,
        editingBOMId: null
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
        criticalItems: document.getElementById('critical-items'),
        itemsTableBody: document.getElementById('items-table-body'),
        metricGroupsList: document.getElementById('metric-groups-list'),
        bomList: document.getElementById('bom-list'),
        alertsList: document.getElementById('alerts-list'),
        consumptionMetricsTableBody: document.getElementById('consumption-metrics-table-body'),
        formMetricGroup: document.getElementById('form-metric-group'),
        formItem: document.getElementById('form-item'),
        formBOMTemplate: document.getElementById('form-bom-template'),
        modalItem: document.getElementById('modalItem'),
        modalBOMTemplate: document.getElementById('modalBOMTemplate'),
        modalItemTitle: document.getElementById('modal-item-title'),
        modalItemSubmit: document.getElementById('modal-item-submit'),
        modalBOMTitle: document.getElementById('modal-bom-title'),
        modalBOMSubmit: document.getElementById('modal-bom-submit'),
        itemInitialPurchaseSection: document.getElementById('item-initial-purchase-section'),
        itemInitialUnitCost: document.getElementById('item-initial-unit-cost'),
        btnRunConsumption: document.getElementById('btn-run-checkout-consumption'),
        btnRefreshItems: document.getElementById('btn-refresh-items'),
        btnRefreshGroups: document.getElementById('btn-refresh-groups'),
        btnRefreshBom: document.getElementById('btn-refresh-bom'),
        btnRefreshAlerts: document.getElementById('btn-refresh-alerts'),
        btnRefreshConsumptionMetrics: document.getElementById('btn-refresh-consumption-metrics'),
        itemCabinSelect: document.getElementById('item-cabin-select'),
        itemUnitSelect: document.getElementById('item-unit-select'),
        itemUnitCustom: document.getElementById('item-unit-custom'),
        metricGroupRoomChecklist: document.getElementById('metric-group-room-checklist'),
        bomRoomChecklist: document.getElementById('bom-room-checklist'),
        bomLinesContainer: document.getElementById('bom-lines-container'),
        btnAddBomLine: document.getElementById('btn-add-bom-line')
    };

    const isMasterAdmin = Boolean(window.isMasterAdmin);

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
            throw new Error(data.message || 'Error de comunicacion con inventario');
        }
        return data;
    };

    const money = (value) => Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const showError = (error) => {
        console.error(error);
        alert(error.message || 'Ocurrio un error inesperado');
    };

    const escapeHtml = (value) => String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const roomDisplayName = (room) => room?.propertyDetails?.name || room?.name || 'Habitacion';

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

    const populateItemCabinSelect = () => {
        if (!el.itemCabinSelect) return;
        el.itemCabinSelect.innerHTML = [
            '<option value="">Selecciona habitacion</option>',
            ...state.rooms.map((room) => `<option value="${room._id}">${escapeHtml(roomDisplayName(room))}</option>`)
        ].join('');
    };

    const renderRoomChecklist = (container, checkboxClass, helperText) => {
        if (!container) return;
        container.innerHTML = state.rooms.map((room) => `
            <label class="room-option-card flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="${checkboxClass}" value="${room._id}">
                <div>
                    <p class="mb-0 text-sm font-medium text-gray-800">${escapeHtml(roomDisplayName(room))}</p>
                    <p class="mb-0 text-xs text-gray-500">${helperText}</p>
                </div>
            </label>
        `).join('') || '<p class="text-gray-500 text-sm">No hay habitaciones disponibles.</p>';
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
        toggleItemUnitCustom();
        toggleInitialPurchaseSection();
    };

    const resetBOMFormMode = () => {
        state.editingBOMId = null;
        el.formBOMTemplate?.reset();
        if (el.modalBOMTitle) el.modalBOMTitle.textContent = 'Nueva Regla de Consumo BOM';
        if (el.modalBOMSubmit) el.modalBOMSubmit.textContent = 'Guardar BOM';
        setCheckedRooms('.bom-room-checkbox', []);
        setBomLines([]);
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
        const stockByCabin = data.stockByCabin || {};
        const lowStockItems = data.lowStockItems || [];

        if (el.totalItems) el.totalItems.textContent = data.totalItems || 0;
        if (el.lowStock) el.lowStock.textContent = data.lowStockCount || 0;
        if (el.roomCount) el.roomCount.textContent = Object.keys(stockByCabin).length;

        const totalUnits = Object.values(stockByCabin).reduce((sum, cabin) => sum + Number(cabin.stockUnits || 0), 0);
        if (el.totalUnits) el.totalUnits.textContent = money(totalUnits);

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
        state.items = result.data || [];
        const rows = state.items.map((item) => `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.itemType)}</td>
                <td>${escapeHtml(item.unit)}</td>
                <td>${item.stockCurrent}</td>
                <td>${item.stockMin}</td>
                <td>${escapeHtml(roomDisplayName(item.cabin))}</td>
                <td>
                    ${isMasterAdmin ? `
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
                    el.formItem.elements.cabin.value = item.cabin?._id || item.cabin || '';
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
                        if (!confirm('Se eliminara el item seleccionado. Esta accion no se puede deshacer.')) return;
                        await request(`/items/${button.getAttribute('data-delete-item')}`, { method: 'DELETE' });
                        await Promise.all([renderItems(), renderDashboard(), renderConsumptionMetrics()]);
                        alert('Item eliminado correctamente');
                    } catch (error) {
                        showError(error);
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
        state.metricGroups = result.data || [];
        if (el.metricGroupsList) {
            el.metricGroupsList.innerHTML = state.metricGroups.map((group) => `
                <div class="border border-gray-200 rounded-lg p-3">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <h4 class="font-semibold text-gray-800">${escapeHtml(group.name)}</h4>
                            <p class="text-xs text-gray-500 mt-1">${escapeHtml(group.description || 'Sin descripcion')}</p>
                        </div>
                        <span class="text-xs px-2 py-1 rounded bg-sky-100 text-sky-700">${(group.cabins || []).length} habitaciones</span>
                    </div>
                    <p class="text-sm text-gray-700 mt-3">${(group.cabins || []).map((room) => escapeHtml(roomDisplayName(room))).join(', ') || 'Sin habitaciones asignadas'}</p>
                </div>
            `).join('') || '<p class="text-gray-500">No hay grupos metricos registrados.</p>';
        }
    };

    const renderBOM = async () => {
        const result = await request('/bom-templates');
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
                                ${isMasterAdmin ? `<button type="button" class="btn btn-outline-primary btn-sm" data-edit-bom="${template._id}">Editar</button><button type="button" class="btn btn-outline-danger btn-sm" data-delete-bom="${template._id}">Desactivar</button>` : ''}
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Habitacion: ${escapeHtml(roomDisplayName(template.cabin))}</p>
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
                    setCheckedRooms('.bom-room-checkbox', [template.cabin?._id || template.cabin].filter(Boolean));
                    setBomLines(template.lines || []);
                    showModal(el.modalBOMTemplate);
                });
            });
            el.bomList.querySelectorAll('[data-delete-bom]').forEach((button) => {
                button.addEventListener('click', async () => {
                    try {
                        if (!confirm('La regla BOM se desactivara y dejara de aplicarse en consumos futuros.')) return;
                        await request(`/bom-templates/${button.getAttribute('data-delete-bom')}`, { method: 'DELETE' });
                        await renderBOM();
                        alert('Regla BOM desactivada correctamente');
                    } catch (error) {
                        showError(error);
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
                        <button class="btn btn-sm btn-outline-success" data-resolve-alert="${alertItem._id}">Resolver</button>
                    </div>
                    <p class="text-sm text-yellow-700 mt-2">${escapeHtml(alertItem.message)}</p>
                    <p class="text-xs text-yellow-600 mt-1">Item: ${escapeHtml(alertItem.item?.name || '-')} | Habitacion: ${escapeHtml(roomDisplayName(alertItem.cabin))}</p>
                </div>
            `).join('') || '<p class="text-gray-500">Sin alertas abiertas.</p>';

            el.alertsList.querySelectorAll('[data-resolve-alert]').forEach((button) => {
                button.addEventListener('click', async () => {
                    try {
                        await request(`/alerts/${button.getAttribute('data-resolve-alert')}/resolve`, { method: 'PUT' });
                        await Promise.all([renderAlerts(), renderDashboard()]);
                    } catch (error) {
                        showError(error);
                    }
                });
            });
        }
    };

    const renderConsumptionMetrics = async () => {
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
        state.rooms = Array.isArray(rooms) ? rooms : [];
        populateItemCabinSelect();
        renderRoomChecklist(el.metricGroupRoomChecklist, 'metric-group-room-checkbox', 'Se asociara al grupo para metricas');
        renderRoomChecklist(el.bomRoomChecklist, 'bom-room-checkbox', 'Se creara una regla individual para esta habitacion');
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
                    await request('/metric-groups', { method: 'POST', body: JSON.stringify(payload) });
                    el.formMetricGroup.reset();
                    setCheckedRooms('.metric-group-room-checkbox', []);
                    await Promise.all([renderMetricGroups(), renderConsumptionMetrics()]);
                    alert('Grupo metrico creado correctamente');
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
                    const isEditingItem = Boolean(state.editingItemId);
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
                    await request(path, { method, body: JSON.stringify(payload) });
                    resetItemFormMode();
                    hideModal(el.modalItem);
                    await Promise.all([renderItems(), renderDashboard(), renderConsumptionMetrics()]);
                    alert(isEditingItem ? 'Item actualizado correctamente' : 'Item creado correctamente');
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
                    await request(path, { method, body: JSON.stringify(payload) });
                    resetBOMFormMode();
                    hideModal(el.modalBOMTemplate);
                    await renderBOM();
                    alert(isEditingBOM ? 'Regla BOM actualizada correctamente' : 'Regla BOM creada correctamente');
                } catch (error) {
                    showError(error);
                }
            });
        }
    };

    const setupActions = () => {
        el.itemUnitSelect?.addEventListener('change', toggleItemUnitCustom);
        el.btnAddBomLine?.addEventListener('click', () => {
            el.bomLinesContainer?.appendChild(createBomLineRow());
        });
        if (el.btnRunConsumption) {
            el.btnRunConsumption.addEventListener('click', async () => {
                try {
                    toggleSpinner(true);
                    const result = await request('/cron/run-checkout-consumption', { method: 'POST' });
                    alert(`Consumo ejecutado. Reservas evaluadas: ${result.data?.totalCandidates || 0}`);
                    await Promise.all([renderAlerts(), renderDashboard(), renderConsumptionMetrics()]);
                } catch (error) {
                    showError(error);
                } finally {
                    toggleSpinner(false);
                }
            });
        }

        el.btnRefreshItems?.addEventListener('click', renderItems);
        el.btnRefreshGroups?.addEventListener('click', renderMetricGroups);
        el.btnRefreshBom?.addEventListener('click', renderBOM);
        el.btnRefreshAlerts?.addEventListener('click', renderAlerts);
        el.btnRefreshConsumptionMetrics?.addEventListener('click', renderConsumptionMetrics);
        el.modalItem?.addEventListener('hidden.bs.modal', resetItemFormMode);
        el.modalBOMTemplate?.addEventListener('hidden.bs.modal', resetBOMFormMode);
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
                renderMetricGroups(),
                renderBOM(),
                renderAlerts(),
                renderConsumptionMetrics()
            ]);
            ensureOneBomLine();
            toggleItemUnitCustom();
            toggleInitialPurchaseSection();
        } catch (error) {
            showError(error);
        } finally {
            toggleSpinner(false);
        }
    };

    initialize();
})();
