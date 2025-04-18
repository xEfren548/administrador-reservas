document.addEventListener('DOMContentLoaded', function () {

    async function renderCalendar(idHabitacion) {
        const urlEventos = `/api/eventos/chalet/${idHabitacion}`;
        const urlHabitaciones = `/api/habitaciones/${idHabitacion}`;
        const urlClientes = '/api/clientes/show-clients';

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
            timeZone: 'America/Mexico_City',

            headerToolbar: {
                start: 'dayGridMonth', // listMonth
                center: 'title',
                end: 'today prev,next' // will normally be on the right. if RTL, will be on the left
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
                    console.log(data);
                    const events = data
                        .filter(event => event.status !== 'cancelled') // Filter out cancelled events
                        .map(event => ({
                            id: event._id,
                            resourceId: event.resourceId,
                            title: event.title,
                            start: event.arrivalDate.split('T')[0],
                            end: event.departureDate.split('T')[0],
                            url: event.url,
                            total: event.total,
                            clientId: event.client,
                            status: event.status,
                            color: event.colorUsuario,
                            clientName: event.clientName,
                            creadaPor: event.creadaPor,
                            allDay: true
                        }));
                    successCallback(events);
                } catch (error) {
                    failureCallback(error);
                }
            },
            eventContent: function (info) {
                // let background, textColor;
                // if (info.event.extendedProps.status === 'active') {
                //     background = 'bg-success';
                //     textColor = 'text-white';
                // } else if (info.event.extendedProps.status === 'playground') {
                //     background = 'bg-warning';
                //     textColor = 'text-black-50';
                // } else if (info.event.extendedProps.status === 'cancelled') {
                //     background = 'bg-danger';
                //     textColor = 'text-white';
                // } else if (info.event.extendedProps.status === 'pending') {
                //     background = 'bg-info';
                //     textColor = 'text-black';
                // }
                const color = info.backgroundColor || '#0dcaf0';
                const clientName = info.event.extendedProps.clientName;
                const creadaPor = info.event.extendedProps.creadaPor;
                let total = info.event.extendedProps.total
                let totalMsg = total === undefined ? `<div>Reserva de dueño/inversionista</div>` : `<div><b>Total: $ ${total}</b></div>`

                if ( clientName === "Fecha Bloqueada" ) {
                    return {
                        html: `
                        <div class="p-1 rounded bg-gradient text-black" style="overflow: hidden; font-size: 12px; position: relative;  cursor: pointer; font-family: 'Overpass', sans-serif; background-color: ${color} !important;">
                            <div class="font-weight-bold">${clientName}</div>
                        </div>
                        `
                    }
                }

                return {
                    html: `
                    <div class="p-1 rounded bg-gradient text-black" style="overflow: hidden; font-size: 12px; position: relative;  cursor: pointer; font-family: 'Overpass', sans-serif; background-color: ${color} !important;">
                        <div>${clientName}</div>
                        ${totalMsg}
                        <div><b>Creada por: ${creadaPor}</b></div>
                    </div>
                    `
                };
            },
            eventMouseEnter: function (mouseEnterInfo) {
                let el = mouseEnterInfo.el;
                el.classList.add("relative");

                let newEl = document.createElement("div");
                let newElTitle = mouseEnterInfo.event.id;
                let newElTotal = mouseEnterInfo.event.extendedProps.total;
                let newElStatus = mouseEnterInfo.event.extendedProps.status;
                if (newElStatus === "pending"){
                    newElStatus = "Por Depo"    
                }
                newEl.innerHTML = `
                    <div class="fc-hoverable-event" style="position: absolute; top: 100%; left: 0; width: 300px; height: auto; background-color: black; z-index: 100000000 !important; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.75rem; font-size: 14px; font-family: 'Inter', sans-serif; cursor: pointer;">
                        <strong>${newElTitle}</strong>
                        <div>Total: $${newElTotal}</div>
                        <div>Status: <b>${newElStatus.toUpperCase()}</b></div>
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
                document.querySelector(".fc-hoverable-event").remove();
            },
            eventDrop: async function (info) {
                const event = info.event;
                const newEventStart = info.event.start;
                const eventDateStart = new Date(newEventStart);
                idReserva = event.id;
    
                const newEventEnd = info.event.end;
                const eventDateEnd = new Date(newEventEnd);
                const comisionVendedor = info.event.extendedProps.comisionVendedor;
                const totalViejo = info.event.extendedProps.total;
                const resourceId = (info.newResource && info.newResource.id) || info.el.fcSeg.eventRange.def.resourceIds[0];

                const hoverableEventElement = document.querySelector(".fc-hoverable-event");
                if (hoverableEventElement) {
                    hoverableEventElement.remove();
                }
                const nuevoTotal = await obtenerNuevoTotal(resourceId, eventDateStart, eventDateEnd, comisionVendedor);
                let diferencia = nuevoTotal - totalViejo; // 2650 - 3250 
                
                const mensaje = `Esta acción cambiará las fechas de la reserva y el nuevo total sería de $${nuevoTotal} (Diferencia de $${diferencia})`

                const confirmacion = await Swal.fire({
                    icon: 'warning',
                    title: '¿Estás seguro?',
                    text: mensaje,
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Sí, mover',
                    cancelButtonText: 'Cancelar'
                });

                if (confirmacion.isConfirmed) {
                    const disponible = await availableDate(resourceId, eventDateStart, eventDateEnd, idReserva);

                    if (!disponible) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Fechas no disponibles. Intenta con otras fechas.'
                        });
                        info.revert();
                        return;
                    }

                    const eventData = {
                        id: info.event.id,
                        allDay: info.event.allDay,
                        title: info.event.title,
                        start: eventDateStart,
                        end: eventDateEnd,
                        extendedProps: {
                            ...info.event.extendedProps,
                            nuevoTotal: nuevoTotal
                        }
                    };

                    const newResource = info.newResource ? { id: info.newResource.id } : null;

                    try {
                        const response = await fetch(`/api/eventos/${event.id}/modificar`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ event: eventData, newResource: newResource })
                        });
                        const data = await response.json();

                        if (response.ok) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Fechas  y precios actualizados',
                                showConfirmButton: true,
                                // timer: 2500
                            }).then((result) => {
                                window.location.reload();
                            })
                        } else {
                            throw new Error(data.message || 'Error al actualizar fechas');
                        }
                    } catch (error) {
                        console.error('Error al actualizar fechas: ', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error al actualizar fechas: ' + error.message,
                            showConfirmButton: false,
                            timer: 2500
                        });
                        info.revert();
                    }
                } else {
                    info.revert();
                    return;
                }

                // document.querySelector(".fc-hoverable-event").remove();
            },
            eventDidMount: function (info) {
                info.el.addEventListener('contextmenu', function (event) {
                    event.preventDefault();
                    showContextMenu(event, info.event);
                });
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

    var contextMenu = document.getElementById('context-menu');
    const moveToActiveEl = document.getElementById('move-to-active');
    const moveToPlaygroundEl = document.getElementById('move-to-playground');
    var currentEvent;

    function showContextMenu(event, calendarEvent) {
        currentEvent = calendarEvent;
        contextMenu.style.display = 'block';
        if (currentEvent.extendedProps.status === 'active') {
            moveToActiveEl.style.display = 'none';
            moveToPlaygroundEl.style.display = 'block';
        } else if (currentEvent.extendedProps.status === 'playground') {
            moveToPlaygroundEl.style.display = 'none';
            moveToActiveEl.style.display = 'block';
        }
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
    }

    document.addEventListener('click', function () {
        contextMenu.style.display = 'none';
    });

    document.getElementById('edit').addEventListener('click', function () {
        console.log(currentEvent.url);
        window.location.replace(currentEvent.url)
    });

    document.getElementById('delete').addEventListener('click', async function () {
        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: '¿Estás seguro?',
            text: 'Esta acción moverá la reserva a cancelada.',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, mover',
            cancelButtonText: 'Cancelar'
        });

        try {

            if (confirmacion.isConfirmed) {
                const response = await fetch(`/api/eventos/move-to-playground`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        idReserva: currentEvent.id,
                        status: 'cancelled'
                    })
                });
                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Reserva movida a cancelada',
                        text: 'La reserva ha sido movida a cancelada.',
                        showConfirmButton: false,
                        timer: 3000
                    }).then((result) => {

                        window.location.reload();

                    })
                } else {
                    throw new Error('Error al mover reserva a cancelada');
                }

            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un error al mover la reserva al Playground.' + error.message,
                showConfirmButton: false,
                timer: 3000
            });
        }
    });

    document.getElementById('move-to-playground').addEventListener('click', async function () {
        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: '¿Estás seguro?',
            text: 'Esta acción moverá la reserva al Playground.',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, mover',
            cancelButtonText: 'Cancelar'
        });

        try {

            if (confirmacion.isConfirmed) {
                const response = await fetch(`/api/eventos/move-to-playground`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        idReserva: currentEvent.id,
                        status: 'playground'
                    })
                });
                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Reserva movida al playground',
                        text: 'La reserva ha sido movida al Playground.',
                        showConfirmButton: false,
                        timer: 3000
                    }).then((result) => {

                        window.location.reload();

                    })
                } else {
                    throw new Error('Error al mover reserva a playground')
                }

            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un error al mover la reserva al Playground.' + error.message,
                showConfirmButton: false,
                timer: 3000
            });
        }

    });

    document.getElementById('move-to-active').addEventListener('click', async function () {
        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: '¿Estás seguro?',
            text: 'Esta acción moverá la reserva a activa.',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, mover',
            cancelButtonText: 'Cancelar'
        });

        try {

            if (confirmacion.isConfirmed) {
                const response = await fetch(`/api/eventos/move-to-playground`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        idReserva: currentEvent.id,
                        status: 'active'
                    })
                });
                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Reserva activa',
                        text: 'La reserva ha sido movida a activa.',
                        showConfirmButton: false,
                        timer: 3000
                    }).then((result) => {

                        window.location.reload();

                    })
                } else {
                    throw new Error('Error al mover reserva a activa');
                }

            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                showConfirmButton: false,
                timer: 3000
            });
        }

    });

    // Create reservation
    let preciosTotalesGlobal = 0
    let precioMinimoPermitido = 0
    let comisionesReserva = 0

    const totalCostoBaseInput = document.querySelector("#total-costo-base")
    let totalSinComisiones = document.querySelector("#total-sin-comisiones")

    if (totalSinComisiones.value === undefined || totalSinComisiones.value === null || !totalSinComisiones.value) {
        totalSinComisiones.value = 0
    }

    function calculateNightDifference() {
        console.log('Desde calcular noches')
        const arrivalValue = new Date(arrivalDate.value);
        const departureValue = new Date(departureDate.value);

        // Verifica si las fechas son válidas
        if (!isNaN(arrivalValue) && !isNaN(departureValue) && departureValue >= arrivalValue) {
            const timeDifference = departureValue.getTime() - arrivalValue.getTime();
            const nightDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)); // Calcula la diferencia en días

            nightsInput.value = nightDifference
        } else {
            nightsInput.value = 0
        }
    }

    async function showAvailableChalets() {

        const arrivalValue = new Date(`${arrivalDate.value}T00:00:00`);
        const departureValue = new Date(`${departureDate.value}T00:00:00`);
        const tipologiaHabitacionInput = document.querySelector('#tipologia_habitacion_reserva');
        const options = tipologiaHabitacionInput.querySelectorAll('option');

        const verificarDisponibilidadElement = document.getElementById('verificar-disponibilidad');

        const dataBsIds = [];


        try {
            if (!isNaN(arrivalValue) && !isNaN(departureValue) && departureValue >= arrivalValue) {

                console.log(arrivalValue)
                console.log(departureValue)


                tipologiaHabitacionInput.disabled = true;
                verificarDisponibilidadElement.style.display = 'block';

                const arrivalYear = arrivalValue.getFullYear();
                const arrivalMonth = (arrivalValue.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
                const arrivalDay = arrivalValue.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
                const arrivalDate = `${arrivalYear}-${arrivalMonth}-${arrivalDay}`;

                const departureYear = departureValue.getFullYear();
                const departureMonth = (departureValue.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
                const departureDay = departureValue.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
                const departureDate = `${departureYear}-${departureMonth}-${departureDay}`;

                console.log(arrivalDate)
                console.log(departureDate)


                options.forEach(option => {
                    const dataBsId = option.getAttribute('data-bs-chid');
                    if (dataBsId) {
                        dataBsIds.push(dataBsId);
                    }
                });
                console.log(dataBsIds);

                const results = [];
                for (const idHabitacion of dataBsIds) {
                    const response = await fetch(`/api/check-availability/?resourceId=${idHabitacion}&arrivalDate=${arrivalDate}&departureDate=${departureDate}`);
                    const result = await response.json();
                    results.push({ idHabitacion, available: result.available });
                }

                console.log(results);

                results.forEach(result => {
                    const option = document.querySelector(`option[data-bs-chid="${result.idHabitacion}"]`);
                    console.log(option)
                    if (result.available) {
                        option.style.backgroundColor = 'lightgreen'; // Marca las cabañas disponibles
                        option.disabled = false;
                    } else {
                        // option.style.backgroundColor = 'lightcoral'; // Marca las cabañas no disponibles
                        // option.disabled = true;
                        option.style.display = 'none';
                    }
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: "Error en la solicitud: " + error.message,
                confirmButtonText: 'Aceptar'
            });
        } finally {
            verificarDisponibilidadElement.style.display = 'none';
            tipologiaHabitacionInput.disabled = false;

        }


    }

    // Creating new reservation.
    document.getElementById('save-event-btn').addEventListener('click', async function () {
        // Mostrar el spinner y deshabilitar el botón
        const spinner = document.querySelector('.loader');
        spinner.classList.remove('loader--hidden');


        try {

            // Esperar a que obtenerComisiones() se resuelva            
            comisionesReserva = document.getElementById('habitacion_total').value.trim() - precioMinimoPermitido; // 3250 - 3000
            console.log(comisionesReserva)
            const tipoReserva = document.getElementById('tipo-reserva-select').value.trim();
            const isDeposit = tipoReserva === 'por-depo' ? true : false;

            if (!isDeposit){
                if (document.getElementById("lblClientValue").value.trim() === "" || document.getElementById("lblClientValue").value.trim() === null || document.getElementById("lblClientValue").value.trim() === undefined) {
                    throw new Error("Por favor selecciona un cliente de la lista.");
                }

            }

            let formData = {};

            if (isDeposit){
                formData = {
                    clientFirstName: document.getElementById('nombre-cliente-provisional').value.trim(),
                    clientLastName: document.getElementById('apellido-cliente-provisional').value.trim(),
                    arrivalDate: document.getElementById('event_start_date').value.trim(),
                    departureDate: document.getElementById('event_end_date').value.trim(),
                    nNights: document.getElementById("event_nights").value.trim(),
                    chaletName: document.getElementById('tipologia_habitacion_reserva').value.trim(),
                    maxOccupation: document.getElementById('ocupacion_habitacion').value.trim(),
                    total: document.getElementById('habitacion_total').value.trim(),
                    isDeposit: isDeposit,
                    comisionVendedor: comisionesReserva,
                    pax: document.getElementById('numero-personas').value.trim()

                }
            } else {
                formData = {
                    clientEmail: document.getElementById("lblClientValue").value.trim(),
                    arrivalDate: document.getElementById('event_start_date').value.trim(),
                    departureDate: document.getElementById('event_end_date').value.trim(),
                    nNights: document.getElementById("event_nights").value.trim(),
                    chaletName: document.getElementById('tipologia_habitacion_reserva').value.trim(),
                    maxOccupation: document.getElementById('ocupacion_habitacion').value.trim(),
                    pax: document.getElementById('numero-personas').value.trim(),
                    total: document.getElementById('habitacion_total').value.trim(),
                    isDeposit: isDeposit,
                    comisionVendedor: comisionesReserva,
                    pax: document.getElementById('numero-personas').value.trim()
                }
            }

            console.log(preciosTotalesGlobal)
            console.log("precioMinimoPermitido: ", precioMinimoPermitido)

            if (formData.total > preciosTotalesGlobal) {
                throw new Error(`No puedes dar un precio mayor al establecido ($${preciosTotalesGlobal})`);
            }

            if (formData.total < precioMinimoPermitido) {
                throw new Error(`No puedes dar un precio menor al establecido ($${precioMinimoPermitido})`); //
            }


            const response = await fetch('/api/eventos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.log(errorData)
                let errors = []

                if (errorData.message){
                    errors.push(errorData.message);
                } else {
                    errors = errorData.error.map(err => err.message);
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: "Error en la solicitud: " + errors.join(' ') + ".",
                    confirmButtonText: 'Aceptar'
                });
                throw new Error(errors);
            }

            const data = await response.json();
            console.log('Respuesta exitosa del servidor:', data);

            const reservationId = data.reservationId;

            const comisionBody = {
                precioMinimo: precioMinimoPermitido,
                precioMaximo: preciosTotalesGlobal,
                costoBase: totalCostoBaseInput.value,
                totalSinComisiones: totalSinComisiones.value,
                precioAsignado: formData.total,
                chaletName: formData.chaletName,
                idReserva: reservationId,
                arrivalDate: formData.arrivalDate,
                departureDate: formData.departureDate,
                nNights: formData.nNights

            }

            const agregarComisiones = await fetch('/api/utilidades/reserva', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(comisionBody)
            })

            if (!agregarComisiones.ok) {
                const additionalErrorData = await agregarComisiones.json();
                const additionalErrors = additionalErrorData.error;
                Swal.fire({
                    icon: 'error',
                    title: 'Additional Error',
                    text: "Error en la solicitud adicional: " + additionalErrors[0].message.toLowerCase() + ".",
                    confirmButtonText: 'Aceptar'
                });
                throw new Error('Error en la solicitud adicional');
            }

            const additionalData = await agregarComisiones.json();
            console.log('Additional data received:', additionalData);




            Swal.fire({
                icon: 'success',
                title: 'Reserva creada',
                text: data.message,
                showCancelButton: false,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = `/api/eventos/${data.reservationId}`;
                }
            });

        } catch (error) {
            console.error('Ha ocurrido un error: ', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `Ha ocurrido un error al crear la reserva: ${error.message}`,
                showCancelButton: false,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            });

        } finally {
            const spinner = document.querySelector('.loader');
            spinner.classList.add('loader--hidden');

        }
    });

    const nightsInput = document.querySelector('#event_nights');
    const arrivalDate = document.getElementById('event_start_date')
    const departureDate = document.getElementById('event_end_date')
    const selectedPax = document.getElementById('numero-personas')


    // const datePicker = $('#date_range')
    // arrivalDate.addEventListener('input', calculateNightDifference);
    // departureDate.addEventListener('input', calculateNightDifference);
    // arrivalDate.addEventListener('input', showAvailableChalets);
    // departureDate.addEventListener('input', showAvailableChalets);

    const tipologiaSelect = document.getElementById('tipologia_habitacion_reserva');
    const ocupacionInput = document.getElementById('ocupacion_habitacion');
    const idHabitacionInput = document.getElementById('id_cabana');

    tipologiaSelect.addEventListener('change', function () {
        const selectedOption = tipologiaSelect.options[tipologiaSelect.selectedIndex];
        const pax = selectedOption.getAttribute('data-bs-pax');
        const idHabitacion = selectedOption.getAttribute('data-bs-chid');

        console.log(pax);

        if (pax != undefined && pax != null && pax.trim() !== '') {
            ocupacionInput.value = pax;
        } else {
            ocupacionInput.value = 0
        }

        idHabitacionInput.value = idHabitacion;
        console.log(idHabitacionInput);
        console.log(idHabitacionInput.value);

        const numeroPersonasSelect = document.getElementById('numero-personas');
        const maxOccupancy = selectedOption.getAttribute('data-bs-pax');
        numeroPersonasSelect.innerHTML = '<option value="" selected disabled>Selecciona el número de personas --</option>';
        for (let i = 2; i <= maxOccupancy; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            numeroPersonasSelect.appendChild(option);
        }



        obtenerTotalReserva()
        showAvailableChalets()

    });

    // arrivalDate.addEventListener('change', obtenerTotalReserva);

    // Agregar un listener para el evento change a departureDate
    // departureDate.addEventListener('change', obtenerTotalReserva);

    selectedPax.addEventListener('change', obtenerTotalReserva);






    async function obtenerTotalReserva() {
        const fechaInicio = new Date(`${arrivalDate.value}T00:00:00`); // Agregar la hora en formato UTC
        const fechaFin = new Date(`${departureDate.value}T00:00:00`); // Agregar la hora en formato UTC

        console.log('pax: ', selectedPax.value);
        if (arrivalDate.value && departureDate.value && tipologiaSelect.value && selectedPax.value !== "") {

            const calculandoPreciosElement = document.getElementById('calculando-precios');
            calculandoPreciosElement.style.display = 'block';
            // Aquí puedes ejecutar la acción deseada
            console.log("Los 4 elementos tienen un valor. Ejecutar acción...");
            const fechas = obtenerRangoFechas(fechaInicio, fechaFin)
            const nNights = document.getElementById("event_nights").value.trim();
            const habitacionId = idHabitacionInput.value

            const resultados = []

            try {

                for (const fecha of fechas) {
                    const year = fecha.getFullYear();
                    const month = (fecha.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
                    const day = fecha.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
                    const formatedDate = `${year}-${month}-${day}`;

                    console.log("estoy consultando precios")
                    const maxOccupation = document.getElementById('ocupacion_habitacion').value.trim()
                    const selectedPax = document.getElementById('numero-personas').value.trim()

                    const needSpecialPrice = (selectedPax === maxOccupation) ? false : true;

                    const response = await fetch(`/api/consulta-fechas?fecha=${formatedDate}&habitacionid=${habitacionId}&needSpecialPrice=${needSpecialPrice}&pax=${selectedPax}`);

                    // Verificar el estado de la respuesta
                    if (!response.ok) {
                        throw new Error('Error en la solicitud fetch: ' + response.statusText);
                    }

                    // Convertir la respuesta a JSON
                    const data = await response.json();

                    // Agregar el resultado al array de resultados
                    resultados.push(data);

                }
                console.log(resultados)
                let totalPrecios = 0
                let totalCostoBase = 0

                resultados.forEach(resultado => {



                    if (nNights > 1) {
                        if (resultado.precio_base_2noches) {
                            totalPrecios += resultado.precio_base_2noches
                            totalCostoBase += resultado.costo_base_2noches
                        } else {
                            console.log('no hay precios disponibles')
                        }
                    } else {
                        if (resultado.precio_modificado) {
                            totalPrecios += resultado.precio_modificado
                            totalCostoBase += resultado.costo_base

                        } else {
                            console.log('No hay precios disponibles')
                        }
                    }
                })

                console.log("Total precio sin comisiones: ", totalPrecios)
                comisionesReserva = totalPrecios; // comisionesReserva = 3000
                console.log("Total costo base: ", totalCostoBase)

                totalSinComisiones.value = totalPrecios;

                // Asignar comisiones
                const comisionUsuarios = await obtenerComisiones(nNights, habitacionId)
                precioMinimoPermitido = comisionUsuarios.minComission + totalPrecios // Sumar comisiones al precio minimo
                totalPrecios += comisionUsuarios.finalComission // Precio maximo permitido
                console.log("Total máximo permitido con comisiones: ", totalPrecios)

                const totalInput = document.getElementById('habitacion_total') // Subtotal 
                totalInput.value = precioMinimoPermitido // Mostrar el minimo permitido

                preciosTotalesGlobal = totalPrecios // Monto maximo en variable global

                totalCostoBaseInput.value = totalCostoBase

                console.log('Total maximo permitido: ', preciosTotalesGlobal)



            } catch (error) {
                console.error('Ha ocurrido un error: ', error.message);

            } finally {
                // Ocultar la leyenda de "Calculando precios..."
                calculandoPreciosElement.style.display = 'none';
            }

        }
    }

    async function obtenerComisiones(nNights, habitacionId) {
        try {
            const response = await fetch(`/api/utilidades?nnights=${nNights}&habitacionid=${habitacionId}`);
            const data = await response.json();
            const minComission = data.minComission
            const finalComission = data.finalComission
            const comisiones = { minComission: minComission, finalComission: finalComission }
            return comisiones

        } catch (error) {
            console.log(error.message);
        }
    }

    function obtenerRangoFechas(fechaInicio, fechaFin) {
        const fechas = [];
        let fechaActual = new Date(fechaInicio);

        while (fechaActual < fechaFin) {
            fechas.push(new Date(fechaActual));
            fechaActual.setDate(fechaActual.getDate() + 1);
        }
        return fechas;
    }

    // Alta de usuarios
    var btnSaveClient = document.getElementById("btnSaveClient");
    if (btnSaveClient) {
        btnSaveClient.addEventListener("click", async (event) => {
            event.preventDefault();

            const data = {
                firstName: document.getElementById("txtClientName").value,
                lastName: document.getElementById("txtClientLastname").value,
                phone: document.getElementById("txtClientPhone").value,
                address: document.getElementById("txtClientAddress").value,
                email: document.getElementById("txtClientEmail").value,
                identificationType: document.getElementById("slctClientIdType").value,
                identificationNumber: document.getElementById("txtClientIdNumber").value
            };

            try {
                const response = await fetch('/api/clientes/crear-cliente', {
                    method: 'POST',
                    headers: {
                        // Once logged in, the authorization token stored inthe session cookies will automatically be added in each HTTP request.
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                })

                if (!response.ok) {
                    const errorData = await response.json(); // Extract the error data
                    const errorMessage = errorData.error && errorData.error[0] && errorData.error[0].message
                    throw new Error(errorMessage);
                }

                const dataR = await response.json();
                console.log(dataR);

                Swal.fire({
                    icon: 'success',
                    title: '¡Completado!',
                    text: dataR.message + '.',
                    confirmButtonText: 'Regresar'
                }).then((result) => {
                    if (result.isConfirmed) {
                        $('#clientEntryModal').modal('hide');
                        $('#event_entry_modal').modal('show');
                        // Update the clients dropdown
                        // const newOption = document.createElement("option");
                        // newOption.value = dataR.client.email;
                        // newOption.text = dataR.client.firstName + " " + dataR.client.lastName + "(" + dataR.client.email + ")";
                        // newOption.selected = true;

                        // document.getElementById("lblClient").appendChild(newOption);

                        window.addNewClientOption({
                            email: dataR.client.email,
                            firstName: dataR.client.firstName,
                            lastName: dataR.client.lastName
                        });
                    }
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al enviar la solicitud: ' + error,
                    confirmButtonText: 'Aceptar'
                });
            }
        });
    }

    flatpickr("#date_range", {
        mode: "range",
        dateFormat: "d-m-Y",
        onChange: function (selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                // Guardar las fechas en los campos ocultos
                document.getElementById('event_start_date').value = selectedDates[0].toISOString().split('T')[0];
                document.getElementById('event_end_date').value = selectedDates[1].toISOString().split('T')[0];

                console.log("Initial date: ", $('#event_start_date').val());
                console.log("Final date: ", $('#event_end_date').val());

                calculateNightDifference()
                obtenerTotalReserva()
                showAvailableChalets()
            }
        },

    });

    const tipoReservaSelect = document.querySelector('#tipo-reserva-select');
    tipoReservaSelect.addEventListener('change', function() {
        console.log("Ejecutando...")
        
        const containerAltaCliente = document.querySelectorAll('.container-alta-cliente');
        const containerAltaClienteProvisional = document.querySelector('#container-alta-cliente-provisional')

        const selectedOption = tipoReservaSelect.options[tipoReservaSelect.selectedIndex];
        console.log(selectedOption)

        if (selectedOption.value === "reserva"){
            containerAltaCliente.forEach(element => {
                element.classList.remove('d-none')
            });
            containerAltaClienteProvisional.classList.add('d-none')
        } else {
            containerAltaCliente.forEach(element => {
                element.classList.add('d-none')
            });
            containerAltaClienteProvisional.classList.remove('d-none')
        }
    });

    const searchInput = document.getElementById('lblClient');
    const optionsContainer = document.querySelector('.select-options');
    const hiddenInput = document.getElementById('lblClientValue');
    let allOptions = Array.from(document.querySelectorAll('.select-option'));

    window.addNewClientOption = function(clientData) {
        // Create new option element
        const newOption = document.createElement('div');
        newOption.className = 'select-option';
        newOption.dataset.value = clientData.email;
        newOption.dataset.label = `${clientData.firstName} ${clientData.lastName} (${clientData.email})`;
        newOption.textContent = `${clientData.firstName} ${clientData.lastName} (${clientData.email})`;

        // Add the new option to the container
        optionsContainer.appendChild(newOption);

        // Update allOptions array
        allOptions = Array.from(document.querySelectorAll('.select-option'));

        // Set the new option as selected
        searchInput.value = newOption.dataset.label;
        hiddenInput.value = newOption.dataset.value;
    };

    // Function to filter options
    function filterOptions(searchText) {
        const filteredOptions = allOptions.filter(option => {
            const optionText = option.textContent.toLowerCase();
            return optionText.includes(searchText.toLowerCase());
        });

        // Hide all options first
        allOptions.forEach(option => option.style.display = 'none');

        // Show filtered options
        filteredOptions.forEach(option => option.style.display = 'block');

        // Show/hide options container based on whether there are results
        optionsContainer.style.display = filteredOptions.length > 0 ? 'block' : 'none';
    }

    // Input event handler
    searchInput.addEventListener('input', (e) => {
        filterOptions(e.target.value);
    });

    // Focus event handler
    searchInput.addEventListener('focus', () => {
        optionsContainer.style.display = 'block';
        filterOptions(searchInput.value);
    });

    // Click handler for options
    optionsContainer.addEventListener('click', (e) => {
        const option = e.target.closest('.select-option');
        if (option) {
            const value = option.dataset.value;
            const label = option.dataset.label || option.textContent;
            
            searchInput.value = label;
            hiddenInput.value = value;
            optionsContainer.style.display = 'none';
        }
    });

    // Close options when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.select-container')) {
            optionsContainer.style.display = 'none';
        }
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const visibleOptions = Array.from(optionsContainer.querySelectorAll('.select-option')).filter(
            option => option.style.display !== 'none'
        );
        const currentIndex = visibleOptions.findIndex(option => option.classList.contains('selected'));

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < visibleOptions.length - 1) {
                    visibleOptions.forEach(opt => opt.classList.remove('selected'));
                    visibleOptions[currentIndex + 1].classList.add('selected');
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    visibleOptions.forEach(opt => opt.classList.remove('selected'));
                    visibleOptions[currentIndex - 1].classList.add('selected');
                }
                break;
            case 'Enter':
                e.preventDefault();
                const selectedOption = visibleOptions.find(opt => opt.classList.contains('selected'));
                if (selectedOption) {
                    const value = selectedOption.dataset.value;
                    const label = selectedOption.dataset.label || selectedOption.textContent;
                    searchInput.value = label;
                    hiddenInput.value = value;
                    optionsContainer.style.display = 'none';
                }
                break;
        }
    });

});

async function availableDate(resourceId, arrivalDate, departureDate, idReserva) {
    console.log('desde show available')
    console.log(arrivalDate);
    console.log(departureDate);
    const arrivalValue = new Date(`${arrivalDate}T00:00:00`);
    const departureValue = new Date(`${departureDate}T00:00:00`);
    // const tipologiaHabitacionInput = document.querySelector('#tipologia_habitacion');
    // const options = tipologiaHabitacionInput.querySelectorAll('option');

    // const verificarDisponibilidadElement = document.getElementById('verificar-disponibilidad');

    // console.log(arrivalValue)
    // console.log(departureValue)

    try {
        if (!isNaN(arrivalDate) && !isNaN(departureDate) && departureDate >= arrivalDate) {

            console.log(arrivalDate)
            console.log(departureDate)

            // verificarDisponibilidadElement.style.display = 'block';

            const arrivalYear = arrivalDate.getFullYear();
            const arrivalMonth = (arrivalDate.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
            const arrivalDay = arrivalDate.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
            const arrivalDateSend = `${arrivalYear}-${arrivalMonth}-${arrivalDay}`;

            const departureYear = departureDate.getFullYear();
            const departureMonth = (departureDate.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
            const departureDay = departureDate.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
            const departureDateSend = `${departureYear}-${departureMonth}-${departureDay}`;

            console.log(arrivalDateSend)
            console.log(departureDateSend)


            // const results = [];
            const response = await fetch(`/api/check-availability/?resourceId=${resourceId}&arrivalDate=${arrivalDateSend}&departureDate=${departureDateSend}&eventId=${idReserva}`);
            const result = await response.json();
            console.log(result)
            console.log(result.available)
            if (!result.available) {
                console.log('Cabaña no disponible');
                return false;
                // throw new Error('La cabaña no está disponible en las nuevas fechas. Intenta de nuevo con otras fechas.')
            }

            return true;
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: "Error en la solicitud: " + error.message,
            confirmButtonText: 'Aceptar'
        });
    } finally {
        // verificarDisponibilidadElement.style.display = 'none';
        console.log('finalizado');
    }


}

async function obtenerNuevoTotal(resourceId, arrivalDate, departureDate, comisionVendedor) {
    console.log('obtener total ');
    // const fechaInicio = new Date(`${arrivalDate.value}T00:00:00`); // Agregar la hora en formato UTC
    // const fechaFin = new Date(`${departureDate.value}T00:00:00`); // Agregar la hora en formato UTC
    const arrivalYear = arrivalDate.getFullYear();
    const arrivalMonth = (arrivalDate.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
    const arrivalDay = arrivalDate.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
    const arrivalDateSend = `${arrivalYear}-${arrivalMonth}-${arrivalDay}`;

    const departureYear = departureDate.getFullYear();
    const departureMonth = (departureDate.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
    const departureDay = departureDate.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
    const departureDateSend = `${departureYear}-${departureMonth}-${departureDay}`;

    console.log("arrival send: ", arrivalDateSend)
    console.log("departure send", departureDateSend)

    if (arrivalDateSend && departureDateSend && resourceId) {
        // Aquí puedes ejecutar la acción deseada
        console.log("Los tres elementos tienen un valor. Ejecutar acción...");
        const fechas = obtenerRangoFechas(arrivalDateSend, departureDateSend)
        const nNights = calculateNightDifference(arrivalDateSend, departureDateSend)
        const habitacionId = resourceId

        console.log("fechas: " + fechas)
        console.log("Nights: " + nNights)

        const resultados = []

        try {

            for (const fecha of fechas) {
                const year = fecha.getFullYear();
                const month = (fecha.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
                const day = fecha.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
                const formatedDate = `${year}-${month}-${day}`;

                const response = await fetch(`/api/consulta-fechas?fecha=${formatedDate}&habitacionid=${habitacionId}`);

                // Verificar el estado de la respuesta
                if (!response.ok) {
                    throw new Error('Error en la solicitud fetch: ' + response.statusText);
                }

                // Convertir la respuesta a JSON
                const data = await response.json();

                // Agregar el resultado al array de resultados
                resultados.push(data);

            }
            console.log(resultados)
            let totalPrecios = 0
            let totalCostoBase = 0



            resultados.forEach(resultado => {



                if (nNights > 1) {
                    if (resultado.precio_base_2noches) {
                        totalPrecios += resultado.precio_base_2noches
                        totalCostoBase += resultado.costo_base_2noches
                    } else {
                        console.log('no hay precios disponibles')
                    }
                } else {
                    if (resultado.precio_modificado) {
                        totalPrecios += resultado.precio_modificado
                        totalCostoBase += resultado.costo_base

                    } else {
                        console.log('No hay precios disponibles')
                    }
                }
            })

            console.log("Total precios: ", totalPrecios)

            // Asignar comisiones
            if (isNaN(comisionVendedor) || comisionVendedor == null) {
                comisionVendedor = 0
            }
            // totalPrecios += comisionVendedor // Precio maximo permitido

            // console.log("Total precios con comisiones: ", totalPrecios)
            const comisionUsuarios = await obtenerComisiones(nNights, habitacionId);
            let precioMinimoPermitido = comisionUsuarios.minComission + totalPrecios // Sumar comisiones al precio minimo
            console.log("Precio minimo permitido: ", precioMinimoPermitido)
            precioMinimoPermitido += comisionVendedor;
            console.log("Precio total de la reserva", precioMinimoPermitido);
            // totalPrecios += comisionUsuarios.finalComission // Precio maximo permitido
            // console.log("Total precios con comisiones: ", totalPrecios)
            return precioMinimoPermitido

            // preciosTotalesGlobal = totalPrecios // Monto maximo en variable global

            // totalCostoBaseInput.value = totalCostoBase

            // console.log('Precios totales global: ', preciosTotalesGlobal)


        } catch (error) {
            console.error('Ha ocurrido un error: ', error.message);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: "Error en la solicitud: " + error.message,
                confirmButtonText: 'Aceptar'
            })

        }

    }

}

function obtenerRangoFechas(arrivalDate, departureDate) {
    const fechaInicio = new Date(`${arrivalDate}T00:00:00`); // Agregar la hora en formato UTC
    const fechaFin = new Date(`${departureDate}T00:00:00`); // Agregar la hora en formato UTC

    const fechas = [];
    let fechaActual = new Date(fechaInicio);

    while (fechaActual < fechaFin) {
        fechas.push(new Date(fechaActual));
        fechaActual.setDate(fechaActual.getDate() + 1);
    }
    return fechas;
}

function calculateNightDifference(arrivalDate, departureDate) {
    console.log('Desde calcular noches')
    const arrivalValue = new Date(arrivalDate);
    const departureValue = new Date(departureDate);
    let nightsInput;

    // Verifica si las fechas son válidas
    if (!isNaN(arrivalValue) && !isNaN(departureValue) && departureValue >= arrivalValue) {
        const timeDifference = departureValue.getTime() - arrivalValue.getTime();
        const nightDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)); // Calcula la diferencia en días

        nightsInput = nightDifference
    } else {
        nightsInput = 0
    }

    return nightsInput;
}

async function obtenerComisiones(nNights, habitacionId) {
    try {
        const response = await fetch(`/api/utilidades?nnights=${nNights}&habitacionid=${habitacionId}`);
        console.log(response);
        const data = await response.json();
        console.log(data);
        const minComission = data.minComission
        const finalComission = data.finalComission
        const comisiones = { minComission: minComission, finalComission: finalComission }
        return comisiones

    } catch (error) {
        console.log(error.message);
    }
}