document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('investor_reservation_modal');
    if (!modal) return;

    const tipoReservaSelect = document.getElementById('inv_tipo_reserva');
    const includeSellerCommissionSwitch = document.getElementById('inv_include_seller_commission');
    const includeSellerCommissionLabel = document.querySelector('label[for="inv_include_seller_commission"]');
    const commissionStateBadge = document.getElementById('inv_commission_state_badge');

    const confirmedClientSection = document.getElementById('inv_confirmed_client_section');
    const provisionalClientSection = document.getElementById('inv_provisional_client_section');
    const clientSearchInput = document.getElementById('inv_lblClient');
    const clientOptionsContainer = document.getElementById('inv_client_options');
    const clientValueInput = document.getElementById('inv_lblClientValue');

    const clientFirstNameInput = document.getElementById('inv_client_first_name');
    const clientLastNameInput = document.getElementById('inv_client_last_name');
    const clientPhoneInput = document.getElementById('inv_client_phone');

    const dateRangeInput = document.getElementById('inv_date_range');
    const startDateInput = document.getElementById('inv_start_date');
    const endDateInput = document.getElementById('inv_end_date');
    const nightsInput = document.getElementById('inv_nights');

    const tipologiaFilter = document.getElementById('inv_tipologia_filter');
    const searchAvailabilityBtn = document.getElementById('inv_btn_search_availability');
    const searchAvailabilityBtnText = searchAvailabilityBtn?.querySelector('.inv-btn-text');
    const searchAvailabilityBtnSpinner = searchAvailabilityBtn?.querySelector('.inv-btn-spinner');
    const disponibilidadLoading = document.getElementById('inv_verificar_disponibilidad');

    const roomSelect = document.getElementById('inv_room_select');
    const roomIdInput = document.getElementById('inv_room_id');
    const maxOccupancyInput = document.getElementById('inv_max_occupancy');
    const paxSelect = document.getElementById('inv_pax');

    const totalInput = document.getElementById('inv_total');
    const totalSinComisionesInput = document.getElementById('inv_total_sin_comisiones');
    const costoBaseInput = document.getElementById('inv_costo_base');
    const calculatingPricesIndicator = document.getElementById('inv_calculando_precios');

    const saveBtn = document.getElementById('inv_save_reservation_btn');
    const saveBtnText = saveBtn?.querySelector('.inv-save-text');
    const saveBtnSpinner = saveBtn?.querySelector('.inv-save-spinner');
    const errorText = document.getElementById('inv_error_text');

    const saveClientBtn = document.getElementById('invBtnSaveClient');

    const newClientNameInput = document.getElementById('invTxtClientName');
    const newClientLastnameInput = document.getElementById('invTxtClientLastname');
    const newClientPhoneInput = document.getElementById('invTxtClientPhone');
    const newClientAddressInput = document.getElementById('invTxtClientAddress');
    const newClientEmailInput = document.getElementById('invTxtClientEmail');
    const newClientIdTypeInput = document.getElementById('invSlctClientIdType');
    const newClientIdNumberInput = document.getElementById('invTxtClientIdNumber');

    let availableRoomsCache = [];
    let allClientOptions = clientOptionsContainer
        ? Array.from(clientOptionsContainer.querySelectorAll('.inv-select-option'))
        : [];
    let isPricing = false;
    let isSaving = false;

    function syncSaveButtonState() {
        if (!saveBtn) return;
        saveBtn.disabled = isPricing || isSaving;
    }

    function syncPricingInteractiveControls() {
        if (roomSelect) roomSelect.disabled = isPricing;
        if (paxSelect) paxSelect.disabled = isPricing;
        if (includeSellerCommissionSwitch) includeSellerCommissionSwitch.disabled = isPricing;
    }

    function setError(message) {
        if (errorText) {
            errorText.textContent = message || '';
        }
    }

    function formatDateToES(isoDate) {
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
    }

    function getSwitchEnabled() {
        return !!includeSellerCommissionSwitch?.checked;
    }

    function updateSwitchLabel() {
        const isEnabled = getSwitchEnabled();

        if (includeSellerCommissionLabel) {
            includeSellerCommissionLabel.textContent = isEnabled
                ? 'Comisión de vendedor activada'
                : 'Comisión de vendedor desactivada';
        }

        if (commissionStateBadge) {
            commissionStateBadge.textContent = isEnabled ? 'ON' : 'OFF';
            commissionStateBadge.classList.toggle('bg-success', isEnabled);
            commissionStateBadge.classList.toggle('bg-danger', !isEnabled);
        }
    }

    function updateTipoReservaUI() {
        const isDeposit = tipoReservaSelect.value === 'por-depo';
        provisionalClientSection.style.display = isDeposit ? 'block' : 'none';
        confirmedClientSection.style.display = isDeposit ? 'none' : 'block';
    }

    function calculateNights() {
        if (!startDateInput.value || !endDateInput.value) {
            nightsInput.value = '';
            return;
        }

        const arrivalDate = new Date(`${startDateInput.value}T00:00:00`);
        const departureDate = new Date(`${endDateInput.value}T00:00:00`);
        const nights = Math.ceil((departureDate - arrivalDate) / (1000 * 60 * 60 * 24));
        nightsInput.value = nights > 0 ? nights : 0;
    }

    function resetPricing() {
        totalInput.value = '';
        totalSinComisionesInput.value = 0;
        costoBaseInput.value = 0;
    }

    function setLoadingState(target, isLoading) {
        if (target === 'search') {
            if (searchAvailabilityBtnText) searchAvailabilityBtnText.classList.toggle('d-none', isLoading);
            if (searchAvailabilityBtnSpinner) searchAvailabilityBtnSpinner.classList.toggle('d-none', !isLoading);
            if (disponibilidadLoading) disponibilidadLoading.style.display = isLoading ? 'block' : 'none';
        }

        if (target === 'save') {
            isSaving = isLoading;
            if (saveBtnText) saveBtnText.classList.toggle('d-none', isLoading);
            if (saveBtnSpinner) saveBtnSpinner.classList.toggle('d-none', !isLoading);
            syncSaveButtonState();
        }

        if (target === 'price') {
            isPricing = isLoading;
            if (calculatingPricesIndicator) {
                calculatingPricesIndicator.style.display = isLoading ? 'block' : 'none';
            }
            syncPricingInteractiveControls();
            syncSaveButtonState();
        }
    }

    function addNewClientOption(clientData) {
        if (!clientOptionsContainer) return;

        const option = document.createElement('div');
        option.className = 'inv-select-option';
        option.dataset.value = clientData.email;
        option.dataset.label = `${clientData.firstName} ${clientData.lastName} (${clientData.email})`;
        option.innerHTML = `<i class="fa fa-user-circle"></i> ${clientData.firstName} ${clientData.lastName} <small>(${clientData.email})</small>`;
        clientOptionsContainer.appendChild(option);
        allClientOptions = Array.from(clientOptionsContainer.querySelectorAll('.inv-select-option'));

        clientSearchInput.value = option.dataset.label;
        clientValueInput.value = option.dataset.value;
    }

    function filterClientOptions(text) {
        if (!clientOptionsContainer) return;
        const searchText = (text || '').toLowerCase();
        let visibleCount = 0;

        allClientOptions.forEach((option) => {
            const label = (option.dataset.label || option.textContent || '').toLowerCase();
            const visible = label.includes(searchText);
            option.style.display = visible ? 'block' : 'none';
            if (visible) visibleCount += 1;
        });

        clientOptionsContainer.style.display = visibleCount > 0 ? 'block' : 'none';
    }

    function resetRoomSelection() {
        roomSelect.innerHTML = '<option value="" selected disabled>Primero busca disponibilidad</option>';
        roomIdInput.value = '';
        maxOccupancyInput.value = '';
        paxSelect.innerHTML = '<option value="" selected disabled>Personas</option>';
        availableRoomsCache = [];
        resetPricing();
    }

    function getSelectedCategory() {
        const selected = tipologiaFilter.value;
        if (!selected || selected === 'all') {
            return ['all'];
        }
        return [selected];
    }

    async function fetchQuote(huespedes) {
        const categorias = getSelectedCategory();
        const huespedesNum = Number(huespedes);
        const requestHuespedes = Number.isFinite(huespedesNum) && huespedesNum > 0 ? huespedesNum : 0;

        const response = await fetch('/api/eventos/cotizaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                categorias,
                fechaLlegada: formatDateToES(startDateInput.value),
                fechaSalida: formatDateToES(endDateInput.value),
                huespedes: requestHuespedes,
                soloDisponibles: true,
                isInvestorSellerMode: true,
                includeSellerCommission: getSwitchEnabled()
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Error al obtener cotización');
        }

        return data;
    }

    async function searchAvailability() {
        setError('');

        if (!startDateInput.value || !endDateInput.value) {
            throw new Error('Selecciona un rango de fechas');
        }

        const arrivalDate = new Date(`${startDateInput.value}T00:00:00`);
        const departureDate = new Date(`${endDateInput.value}T00:00:00`);
        if (departureDate <= arrivalDate) {
            throw new Error('La fecha de salida debe ser posterior a la de llegada');
        }

        const data = await fetchQuote(0);
        availableRoomsCache = Array.isArray(data.chalets) ? data.chalets : [];

        roomSelect.innerHTML = '<option value="" selected disabled>Selecciona una habitación</option>';

        availableRoomsCache.forEach((room) => {
            const option = document.createElement('option');
            option.value = room.displayName || room.name;
            option.textContent = room.displayName || room.name;
            option.dataset.id = room.id;
            option.dataset.pax = room.maxPax;
            option.dataset.minPax = room.minPax;
            option.dataset.groupName = room.groupName || '';
            option.dataset.isGroup = room.isGroup ? 'true' : 'false';
            roomSelect.appendChild(option);
        });

        if (!availableRoomsCache.length) {
            throw new Error('No hay habitaciones disponibles para esas fechas');
        }

        roomIdInput.value = '';
        maxOccupancyInput.value = '';
        paxSelect.innerHTML = '<option value="" selected disabled>Personas</option>';
        resetPricing();
    }

    async function recalculateSelectedRoomPrice() {
        const selectedRoomId = roomIdInput.value;
        const selectedPax = Number(paxSelect.value);
        const selectedGroupName = roomIdInput.dataset.groupName || '';
        const isGroupedSelection = roomIdInput.dataset.isGrouped === 'true';

        if (!selectedRoomId || !selectedPax) {
            resetPricing();
            return;
        }

        setLoadingState('price', true);

        try {
            const data = await fetchQuote(selectedPax);
            let room = (data.chalets || []).find((chalet) => String(chalet.id) === String(selectedRoomId));

            if (!room && isGroupedSelection && selectedGroupName) {
                room = (data.chalets || []).find((chalet) => chalet.isGroup && chalet.groupName === selectedGroupName);

                if (room) {
                    roomIdInput.value = room.id;
                    const selectedOption = roomSelect.options[roomSelect.selectedIndex];
                    if (selectedOption) {
                        selectedOption.dataset.id = room.id;
                    }
                }
            }

            if (!room) {
                throw new Error('La habitación no coincide con la ocupación seleccionada para esta cotización. Ajusta huéspedes o elige otra habitación.');
            }

            const totalFinal = Number(room.totalPrice || 0);
            const totalSinComisiones = Number(room.totalPriceNoComs || 0);
            const costoBase = Number(room.totalCost || 0);

            totalInput.value = totalFinal.toFixed(2);
            totalSinComisionesInput.value = totalSinComisiones.toFixed(2);
            costoBaseInput.value = costoBase.toFixed(2);

            return {
                totalFinal,
                totalSinComisiones,
                costoBase,
                roomName: room.name || room.displayName || roomSelect.value
            };
        } finally {
            setLoadingState('price', false);
        }
    }

    function buildPaxOptions(maxPax, minPax = 1) {
        paxSelect.innerHTML = '<option value="" selected disabled>Personas</option>';
        const min = Number(minPax) > 0 ? Number(minPax) : 1;
        const max = Number(maxPax) > 0 ? Number(maxPax) : min;

        for (let value = min; value <= max; value += 1) {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = String(value);
            paxSelect.appendChild(option);
        }
    }

    function clearInvestorModal() {
        setError('');
        tipoReservaSelect.value = 'por-depo';
        includeSellerCommissionSwitch.checked = false;
        updateSwitchLabel();
        updateTipoReservaUI();

        clientSearchInput.value = '';
        clientValueInput.value = '';
        clientFirstNameInput.value = '';
        clientLastNameInput.value = '';
        clientPhoneInput.value = '';

        dateRangeInput.value = '';
        startDateInput.value = '';
        endDateInput.value = '';
        nightsInput.value = '';

        if (clientOptionsContainer) {
            clientOptionsContainer.style.display = 'none';
            allClientOptions.forEach((option) => {
                option.style.display = 'block';
                option.classList.remove('selected');
            });
        }

        tipologiaFilter.value = 'all';
        resetRoomSelection();
    }

    saveBtn.addEventListener('click', async function () {
        if (isPricing) {
            setError('Espera a que termine el cálculo de precio antes de crear la reserva.');
            return;
        }

        setError('');
        setLoadingState('save', true);

        try {
            const tipoReserva = tipoReservaSelect.value;
            if (!tipoReserva) {
                throw new Error('Selecciona un tipo de reserva');
            }

            if (!startDateInput.value || !endDateInput.value || !nightsInput.value) {
                throw new Error('Selecciona un rango de fechas válido');
            }

            if (!roomIdInput.value || !paxSelect.value) {
                throw new Error('Selecciona habitación y número de huéspedes');
            }

            const isDeposit = tipoReserva === 'por-depo';
            if (isDeposit) {
                if (!clientFirstNameInput.value.trim() || !clientLastNameInput.value.trim()) {
                    throw new Error('Para reserva tentativa debes capturar nombre y apellido del cliente');
                }
            } else if (!clientValueInput.value) {
                throw new Error('Para reserva confirmada debes seleccionar un cliente');
            }

            const currentQuote = await recalculateSelectedRoomPrice();
            if (!currentQuote || currentQuote.totalFinal <= 0) {
                throw new Error('No se pudo recalcular la cotización actual de la reserva');
            }

            const formData = {
                arrivalDate: startDateInput.value,
                departureDate: endDateInput.value,
                nNights: Number(nightsInput.value),
                habitacionId: roomIdInput.value,
                maxOccupation: Number(maxOccupancyInput.value || 0),
                pax: Number(paxSelect.value),
                total: Number(currentQuote.totalFinal.toFixed(2)),
                isDeposit,
                totalSinComisiones: Number(currentQuote.totalSinComisiones.toFixed(2)),
                costoBase: Number(currentQuote.costoBase.toFixed(2)),
                isInvestorSellerMode: true,
                includeSellerCommission: getSwitchEnabled()
            };

            if (isDeposit) {
                formData.clientFirstName = clientFirstNameInput.value.trim();
                formData.clientLastName = clientLastNameInput.value.trim();
                if (clientPhoneInput.value.trim()) {
                    formData.clientPhone = clientPhoneInput.value.trim();
                }
            } else {
                formData.clientEmail = clientValueInput.value;
            }

            const reservationResponse = await fetch('/api/eventos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const reservationData = await reservationResponse.json();
            if (!reservationResponse.ok) {
                throw new Error(reservationData.message || reservationData?.error?.[0]?.message || 'Error al crear la reserva');
            }

            const comisionBody = {
                precioMinimo: Number(currentQuote.totalFinal.toFixed(2)),
                precioMaximo: Number(currentQuote.totalFinal.toFixed(2)),
                costoBase: Number(currentQuote.costoBase.toFixed(2)),
                totalSinComisiones: Number(currentQuote.totalSinComisiones.toFixed(2)),
                precioAsignado: Number(currentQuote.totalFinal.toFixed(2)),
                chaletName: reservationData.assignedChaletName || currentQuote.roomName || roomSelect.value,
                habitacionId: roomIdInput.value,
                idReserva: reservationData.reservationId,
                arrivalDate: startDateInput.value,
                departureDate: endDateInput.value,
                nNights: Number(nightsInput.value),
                isInvestorSellerMode: true,
                includeSellerCommission: getSwitchEnabled()
            };

            const utilidadesResponse = await fetch('/api/utilidades/reserva', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(comisionBody)
            });

            const utilidadesData = await utilidadesResponse.json();
            if (!utilidadesResponse.ok) {
                throw new Error(utilidadesData.message || utilidadesData?.error?.[0]?.message || 'Error al generar utilidades');
            }

            await Swal.fire({
                icon: 'success',
                title: 'Reserva creada',
                text: reservationData.message || 'La reserva se creó correctamente',
                confirmButtonText: 'Aceptar'
            });

            clearInvestorModal();
            $('#investor_reservation_modal').modal('hide');
            window.location.href = `/api/eventos/${reservationData.reservationId}`;
        } catch (error) {
            setError(error.message || 'No fue posible crear la reserva');
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No fue posible crear la reserva',
                confirmButtonText: 'Aceptar'
            });
        } finally {
            setLoadingState('save', false);
        }
    });

    searchAvailabilityBtn.addEventListener('click', async function () {
        try {
            searchAvailabilityBtn.disabled = true;
            setLoadingState('search', true);
            await searchAvailability();
        } catch (error) {
            setError(error.message);
            Swal.fire({
                icon: 'warning',
                title: 'Disponibilidad',
                text: error.message,
                confirmButtonText: 'Aceptar'
            });
        } finally {
            searchAvailabilityBtn.disabled = false;
            setLoadingState('search', false);
        }
    });

    roomSelect.addEventListener('change', function () {
        setError('');
        const selectedOption = roomSelect.options[roomSelect.selectedIndex];
        const roomId = selectedOption?.dataset?.id || '';
        const maxPax = Number(selectedOption?.dataset?.pax || 0);
        const minPax = Number(selectedOption?.dataset?.minPax || 1);

        roomIdInput.value = roomId;
        roomIdInput.dataset.groupName = selectedOption?.dataset?.groupName || '';
        roomIdInput.dataset.isGrouped = selectedOption?.dataset?.isGroup || 'false';
        maxOccupancyInput.value = maxPax || '';
        buildPaxOptions(maxPax, minPax);
        resetPricing();
    });

    paxSelect.addEventListener('change', async function () {
        try {
            await recalculateSelectedRoomPrice();
        } catch (error) {
            setError(error.message);
        }
    });

    includeSellerCommissionSwitch.addEventListener('change', async function () {
        updateSwitchLabel();
        if (roomIdInput.value && paxSelect.value) {
            try {
                await recalculateSelectedRoomPrice();
            } catch (error) {
                setError(error.message);
            }
        }
    });

    tipoReservaSelect.addEventListener('change', function () {
        updateTipoReservaUI();
    });

    if (clientSearchInput && clientOptionsContainer) {
        clientSearchInput.addEventListener('input', function (event) {
            clientValueInput.value = '';
            filterClientOptions(event.target.value);
        });

        clientSearchInput.addEventListener('focus', function () {
            filterClientOptions(clientSearchInput.value);
        });

        clientOptionsContainer.addEventListener('click', function (event) {
            const option = event.target.closest('.inv-select-option');
            if (!option) return;

            clientSearchInput.value = option.dataset.label || option.textContent;
            clientValueInput.value = option.dataset.value || '';
            clientOptionsContainer.style.display = 'none';
        });

        document.addEventListener('click', function (event) {
            if (!event.target.closest('.inv-select-container')) {
                clientOptionsContainer.style.display = 'none';
            }
        });
    }

    tipologiaFilter.addEventListener('change', function () {
        resetRoomSelection();
    });

    flatpickr('#inv_date_range', {
        mode: 'range',
        dateFormat: 'd-m-Y',
        onChange: function (selectedDates) {
            if (selectedDates.length !== 2) {
                return;
            }

            startDateInput.value = selectedDates[0].toISOString().split('T')[0];
            endDateInput.value = selectedDates[1].toISOString().split('T')[0];
            calculateNights();
            resetRoomSelection();
        }
    });

    modal.addEventListener('hidden.bs.modal', function () {
        clearInvestorModal();
    });

    if (saveClientBtn) {
        saveClientBtn.addEventListener('click', async function () {
            const payload = {
                firstName: (newClientNameInput.value || '').trim(),
                lastName: (newClientLastnameInput.value || '').trim(),
                phone: (newClientPhoneInput.value || '').trim(),
                address: (newClientAddressInput.value || '').trim(),
                email: (newClientEmailInput.value || '').trim(),
                identificationType: newClientIdTypeInput.value,
                identificationNumber: (newClientIdNumberInput.value || '').trim()
            };

            if (!payload.firstName || !payload.lastName || !payload.email || !payload.identificationType || !payload.identificationNumber) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Datos incompletos',
                    text: 'Completa nombre, apellido, email y datos de identificación',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            try {
                saveClientBtn.disabled = true;
                const response = await fetch('/api/clientes/crear-cliente', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error?.[0]?.message || data?.message || 'Error al crear cliente');
                }

                addNewClientOption({
                    email: data.client.email,
                    firstName: data.client.firstName,
                    lastName: data.client.lastName
                });

                await Swal.fire({
                    icon: 'success',
                    title: 'Cliente creado',
                    text: data.message || 'Cliente guardado correctamente',
                    confirmButtonText: 'Aceptar'
                });

                $('#invClientEntryModal').modal('hide');
                $('#investor_reservation_modal').modal('show');

                newClientNameInput.value = '';
                newClientLastnameInput.value = '';
                newClientPhoneInput.value = '';
                newClientAddressInput.value = '';
                newClientEmailInput.value = '';
                newClientIdTypeInput.value = '';
                newClientIdNumberInput.value = '';
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'Error al crear cliente',
                    confirmButtonText: 'Aceptar'
                });
            } finally {
                saveClientBtn.disabled = false;
            }
        });
    }

    updateSwitchLabel();
    updateTipoReservaUI();
});
