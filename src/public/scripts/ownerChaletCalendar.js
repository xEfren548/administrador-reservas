document.addEventListener('DOMContentLoaded', function () {

    async function renderCalendar(idHabitacion) {
        const urlEventos = `/api/eventos/chalet/${idHabitacion}`;
        const urlHabitaciones = `/api/habitaciones/${idHabitacion}`;

        var calendarEl = document.getElementById('calendar');
        var calendar = new FullCalendar.Calendar(calendarEl, {
            locale: 'es',
            height: 'auto',
            expandRows: true,
            navLinks: true,
            editable: true,
            selectable: true,
            nowIndicator: true,
            dayMaxEvents: true,
            timeZone: 'UTC',

            headerToolbar: {
                start: 'dayGridMonth',
                center: 'title',
                end: 'today prev,next'
            },

            resourceAreaHeaderContent: 'Habitaciones',
            resourceGroupField: 'habitaciones',
            resources: async function (info, successCallback, failureCallback) {
                try {
                    const response = await fetch(urlHabitaciones);
                    if (!response.ok) {
                        throw new Error('Error al obtener los recursos');
                    }
                    const data = await response.json();
                    const resources = data.map(event => ({
                        id: event._id,
                        habitaciones: event.propertyDetails.accomodationType,
                        title: event.propertyDetails.name
                    }));
                    successCallback(resources);
                } catch (error) {
                    failureCallback(error);
                }
            },
            events: async function (info, successCallback, failureCallback) {
                try {
                    const response = await fetch(urlEventos);
                    if (!response.ok) {
                        throw new Error('Error al obtener los eventos');
                    }
                    const data = await response.json();
                    console.log('Eventos recibidos:', data);
                    const events = data
                    .filter(event => event.status !== 'cancelled')
                    .map(event => ({
                        id: event._id,
                        resourceId: event.resourceId,
                        title: event.title,
                        start: event.arrivalDate.split('T')[0],
                        end: event.departureDate.split('T')[0],
                        total: event.total,
                        clientId: event.client,
                        status: event.status,
                        // NO usar color: event.colorUsuario - interferirá con nuestros colores personalizados
                        clientName: event.clientName,
                        precioBaseTotal: event.precioBaseTotal,
                        montoPendiente: event.montoPendiente,
                        tipoReserva: event.tipoReserva,
                        infoReservaExterna: event.infoReservaExterna,
                        clienteProvisional: event.clienteProvisional,
                        nNights: event.nNights,
                        arrivalDate: event.arrivalDate,
                        departureDate: event.departureDate,
                        notes: event.notes,
                        allDay: true
                    }));
                    console.log('Eventos mapeados:', events);
                    successCallback(events);
                } catch (error) {
                    failureCallback(error);
                }
            },
            eventContent: function (info) {
                let background, textColor, borderColor;
                const tipoReserva = info.event.extendedProps.tipoReserva;
                const status = info.event.extendedProps.status;
                
                // Colores basados en tipo de reserva
                // TODAS las reservas de dueño (externas o personales) son MORADO
                if (tipoReserva === 'reserva-externa' || tipoReserva === 'reserva-dueno' || status === 'reserva de dueño') {
                    background = '#8b5cf6'; // Morado
                    textColor = '#fff';
                    borderColor = '#7c3aed';
                } else {
                    // Reservas NyN (status-based colors)
                    if (status === 'active') {
                        background = '#10b981'; // Verde
                        textColor = '#fff';
                        borderColor = '#059669';
                    } else if (status === 'playground') {
                        background = '#fbbf24'; // Amarillo
                        textColor = '#000';
                        borderColor = '#f59e0b';
                    } else if (status === 'pending') {
                        background = '#3b82f6'; // Azul
                        textColor = '#fff';
                        borderColor = '#2563eb';
                    } else {
                        background = '#6b7280'; // Gris
                        textColor = '#fff';
                        borderColor = '#4b5563';
                    }
                }

                const clientName = info.event.extendedProps.clientName;
                let precioBaseTotal = info.event.extendedProps.precioBaseTotal;
                let montoPendiente = info.event.extendedProps.montoPendiente;
                let precioBaseTotalMsg = (precioBaseTotal === null || precioBaseTotal === undefined) ? 'Reserva de dueño/inversionista' : `<div style="font-size: 11px;"><b>Total: $${precioBaseTotal.toFixed(2)}</b></div>`;
                let montoPendienteMsg = (montoPendiente === null || montoPendiente === undefined) ? 'Reserva de dueño/inversionista' : `<div style="font-size: 11px;"><b>Pendiente: $${montoPendiente.toFixed(2)}</b></div>`;

                const userPrivilege = document.querySelector('#privilege').value;
                let finalMsg = userPrivilege === 'Inversionistas' ? precioBaseTotalMsg : montoPendienteMsg;
                
                return {
                    html: `
                    <div class="p-1 rounded" style="
                        overflow: hidden; 
                        font-size: 12px; 
                        position: relative; 
                        cursor: pointer; 
                        font-family: 'Overpass', sans-serif;
                        background-color: ${background};
                        color: ${textColor};
                        border: 2px solid ${borderColor};
                        font-weight: 500;
                    ">
                        <div style="font-weight: 600;">${clientName}</div>
                        ${finalMsg}
                    </div>
                    `
                }
            },
            eventClick: async function(info) {
                const evento = info.event;
                await mostrarModalEdicion(evento);
            },
                eventMouseEnter: function (mouseEnterInfo) {
                    let el = mouseEnterInfo.el;
                    el.classList.add("relative");

                    let newEl = document.createElement("div");
                    let newElTitle = mouseEnterInfo.event.extendedProps.clientName;
                    let tipoReserva = mouseEnterInfo.event.extendedProps.tipoReserva;
                    let status = mouseEnterInfo.event.extendedProps.status;
                    
                    // Determinar el label del tipo de reserva
                    let tipoLabel = 'NyN';
                    if (tipoReserva === 'reserva-externa' || tipoReserva === 'reserva-dueno' || status === 'reserva de dueño') {
                        tipoLabel = 'Reserva de Dueño';
                    }

                    let precioBaseTotal = mouseEnterInfo.event.extendedProps.precioBaseTotal;
                    let montoPendiente = mouseEnterInfo.event.extendedProps.montoPendiente;
                    let precioBaseTotalMsg = (precioBaseTotal === null || precioBaseTotal === undefined) ? 
                        '<div>Reserva de dueño/inversionista</div>' : 
                        `<div><b>Precio total: $${precioBaseTotal.toFixed(2)}</b></div>`;
                    let montoPendienteMsg = (montoPendiente === null || montoPendiente === undefined) ? 
                        '<div>Reserva de dueño/inversionista</div>' : 
                        `<div><b>Monto pendiente: $${montoPendiente.toFixed(2)}</b></div>`;

                    const userPrivilege = document.querySelector('#privilege').value;
                    let finalMsg = userPrivilege === 'Inversionistas' ? precioBaseTotalMsg : montoPendienteMsg;

                    let newElStatus = status;
                    if (newElStatus === "pending") {
                        newElStatus = "Por Depo";
                    } else if (newElStatus === "reserva de dueño") {
                        newElStatus = "Dueño";
                    }
                    
                    newEl.innerHTML = `
                    <div class="fc-hoverable-event" style="position: absolute; top: 100%; left: 0; width: 300px; height: auto; background-color: #1f2937; z-index: 100000000 !important; border: 1px solid #374151; border-radius: 0.5rem; padding: 0.75rem; font-size: 14px; font-family: 'Inter', sans-serif; cursor: pointer; color: white;">
                        <strong style="color: #60a5fa;">${newElTitle}</strong>
                        <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #374151;">
                            <div style="margin-bottom: 0.25rem;"><b>Tipo:</b> ${tipoLabel}</div>
                            ${finalMsg}
                            <div><b>Estado:</b> ${newElStatus.toUpperCase()}</div>
                        </div>
                        <div style="margin-top: 0.5rem; font-size: 12px; color: #9ca3af;">${tipoLabel === 'Reserva de Dueño' ? 'Click para editar' : 'Click para ver detalles'}</div>
                    </div>
                `;
                    document.body.appendChild(newEl);

                    const rect = el.getBoundingClientRect();
                    const popupRect = newEl.firstElementChild.getBoundingClientRect();
                    const topPosition = rect.top - popupRect.height;
                    newEl.firstElementChild.style.left = `${rect.left}px`;
                    newEl.firstElementChild.style.top = topPosition < 0 ? `${rect.bottom}px` : `${rect.top - popupRect.height}px`;
                },
                eventMouseLeave: function () {
                    const hoverable = document.querySelector(".fc-hoverable-event");
                    if (hoverable) hoverable.remove();
                },
                eventDrop: async function (info) {
                    const event = info.event;

                    const confirmacion = await Swal.fire({
                        icon: 'warning',
                        title: '¿Estás seguro?',
                        text: 'Esta acción cambiará las fechas de la reserva.',
                        showCancelButton: true,
                        confirmButtonColor: '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: 'Sí, mover',
                        cancelButtonText: 'Cancelar',
                        background: '#212529',
                        color: '#fff',
                        buttonsStyling: false,
                        customClass: {
                            popup: 'bg-dark text-white border border-secondary',
                            confirmButton: 'btn btn-danger me-2',
                            cancelButton: 'btn btn-secondary'
                        }
                    });

                    if (confirmacion.isConfirmed) {
                        try {
                            const response = await fetch(`/api/eventos/${event.id}/modificar`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(info)
                            });

                            if (!response.ok) {
                                throw new Error('Error al actualizar fechas');
                            }

                            const data = await response.json();
                            console.log('Respuesta del servidor: ', data);

                            Swal.fire({
                                icon: 'success',
                                title: 'Fechas actualizadas',
                                showConfirmButton: false,
                                timer: 2500,
                                background: '#212529',
                                color: '#fff'
                            });
                        } catch (error) {
                            console.error('Error al actualizar fechas: ', error);
                            Swal.fire({
                                icon: 'error',
                                title: 'Error al actualizar fechas: ' + error.message,
                                showConfirmButton: false,
                                timer: 2500,
                                background: '#212529',
                                color: '#fff'
                            });
                        }
                    }

                    const hoverable = document.querySelector(".fc-hoverable-event");
                    if (hoverable) hoverable.remove();
                }
            });

        calendarEl.style.display = 'block';
        calendar.render();
    }

    const tipologiaHabitacionSelect = document.querySelector('#tipologia_habitacion');

    tipologiaHabitacionSelect.addEventListener('change', function () {
        const selectedOption = tipologiaHabitacionSelect.options[tipologiaHabitacionSelect.selectedIndex];
        const id = selectedOption.getAttribute('data-bs-id');
        renderCalendar(id);
    });

    // Función para mostrar modal de edición
    async function mostrarModalEdicion(evento) {
        const tipoReserva = evento.extendedProps.tipoReserva;
        const reservaId = evento.id;

        try {
            // Construir objeto de reserva desde los extendedProps del evento
            const reserva = {
                _id: evento.id,
                clienteProvisional: evento.extendedProps.clienteProvisional,
                arrivalDate: evento.extendedProps.arrivalDate,
                departureDate: evento.extendedProps.departureDate,
                nNights: evento.extendedProps.nNights,
                resourceId: evento.extendedProps.resourceId,
                infoReservaExterna: evento.extendedProps.infoReservaExterna,
                notes: evento.extendedProps.notes,
                total: evento.extendedProps.total,
                status: evento.extendedProps.status,
                tipoReserva: evento.extendedProps.tipoReserva
            };
            
            console.log('Datos de reserva desde evento:', reserva);
            console.log('infoReservaExterna:', reserva.infoReservaExterna);

            if (tipoReserva === 'reserva-externa') {
                await editarReservaExterna(reserva);
            } else if (tipoReserva === 'reserva-dueno') {
                await editarReservaDueno(reserva);
            } else {
                // Para reservas NyN, mostrar solo información sin editar
                await mostrarInfoReserva(reserva);
            }
        } catch (error) {
            console.error('Error obteniendo datos de reserva:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al obtener datos de la reserva: ' + error.message,
                confirmButtonText: 'Aceptar',
                background: '#212529',
                color: '#fff',
                buttonsStyling: false,
                customClass: {
                    popup: 'bg-dark text-white border border-secondary',
                    confirmButton: 'btn btn-danger'
                }
            });
        }
    }

    // Función para editar reserva externa
    async function editarReservaExterna(reserva) {
        try {
            const result = await Swal.fire({
                title: 'Editar Reserva Externa',
                html: `
                    <div class="text-start">
                        <h6 class="border-bottom pb-2 mb-3 text-info"><i class="fa fa-calendar me-2"></i>Información de la Reserva</h6>
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold">Nombre del cliente:</label>
                            <input type="text" id="edit-ext-cliente" class="form-control" 
                                value="${reserva.clienteProvisional || ''}" placeholder="Nombre del cliente">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold">Fecha de llegada:</label>
                            <input type="date" id="edit-ext-fechaLlegada" class="form-control" 
                                value="${reserva.arrivalDate ? new Date(reserva.arrivalDate).toISOString().split('T')[0] : ''}">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold">Fecha de salida:</label>
                            <input type="date" id="edit-ext-fechaSalida" class="form-control" 
                                value="${reserva.departureDate ? new Date(reserva.departureDate).toISOString().split('T')[0] : ''}">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold">Noches:</label>
                            <input type="number" id="edit-ext-noches" class="form-control" 
                                value="${reserva.nNights || 1}" min="1" readonly>
                        </div>
                        
                        <div class="mb-3">
                            <div id="edit-ext-disponibilidad-status" class="alert alert-info d-none">
                                <i class="fa fa-spinner fa-spin me-2"></i>Verificando disponibilidad...
                            </div>
                        </div>

                        <h6 class="border-bottom pb-2 mb-3 mt-4 text-warning"><i class="fa fa-money-bill me-2"></i>Información de Pago</h6>
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold">Plataforma:</label>
                            <select id="edit-plataforma" class="form-select">
                                <option value="Airbnb" ${reserva.infoReservaExterna?.plataforma === 'Airbnb' ? 'selected' : ''}>Airbnb</option>
                                <option value="Booking" ${reserva.infoReservaExterna?.plataforma === 'Booking' ? 'selected' : ''}>Booking.com</option>
                                <option value="Directo" ${reserva.infoReservaExterna?.plataforma === 'Directo' ? 'selected' : ''}>Reserva Directa</option>
                                <option value="WhatsApp" ${reserva.infoReservaExterna?.plataforma === 'WhatsApp' ? 'selected' : ''}>WhatsApp</option>
                                <option value="Facebook" ${reserva.infoReservaExterna?.plataforma === 'Facebook' ? 'selected' : ''}>Facebook</option>
                                <option value="Instagram" ${reserva.infoReservaExterna?.plataforma === 'Instagram' ? 'selected' : ''}>Instagram</option>
                                <option value="Otro" ${reserva.infoReservaExterna?.plataforma === 'Otro' ? 'selected' : ''}>Otra</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-bold">Precio por noche:</label>
                            <input type="number" id="edit-precioNoche" class="form-control" 
                                value="${reserva.infoReservaExterna?.precioExternoNoche || 0}" step="0.01">
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-bold">Comisión plataforma:</label>
                            <input type="number" id="edit-comision" class="form-control" 
                                value="${reserva.infoReservaExterna?.comisionPlataforma || 0}" step="0.01">
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-bold">Estado de pago:</label>
                            <select id="edit-estadoPago" class="form-select">
                                <option value="Pendiente" ${reserva.infoReservaExterna?.estadoPago === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="Pagado" ${reserva.infoReservaExterna?.estadoPago === 'Pagado' ? 'selected' : ''}>Pagado</option>
                                <option value="Parcial" ${reserva.infoReservaExterna?.estadoPago === 'Parcial' ? 'selected' : ''}>Parcial</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-bold">Monto pagado:</label>
                            <input type="number" id="edit-montoPagado" class="form-control" 
                                value="${reserva.infoReservaExterna?.montoPagado || 0}" step="0.01">
                        </div>
                    </div>
                `,
                width: '600px',
                background: '#212529',
                color: '#fff',
                showCancelButton: true,
                confirmButtonText: 'Guardar cambios',
                cancelButtonText: 'Cancelar',
                buttonsStyling: false,
                customClass: {
                    popup: 'bg-dark text-white border border-secondary',
                    confirmButton: 'btn btn-success me-2',
                    cancelButton: 'btn btn-secondary'
                },
                didOpen: () => {
                    const fechaLlegada = document.getElementById('edit-ext-fechaLlegada');
                    const fechaSalida = document.getElementById('edit-ext-fechaSalida');
                    const noches = document.getElementById('edit-ext-noches');
                    const disponibilidadStatus = document.getElementById('edit-ext-disponibilidad-status');

                    async function validarDisponibilidad() {
                        if (fechaLlegada.value && fechaSalida.value) {
                            const llegada = new Date(fechaLlegada.value);
                            const salida = new Date(fechaSalida.value);
                            
                            if (salida <= llegada) {
                                disponibilidadStatus.className = 'alert alert-warning';
                                disponibilidadStatus.innerHTML = '<i class="fa fa-exclamation-triangle me-2"></i>La fecha de salida debe ser posterior a la llegada';
                                disponibilidadStatus.classList.remove('d-none');
                                return false;
                            }

                            const diff = Math.ceil((salida - llegada) / (1000 * 60 * 60 * 24));
                            noches.value = diff > 0 ? diff : 1;

                            disponibilidadStatus.className = 'alert alert-info';
                            disponibilidadStatus.innerHTML = '<i class="fa fa-spinner fa-spin me-2"></i>Verificando disponibilidad...';
                            disponibilidadStatus.classList.remove('d-none');

                            try {
                                const response = await fetch(`/api/check-availability/?resourceId=${reserva.resourceId}&arrivalDate=${fechaLlegada.value}&departureDate=${fechaSalida.value}&isForOwner=true&eventId=${reserva._id}`);
                                const result = await response.json();

                                if (result.available) {
                                    disponibilidadStatus.className = 'alert alert-success';
                                    disponibilidadStatus.innerHTML = '<i class="fa fa-check-circle me-2"></i>La cabaña está disponible en estas fechas';
                                    return true;
                                } else {
                                    disponibilidadStatus.className = 'alert alert-danger';
                                    disponibilidadStatus.innerHTML = '<i class="fa fa-times-circle me-2"></i>La cabaña NO está disponible en estas fechas';
                                    return false;
                                }
                            } catch (error) {
                                disponibilidadStatus.className = 'alert alert-warning';
                                disponibilidadStatus.innerHTML = '<i class="fa fa-exclamation-triangle me-2"></i>Error al verificar disponibilidad';
                                return false;
                            }
                        }
                    }

                    fechaLlegada.addEventListener('change', validarDisponibilidad);
                    fechaSalida.addEventListener('change', validarDisponibilidad);
                },
                preConfirm: async () => {
                    const disponibilidadStatus = document.getElementById('edit-ext-disponibilidad-status');
                    if (disponibilidadStatus.classList.contains('alert-danger')) {
                        Swal.showValidationMessage('Las fechas seleccionadas no están disponibles');
                        return false;
                    }

                    return {
                        cliente: document.getElementById('edit-ext-cliente').value,
                        fechaLlegada: document.getElementById('edit-ext-fechaLlegada').value,
                        fechaSalida: document.getElementById('edit-ext-fechaSalida').value,
                        noches: parseInt(document.getElementById('edit-ext-noches').value),
                        plataforma: document.getElementById('edit-plataforma').value,
                        precioNoche: parseFloat(document.getElementById('edit-precioNoche').value),
                        comision: parseFloat(document.getElementById('edit-comision').value),
                        estadoPago: document.getElementById('edit-estadoPago').value,
                        montoPagado: parseFloat(document.getElementById('edit-montoPagado').value)
                    };
                }
            });

            if (result.isConfirmed && result.value) {
                try {
                    const response = await fetch(`/api/eventos/reserva-externa/${reserva._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clienteProvisional: result.value.cliente,
                            arrivalDate: result.value.fechaLlegada,
                            departureDate: result.value.fechaSalida,
                            nNights: result.value.noches,
                            infoReservaExterna: {
                                plataforma: result.value.plataforma,
                                precioExternoNoche: result.value.precioNoche,
                                comisionPlataforma: result.value.comision,
                                estadoPago: result.value.estadoPago,
                                montoPagado: result.value.montoPagado
                            }
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        await Swal.fire({
                            icon: 'success',
                            title: '¡Completado!',
                            text: 'Reserva actualizada correctamente.',
                            confirmButtonText: 'Aceptar',
                            background: '#212529',
                            color: '#fff',
                            buttonsStyling: false,
                            customClass: {
                                popup: 'bg-dark text-white border border-secondary',
                                confirmButton: 'btn btn-success'
                            }
                        });
                        window.location.reload();
                    } else {
                        throw new Error(data.message || 'Error al actualizar');
                    }
                } catch (error) {
                    console.error('Error actualizando reserva:', error);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Error al actualizar la reserva: ' + error.message,
                        confirmButtonText: 'Aceptar',
                        background: '#212529',
                        color: '#fff',
                        buttonsStyling: false,
                        customClass: {
                            popup: 'bg-dark text-white border border-secondary',
                            confirmButton: 'btn btn-danger'
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error en modal:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al abrir el modal: ' + error.message,
                confirmButtonText: 'Aceptar',
                background: '#212529',
                color: '#fff',
                buttonsStyling: false,
                customClass: {
                    popup: 'bg-dark text-white border border-secondary',
                    confirmButton: 'btn btn-danger'
                }
            });
        }
    }

    // Función para editar reserva de dueño
    async function editarReservaDueno(reserva) {
        try {
            const result = await Swal.fire({
                title: 'Editar Reserva de Dueño',
                html: `
                    <div class="text-start">
                        <div class="mb-3">
                            <label class="form-label fw-bold">Nombre del cliente:</label>
                            <input type="text" id="edit-dueno-cliente" class="form-control" 
                                value="${reserva.clienteProvisional || ''}" placeholder="Nombre del cliente">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold">Fecha de llegada:</label>
                            <input type="date" id="edit-dueno-fechaLlegada" class="form-control" 
                                value="${reserva.arrivalDate ? new Date(reserva.arrivalDate).toISOString().split('T')[0] : ''}">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold">Fecha de salida:</label>
                            <input type="date" id="edit-dueno-fechaSalida" class="form-control" 
                                value="${reserva.departureDate ? new Date(reserva.departureDate).toISOString().split('T')[0] : ''}">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold">Noches:</label>
                            <input type="number" id="edit-dueno-noches" class="form-control" 
                                value="${reserva.nNights || 1}" min="1" readonly>
                        </div>
                        
                        <div class="mb-3">
                            <div id="edit-dueno-disponibilidad-status" class="alert alert-info d-none">
                                <i class="fa fa-spinner fa-spin me-2"></i>Verificando disponibilidad...
                            </div>
                        </div>
                    </div>
                `,
                width: '500px',
                background: '#212529',
                color: '#fff',
                showCancelButton: true,
                confirmButtonText: 'Guardar cambios',
                cancelButtonText: 'Cancelar',
                buttonsStyling: false,
                customClass: {
                    popup: 'bg-dark text-white border border-secondary',
                    confirmButton: 'btn btn-success me-2',
                    cancelButton: 'btn btn-secondary'
                },
                didOpen: () => {
                    const fechaLlegada = document.getElementById('edit-dueno-fechaLlegada');
                    const fechaSalida = document.getElementById('edit-dueno-fechaSalida');
                    const noches = document.getElementById('edit-dueno-noches');
                    const disponibilidadStatus = document.getElementById('edit-dueno-disponibilidad-status');

                    async function validarDisponibilidad() {
                        if (fechaLlegada.value && fechaSalida.value) {
                            const llegada = new Date(fechaLlegada.value);
                            const salida = new Date(fechaSalida.value);
                            
                            if (salida <= llegada) {
                                disponibilidadStatus.className = 'alert alert-warning';
                                disponibilidadStatus.innerHTML = '<i class="fa fa-exclamation-triangle me-2"></i>La fecha de salida debe ser posterior a la llegada';
                                disponibilidadStatus.classList.remove('d-none');
                                return false;
                            }

                            const diff = Math.ceil((salida - llegada) / (1000 * 60 * 60 * 24));
                            noches.value = diff > 0 ? diff : 1;

                            disponibilidadStatus.className = 'alert alert-info';
                            disponibilidadStatus.innerHTML = '<i class="fa fa-spinner fa-spin me-2"></i>Verificando disponibilidad...';
                            disponibilidadStatus.classList.remove('d-none');

                            try {
                                const response = await fetch(`/api/check-availability/?resourceId=${reserva.resourceId}&arrivalDate=${fechaLlegada.value}&departureDate=${fechaSalida.value}&isForOwner=true&eventId=${reserva._id}`);
                                const result = await response.json();

                                if (result.available) {
                                    disponibilidadStatus.className = 'alert alert-success';
                                    disponibilidadStatus.innerHTML = '<i class="fa fa-check-circle me-2"></i>La cabaña está disponible en estas fechas';
                                    return true;
                                } else {
                                    disponibilidadStatus.className = 'alert alert-danger';
                                    disponibilidadStatus.innerHTML = '<i class="fa fa-times-circle me-2"></i>La cabaña NO está disponible en estas fechas';
                                    return false;
                                }
                            } catch (error) {
                                disponibilidadStatus.className = 'alert alert-warning';
                                disponibilidadStatus.innerHTML = '<i class="fa fa-exclamation-triangle me-2"></i>Error al verificar disponibilidad';
                                return false;
                            }
                        }
                    }

                    fechaLlegada.addEventListener('change', validarDisponibilidad);
                    fechaSalida.addEventListener('change', validarDisponibilidad);
                },
                preConfirm: async () => {
                    const disponibilidadStatus = document.getElementById('edit-dueno-disponibilidad-status');
                    if (disponibilidadStatus.classList.contains('alert-danger')) {
                        Swal.showValidationMessage('Las fechas seleccionadas no están disponibles');
                        return false;
                    }

                    return {
                        cliente: document.getElementById('edit-dueno-cliente').value,
                        fechaLlegada: document.getElementById('edit-dueno-fechaLlegada').value,
                        fechaSalida: document.getElementById('edit-dueno-fechaSalida').value,
                        noches: parseInt(document.getElementById('edit-dueno-noches').value)
                    };
                }
            });

            if (result.isConfirmed && result.value) {
                try {
                    const response = await fetch(`/api/eventos/reserva-dueno/${reserva._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clienteProvisional: result.value.cliente,
                            arrivalDate: result.value.fechaLlegada,
                            departureDate: result.value.fechaSalida,
                            nNights: result.value.noches
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        await Swal.fire({
                            icon: 'success',
                            title: '¡Completado!',
                            text: 'Reserva actualizada correctamente.',
                            confirmButtonText: 'Aceptar',
                            background: '#212529',
                            color: '#fff',
                            buttonsStyling: false,
                            customClass: {
                                popup: 'bg-dark text-white border border-secondary',
                                confirmButton: 'btn btn-success'
                            }
                        });
                        window.location.reload();
                    } else {
                        throw new Error(data.message || 'Error al actualizar');
                    }
                } catch (error) {
                    console.error('Error actualizando reserva:', error);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Error al actualizar la reserva: ' + error.message,
                        confirmButtonText: 'Aceptar',
                        background: '#212529',
                        color: '#fff',
                        buttonsStyling: false,
                        customClass: {
                            popup: 'bg-dark text-white border border-secondary',
                            confirmButton: 'btn btn-danger'
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error en modal:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al abrir el modal: ' + error.message,
                confirmButtonText: 'Aceptar',
                background: '#212529',
                color: '#fff',
                buttonsStyling: false,
                customClass: {
                    popup: 'bg-dark text-white border border-secondary',
                    confirmButton: 'btn btn-danger'
                }
            });
        }
    }

    // Función para mostrar información de reserva NyN (solo lectura)
    async function mostrarInfoReserva(reserva) {
        const fechaLlegada = reserva.arrivalDate ? new Date(reserva.arrivalDate).toLocaleDateString('es-MX') : 'N/A';
        const fechaSalida = reserva.departureDate ? new Date(reserva.departureDate).toLocaleDateString('es-MX') : 'N/A';
        const clienteNombre = reserva.clienteProvisional || 'N/A';
        const noches = reserva.nNights || 0;
        const total = reserva.total || 0;
        const status = reserva.status || 'N/A';

        let comentariosHtml = '';
        if (reserva.notes && reserva.notes.length > 0) {
            comentariosHtml = '<h6 class="border-bottom pb-2 mb-2 text-info mt-3">Comentarios</h6>';
            reserva.notes.forEach((note, index) => {
                comentariosHtml += `
                    <div class="alert alert-secondary mb-2">
                        <small>${note.texto}</small>
                    </div>
                `;
            });
        }

        await Swal.fire({
            title: '<h4 class="text-white">Información de Reserva</h4>',
            html: `
                <div class="text-start">
                    <div class="mb-2"><strong>Cliente:</strong> ${clienteNombre}</div>
                    <div class="mb-2"><strong>Llegada:</strong> ${fechaLlegada}</div>
                    <div class="mb-2"><strong>Salida:</strong> ${fechaSalida}</div>
                    <div class="mb-2"><strong>Noches:</strong> ${noches}</div>
                    <div class="mb-2"><strong>Total:</strong> $${total.toFixed(2)}</div>
                    <div class="mb-2"><strong>Estado:</strong> ${status}</div>
                    ${comentariosHtml}
                    <div class="alert alert-warning mt-3">
                        <small><i class="fa fa-info-circle me-2"></i>Las reservas NyN no se pueden editar desde esta vista</small>
                    </div>
                </div>
            `,
            background: '#212529',
            color: '#fff',
            confirmButtonText: 'Cerrar',
            buttonsStyling: false,
            customClass: {
                popup: 'bg-dark text-white border border-secondary',
                confirmButton: 'btn btn-primary'
            },
            width: '500px'
        });
    }

});
