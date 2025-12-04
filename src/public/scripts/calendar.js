document.addEventListener('DOMContentLoaded', async function () {
    const spinner = $('.loader');
    $(spinner).removeClass('loader--hidden')
    // const url =  `${process.env.URL}/eventos`;
    // const urlEventos = 'https://administrador-reservas.onrender.com/eventos'
    const urlEventos = './api/eventos';
    const urlHabitaciones = './api/habitaciones';
    const urlClientes = './api/clientes/show-clients';
    var today = new Date();
    var milliseconds = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(today.getFullYear(), 0, 7);
    let resourcesCollapsed = false; // Flag to ensure collapse happens only once

    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'resourceTimelineYear',
        scrollTime: milliseconds,
        height: "100%",
        expandRows: true,
        navLinks: true, // can click day/week names to navigate views
        editable: true,
        selectable: true,
        nowIndicator: true,
        dayMaxEvents: true, // allow "more" link when too many events
        timeZone: 'America/Mexico_City',
        resourceAreaWidth: '200px', // Adjust as per your layout
        slotMinWidth: 100, // Adjust column width for better layout
        locale: 'es',


        headerToolbar: {
            left: 'today prev,next',
            center: 'title',
            right: 'resourceTimelineMonth,resourceTimelineYear'
        },

        resourceAreaHeaderContent: 'Habitaciones',
        resourceGroupField: 'habitaciones',
        resources:
            function (info, successCallback, failureCallback) {
                fetch(urlHabitaciones)
                    .then(function (response) {
                        return response.json()
                    })
                    .then(function (data) {
                        let resources = data.map(function (event) {
                            return {
                                id: event._id,
                                habitaciones: event.propertyDetails.accomodationType,
                                title: event.propertyDetails.name
                            }
                        })
                        successCallback(resources);
                        // console.log(resources);
                    })
                    .catch(function (error) {
                        failureCallback(error);
                    })
            },
        events:
            function (info, successCallback, failureCallback) {
                fetch(`${urlEventos}?start=${info.startStr}&end=${info.endStr}`)
                    .then(function (response) {
                        return response.json()
                    })
                    .then(function (data) {
                        // console.log(data);
                        let events = data
                            // .filter(event => (event.status !== 'cancelled') && (event.status !== 'no-show'))
                            .map(function (event) {

                                return {
                                    id: event._id,
                                    resourceId: event.resourceId,
                                    title: event.title,
                                    start: event.arrivalDate.split('T')[0],
                                    end: event.departureDate.split('T')[0],
                                    url: event.url,
                                    total: event.total,
                                    clientId: event.client,
                                    status: event.status,
                                    createdBy: event.createdBy,
                                    comisionVendedor: event.comisionVendedor,
                                    clientName: event.clientName,
                                    clientPayments: event.pagosTotales,
                                    madeCheckIn: event.madeCheckIn,
                                    cleaningDetails: event.cleaningDetails,
                                    ota_name: event.channels?.ota_name,
                                    allDay: true
                                }
                            })
                        successCallback(events);
                        $(spinner).addClass('loader--hidden')
                    })
                    .catch(function (error) {
                        failureCallback(error);
                    })
            },
        eventContent: ({ event }) => {
            /* 1) Fecha bloqueada */
            const isBlocked =
                event.extendedProps.type === 'blocked' ||
                (event.title || '').toUpperCase() === 'FECHA BLOQUEADA' ||
                event.extendedProps.clientName === 'Fecha Bloqueada';

            if (isBlocked) {
                return {
                    html: `
                        <div class="fc-event-card fc-event-blocked" title="Fecha bloqueada">
                        FECHA BLOQUEADA
                        </div>`
                };
            }

            /* 2) Datos de negocio */
            const {
                clientName = 'RESERVA DUEÑO/INVERSIONISTA',
                clientPayments = 0,
                total = 0,
                madeCheckIn,
                cleaningDetails,
                ota_name
            } = event.extendedProps;

            /* 3) Origen / marca (usa tus vars) */
            const ota = (ota_name || 'NYN').toUpperCase();
            const brandVar = ({
                'AIRBNB': 'airbnb',
                'BOOKINGCOM': 'booking',
                'NYN': 'nyn'
            })[ota] || 'nyn';

            /* 4) Pago */
            const safeTotal = total > 0 ? total : 0;
            const pct = safeTotal > 0 ? Math.min(100, Math.round((clientPayments / safeTotal) * 100)) : (clientPayments > 0 ? 100 : 0);
            const paymentStatus =
                clientPayments === 0 ? 'pay-none' :
                    clientPayments < (safeTotal / 2 || 1) ? 'pay-partial' :
                        clientPayments < (safeTotal || 1) ? 'pay-half' :
                            'pay-complete';

            /* 5) Check-in y Limpieza */
            const checkInStatus = madeCheckIn ? 'status-ok' : 'status-ko';
            const cleaningStatus = !cleaningDetails ? 'status-void' :
                (cleaningDetails.status === 'Completado' ? 'status-ok' :
                    cleaningDetails.status === 'En proceso' ? 'status-warn' :
                        'status-ko');

            /* 6) Formato total */
            const totalText = safeTotal
                ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(safeTotal)
                : '';

            /* 7) Plantilla */
            return {
                html: `
                    <div class="fc-event-card" aria-label="${clientName}">
                        
                        <!-- Fila superior: Origen / Estatus de pago -->
                        <div class="fc-event-top">
                        <div class="fc-event-origin" style="background:var(--${brandVar});" title="Origen: ${ota}">
                            
                        </div>
                        <div class="fc-event-pay" style="background:var(--${paymentStatus}); border-left:2px solid #0002;" title="Pago: ${pct}%">
                            
                        </div>
                        </div>

                        <!-- Franja: Check-in / Limpieza -->
                        <div class="fc-event-indicators">
                        <div style="background:var(--${checkInStatus}); border-top:2px solid #0002;" title="Check-in ${madeCheckIn ? 'realizado' : 'pendiente'}"></div>
                        <div style="background:var(--${cleaningStatus}); border-left:2px solid #0002; border-top:2px solid #0002;" 
                            title="Limpieza: ${cleaningDetails?.status || 'Sin datos'}"></div>
                        </div>

                        <!-- Cuerpo: Nombre / Total -->
                        <div class="fc-event-body">
                        <div class="fc-event-name">${clientName}</div>
                        ${totalText ? `<div class="fc-event-total">${totalText}</div>` : ''}
                        </div>

                    </div>`
            };
        },

        eventMouseEnter: function (mouseEnterInfo) {
            let el = mouseEnterInfo.el;
            el.classList.add("relative");

            let newEl = document.createElement("div");
            let newElTitle = mouseEnterInfo.event.id;
            let newElTotal = mouseEnterInfo.event.extendedProps.total;
            let newElStatus = mouseEnterInfo.event.extendedProps.status;
            if (newElStatus === "pending") {
                newElStatus = "Por Depo"
            }
            newEl.innerHTML = `
            <div
                class="fc-hoverable-event"
                style="position: absolute; top: 100%; left: 0; width: 300px; height: auto; background-color: #FFFFFF; z-index: 100000000 !important; border: 1px solid #E3E8EE; border-radius: 0.5rem; padding: 0.75rem; font-size: 14px; font-family: 'Poppins', sans-serif; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15); color: #2C3E50;"
            >
                <strong>${newElTitle}</strong>
                <div>Total: $${newElTotal}</div>
                <div>Status: <b>${newElStatus.toUpperCase()}<b></div>

            </div>
            `
            document.body.appendChild(newEl); // Attach the popup directly to the body

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
            const { DateTime } = luxon;

            const event = info.event;
            idReserva = event.id;
            const eventStatus = info.event.extendedProps.status;
            const newEventStart = info.event.start;
            const eventDateStart = new Date(newEventStart);
            eventDateStart.setHours(eventDateStart.getHours() + 6);
            // const eventDateStart = moment.tz(newEventStart, "America/Mexico_City").toDate();


            const newEventEnd = info.event.end;

            // const eventDateEnd = new Date(newEventEnd);
            // const eventDateEnd = convertToTimeZone(newEventEnd, 'America/Mexico_City');
            const eventDateEnd = new Date(newEventEnd);
            eventDateEnd.setHours(eventDateEnd.getHours() + 6);
            const comisionVendedor = info.event.extendedProps.comisionVendedor;
            const totalViejo = info.event.extendedProps.total;

            const resourceId = (info.newResource && info.newResource.id) || info.el.fcSeg.eventRange.def.resourceIds[0];

            const hoverableEventElement = document.querySelector(".fc-hoverable-event");
            if (hoverableEventElement) {
                hoverableEventElement.remove();
            }

            let nuevoTotal;
            let diferencia;

            if (eventStatus !== "reserva de dueño") {
                nuevoTotal = await obtenerNuevoTotal(resourceId, eventDateStart, eventDateEnd, comisionVendedor);
                diferencia = nuevoTotal - totalViejo; // 2650 - 3250 

            } else {
                nuevoTotal = 0;
                diferencia = 0
            }

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

                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: `Error al actualizar fechas: ${err.message}`,
                        showConfirmButton: false,
                        timer: 2500
                    });
                    info.revert();
                }
            } else {
                info.revert();
                return;
            }
        },
        eventDidMount: function (info) {
            info.el.addEventListener('contextmenu', function (event) {
                event.preventDefault();
                showContextMenu(event, info.event);
            });

            if (!resourcesCollapsed) {
                setTimeout(function () {
                    var expanders = document.querySelectorAll('.fc-datagrid-expander');

                    expanders.forEach(function (expander) {
                        var icon = expander.querySelector('.fc-icon');
                        if (icon && icon.classList.contains('fc-icon-minus-square')) {
                            // Trigger click to collapse the group
                            expander.click();
                        }
                    });

                    resourcesCollapsed = true; // Set the flag to true to prevent further collapsing
                }, 100);
            }


        },
        windowResize: function (view) {
            const width = window.innerWidth;

            if (width < 768) {
                calendar.changeView('resourceTimelineMonth');
            } else {
                calendar.changeView('resourceTimelineYear');
            }
        }
    });
    calendar.render();

    // Define and call the responsive adjustment function
    function adjustCalendarLayout() {
        const width = window.innerWidth;

        calendar.setOption('resourceAreaWidth', width < 768 ? '100px' : '200px');
        calendar.setOption('slotMinWidth', width < 768 ? 50 : 100);
    }

    function adjustToolbar() {
        const isMobile = window.innerWidth < 768;
        calendar.setOption('headerToolbar', {
            left: isMobile ? 'prev,next' : 'today prev,next',
            center: 'title',
            right: isMobile ? 'resourceTimelineMonth' : 'resourceTimelineMonth,resourceTimelineYear'
        });
    }
    // Attach the resize event listener
    window.addEventListener('resize', adjustCalendarLayout);
    window.addEventListener('resize', adjustToolbar);


    // Call it immediately after rendering the calendar
    adjustCalendarLayout();
    adjustToolbar(); // Call initially








    var contextMenu = document.getElementById('context-menu');
    const moveToActiveEl = document.getElementById('move-to-active');
    const moveToPlaygroundEl = document.getElementById('move-to-playground');
    const cancelReservationEl = document.getElementById('delete');
    const editEl = document.getElementById('edit');
    const moveToNoShow = document.getElementById('move-to-noshow');
    var currentEvent;

    function showContextMenu(event, calendarEvent) {
        currentEvent = calendarEvent;
        contextMenu.style.display = 'block';

        if (currentEvent.extendedProps.status === 'active') {
            moveToActiveEl.style.display = 'none';
            moveToPlaygroundEl.style.display = 'block';
            moveToNoShow.style.display = 'block';
        } else if (currentEvent.extendedProps.status === 'playground') {
            moveToPlaygroundEl.style.display = 'none';
            moveToActiveEl.style.display = 'block';
            moveToNoShow.style.display = 'block';
        } else if (currentEvent.extendedProps.status === 'pending') {
            moveToPlaygroundEl.style.display = 'none';
            moveToActiveEl.style.display = 'none';
            cancelReservationEl.style.display = 'block';
            moveToNoShow.style.display = 'none';
        }
        else {
            moveToPlaygroundEl.style.display = 'none';
            moveToActiveEl.style.display = 'none';
            cancelReservationEl.style.display = 'none';
            moveToNoShow.style.display = 'none';
            editEl.style.display = 'none';

        }
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
    }

    document.addEventListener('click', function () {
        contextMenu.style.display = 'none';
    });

    document.getElementById('edit').addEventListener('click', function () {
        window.open(currentEvent.url, "_blank")
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
                    const data = await response.json();
                    throw new Error('Error al mover reserva a cancelada: ' + data.message);
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

    document.getElementById('move-to-noshow').addEventListener('click', async function () {
        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: '¿Estás seguro?',
            text: 'Esta acción moverá la reserva a No Show.',
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
                        status: 'no-show'
                    })
                });
                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Reserva movida a No Show',
                        text: 'La reserva ha sido movida a No Show.',
                        showConfirmButton: false,
                        timer: 3000
                    }).then((result) => {

                        window.location.reload();

                    })
                } else {
                    const data = await response.json();
                    throw new Error('Error al mover reserva a No Show: ' + data.message);
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
                const response = await fetch(`api/eventos/move-to-playground`, {
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
                    const data = await response.json();
                    throw new Error('Error al mover reserva a playground: ' + data.message);
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
                const response = await fetch(`api/eventos/move-to-playground`, {
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
                    const data = await response.json();
                    throw new Error('Error al mover reserva a activa: ' + data.message);
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


    async function getClients(idClient) {
        try {
            fetch(`/api/clientes/show-clients/${idClient}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
            })
                .then(response => response.json())
                .then(data => {
                    // console.log('Respuesta del servidor: ', data);
                    eventData = data[0]

                })
                .catch(err => {
                });
        } catch (err) {
        }
    }

});

async function availableDate(resourceId, arrivalDate, departureDate, idReserva) {
    const arrivalValue = new Date(`${arrivalDate}T00:00:00`);
    const departureValue = new Date(`${departureDate}T00:00:00`);
    // const tipologiaHabitacionInput = document.querySelector('#tipologia_habitacion');
    // const options = tipologiaHabitacionInput.querySelectorAll('option');

    // const verificarDisponibilidadElement = document.getElementById('verificar-disponibilidad');

    // console.log(arrivalValue)
    // console.log(departureValue)

    try {
        if (!isNaN(arrivalDate) && !isNaN(departureDate) && departureDate >= arrivalDate) {

            // verificarDisponibilidadElement.style.display = 'block';

            const arrivalYear = arrivalDate.getFullYear();
            const arrivalMonth = (arrivalDate.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
            const arrivalDay = arrivalDate.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
            const arrivalDateSend = `${arrivalYear}-${arrivalMonth}-${arrivalDay}`;

            const departureYear = departureDate.getFullYear();
            const departureMonth = (departureDate.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
            const departureDay = departureDate.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
            const departureDateSend = `${departureYear}-${departureMonth}-${departureDay}`;


            // const results = [];
            const response = await fetch(`/api/check-availability/?resourceId=${resourceId}&arrivalDate=${arrivalDateSend}&departureDate=${departureDateSend}&eventId=${idReserva}`);
            const result = await response.json();
            if (!result.available) {
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
    }


}

async function obtenerNuevoTotal(resourceId, arrivalDate, departureDate, comisionVendedor) {
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

    if (arrivalDateSend && departureDateSend && resourceId) {
        // Aquí puedes ejecutar la acción deseada
        const fechas = obtenerRangoFechas(arrivalDateSend, departureDateSend)
        const nNights = calculateNightDifference(arrivalDateSend, departureDateSend)
        const habitacionId = resourceId

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
            let totalPrecios = 0
            let totalCostoBase = 0



            resultados.forEach(resultado => {



                if (nNights > 1) {
                    if (resultado.precio_base_2noches) {
                        totalPrecios += resultado.precio_base_2noches
                        totalCostoBase += resultado.costo_base_2noches
                    } else {
                    }
                } else {
                    if (resultado.precio_modificado) {
                        totalPrecios += resultado.precio_modificado
                        totalCostoBase += resultado.costo_base

                    } else {
                    }
                }
            })

            // Asignar comisiones
            if (isNaN(comisionVendedor) || comisionVendedor == null) {
                comisionVendedor = 0
            }
            // totalPrecios += comisionVendedor // Precio maximo permitido

            // console.log("Total precios con comisiones: ", totalPrecios)
            const comisionUsuarios = await obtenerComisiones(nNights, habitacionId);
            let precioMinimoPermitido = comisionUsuarios.minComission + totalPrecios // Sumar comisiones al precio minimo
            // precioMinimoPermitido += comisionVendedor;
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
        const data = await response.json();
        const minComission = data.minComission
        const finalComission = data.finalComission
        const comisiones = { minComission: minComission, finalComission: finalComission }
        return comisiones

    } catch (error) {
    }
}

// Custom horizontal scrollbar functionality for calendar
class CalendarScrollbar {
    constructor(calendar) {
        this.calendar = calendar;
        this.scrollbarContainer = null;
        this.scrollbar = null;
        this.thumb = null;
        this.isDragging = false;
        this.dragStartX = 0;
        this.thumbStartX = 0;
        this.timelineElement = null;
        
        this.init();
    }

    init() {
        this.createScrollbar();
        this.setupEventListeners();
        
        // Wait for calendar to render then update scrollbar
        setTimeout(() => {
            this.findTimelineElement();
            this.updateScrollbar();
        }, 2000);
    }

    findTimelineElement() {
        // Try multiple selectors to find the scrollable timeline element
        const selectors = [
            '#calendar .fc-timeline-lane-frame',
            '#calendar .fc-timeline-lane',
            '#calendar .fc-timeline-slots',
            '#calendar .fc-scroller-harness .fc-scroller',
            '#calendar .fc-scroller'
        ];
        
        for (const selector of selectors) {
            this.timelineElement = document.querySelector(selector);
            if (this.timelineElement) {
                break;
            }
        }
        
        if (!this.timelineElement) {
            setTimeout(() => this.findTimelineElement(), 1000);
        }
    }

    createScrollbar() {
        // Create scrollbar container
        this.scrollbarContainer = document.createElement('div');
        this.scrollbarContainer.className = 'calendar-scroll-container';
        this.scrollbarContainer.style.cssText = `
            position: relative;
            width: 100%;
            margin-bottom: 15px;
            z-index: 1000;
        `;
        
        // Create scrollbar track
        this.scrollbar = document.createElement('div');
        this.scrollbar.className = 'custom-scrollbar';
        this.scrollbar.style.cssText = `
            width: 100%;
            height: 8px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            position: relative;
            cursor: pointer;
            overflow: hidden;
            transition: height 0.2s ease;
            margin: 0 3em;
        `;
        
        // Create scrollbar thumb
        this.thumb = document.createElement('div');
        this.thumb.className = 'custom-scrollbar-thumb';
        this.thumb.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, #4a9eff, #007bff);
            border-radius: 4px;
            position: absolute;
            cursor: grab;
            transition: all 0.2s ease;
            min-width: 40px;
            box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);
            top: 0;
            left: 0;
        `;
        
        // Create month indicators
        this.createMonthIndicators();
        
        this.scrollbar.appendChild(this.thumb);
        this.scrollbarContainer.appendChild(this.scrollbar);
    }

    createMonthIndicators() {
        const currentDate = new Date();
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                       'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        // Create indicators for 12 months (current year)
        for (let i = 0; i < 12; i++) {
            const indicator = document.createElement('div');
            indicator.className = 'scrollbar-month-indicator';
            indicator.textContent = months[i];
            indicator.style.left = `${(i / 11) * 100}%`;
            this.scrollbar.appendChild(indicator);
        }
    }

    setupEventListeners() {
        // Thumb drag events (mouse)
        this.thumb.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.endDrag.bind(this));
        
        // Thumb drag events (touch)
        this.thumb.addEventListener('touchstart', this.startTouchDrag.bind(this), { passive: false });
        document.addEventListener('touchmove', this.touchDrag.bind(this), { passive: false });
        document.addEventListener('touchend', this.endTouchDrag.bind(this));
        
        // Scrollbar click to jump
        this.scrollbar.addEventListener('click', this.jumpToPosition.bind(this));
        
        // Update scrollbar when calendar view changes
        this.calendar.on('datesSet', () => {
            setTimeout(() => this.updateScrollbar(), 100);
        });
        
        // Listen for calendar scroll events
        setTimeout(() => {
            this.timelineElement = document.querySelector('#calendar .fc-timeline-lane-frame');
            if (this.timelineElement) {
                this.timelineElement.addEventListener('scroll', this.onCalendarScroll.bind(this));
            }
        }, 1000);
        
        // Update on window resize
        window.addEventListener('resize', this.onResize.bind(this));
    }

    startDrag(e) {
        e.preventDefault();
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.thumbStartX = this.thumb.offsetLeft;
        document.body.style.userSelect = 'none';
    }

    drag(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        const deltaX = e.clientX - this.dragStartX;
        const newThumbX = Math.max(0, Math.min(
            this.scrollbar.offsetWidth - this.thumb.offsetWidth,
            this.thumbStartX + deltaX
        ));
        
        this.thumb.style.left = newThumbX + 'px';
        this.syncCalendarScroll();
    }

    endDrag() {
        this.isDragging = false;
        document.body.style.userSelect = '';
    }

    // Touch event handlers for mobile devices
    startTouchDrag(e) {
        e.preventDefault();
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX;
        this.thumbStartX = this.thumb.offsetLeft;
    }

    touchDrag(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        const deltaX = e.touches[0].clientX - this.dragStartX;
        const newThumbX = Math.max(0, Math.min(
            this.scrollbar.offsetWidth - this.thumb.offsetWidth,
            this.thumbStartX + deltaX
        ));
        
        this.thumb.style.left = newThumbX + 'px';
        this.syncCalendarScroll();
    }

    endTouchDrag() {
        this.isDragging = false;
    }

    onResize() {
        // Debounce resize events
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.updateScrollbar();
        }, 150);
    }

    jumpToPosition(e) {
        if (e.target === this.thumb) return;
        
        const rect = this.scrollbar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const thumbWidth = this.thumb.offsetWidth;
        const newThumbX = Math.max(0, Math.min(
            this.scrollbar.offsetWidth - thumbWidth,
            clickX - thumbWidth / 2
        ));
        
        this.thumb.style.left = newThumbX + 'px';
        this.syncCalendarScroll();
    }

    syncCalendarScroll() {
        if (!this.timelineElement) return;
        
        const scrollbarWidth = this.scrollbar.offsetWidth - this.thumb.offsetWidth;
        const thumbPosition = this.thumb.offsetLeft;
        const scrollPercentage = scrollbarWidth > 0 ? thumbPosition / scrollbarWidth : 0;
        
        const timelineScrollWidth = this.timelineElement.scrollWidth - this.timelineElement.clientWidth;
        const newScrollLeft = scrollPercentage * timelineScrollWidth;
        
        this.timelineElement.scrollLeft = newScrollLeft;
    }

    onCalendarScroll() {
        if (this.isDragging) return;
        this.updateScrollbar();
    }

    updateScrollbar() {
        if (!this.timelineElement) {
            this.findTimelineElement();
            if (!this.timelineElement) {
                // Show scrollbar anyway for testing
                this.scrollbarContainer.style.display = 'block';
                this.thumb.style.width = '100px';
                this.thumb.style.left = '0px';
                return;
            }
        }
        
        const scrollLeft = this.timelineElement.scrollLeft || 0;
        const scrollWidth = this.timelineElement.scrollWidth || 1000;
        const clientWidth = this.timelineElement.clientWidth || 800;
        
        if (scrollWidth <= clientWidth) {
            // For testing, always show the scrollbar
            this.scrollbarContainer.style.display = 'block';
            this.thumb.style.width = '60px';
            this.thumb.style.left = '0px';
            return;
        }
        
        this.scrollbarContainer.style.display = 'block';
        
        // Calculate thumb size and position with responsive adjustments
        const minThumbWidth = window.innerWidth < 480 ? 25 : window.innerWidth < 768 ? 30 : 40;
        const thumbWidth = Math.max(minThumbWidth, (clientWidth / scrollWidth) * this.scrollbar.offsetWidth);
        const thumbPosition = (scrollLeft / (scrollWidth - clientWidth)) * 
                            (this.scrollbar.offsetWidth - thumbWidth);
        
        this.thumb.style.width = thumbWidth + 'px';
        this.thumb.style.left = Math.max(0, thumbPosition) + 'px';
        
        // Add smooth transition for better UX
        if (!this.isDragging) {
            this.thumb.style.transition = 'left 0.2s ease';
        } else {
            this.thumb.style.transition = 'none';
        }
    }

    insertIntoDOM() {
        const calendarContainer = document.querySelector('#calendar');
        const calendarParent = document.querySelector('.calendar-container');
        
        if (calendarContainer && calendarParent) {
            // Insert before the calendar element
            calendarParent.insertBefore(this.scrollbarContainer, calendarContainer);
        } else if (calendarContainer && calendarContainer.parentNode) {
            // Fallback: insert before calendar
            calendarContainer.parentNode.insertBefore(this.scrollbarContainer, calendarContainer);
        } else {
        }
    }
}

// Initialize custom scrollbar when calendar is ready
let customScrollbar;

function initializeCustomScrollbar() {
    if (typeof calendar !== 'undefined' && calendar) {
        customScrollbar = new CalendarScrollbar(calendar);
        customScrollbar.insertIntoDOM();
        
        // Force initial update after a delay
        setTimeout(() => {
            customScrollbar.findTimelineElement();
            customScrollbar.updateScrollbar();
        }, 3000);
    } else {
        setTimeout(initializeCustomScrollbar, 1000);
    }
}

// Start initialization
setTimeout(initializeCustomScrollbar, 2000);

// Simple test function to show scrollbar immediately
function createTestScrollbar() {
    
    // Create simple scrollbar for testing
    const testScrollbar = document.createElement('div');
    testScrollbar.id = 'custom-calendar-scrollbar';
    testScrollbar.style.cssText = `
        position: relative;
        width: calc(100% - 6em);
        height: 12px;
        background-color: rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        margin: 15px 3em;
        border: 1px solid rgba(255, 255, 255, 0.3);
        z-index: 1000;
    `;
    
    const testThumb = document.createElement('div');
    testThumb.id = 'scrollbar-thumb';
    testThumb.style.cssText = `
        height: 100%;
        width: 100px;
        background: linear-gradient(90deg, #4a9eff, #007bff);
        border-radius: 6px;
        position: absolute;
        top: 0;
        left: 0;
        cursor: grab;
        box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);
    `;
    
    testScrollbar.appendChild(testThumb);
    
    // Insert AFTER calendar instead of before
    const calendarContainer = document.querySelector('#calendar');
    if (calendarContainer && calendarContainer.parentNode) {
        calendarContainer.parentNode.insertBefore(testScrollbar, calendarContainer.nextSibling);
        
        // Add drag functionality
        addScrollbarFunctionality(testScrollbar, testThumb);
    }
}

// Add drag and scroll functionality
function addScrollbarFunctionality(scrollbar, thumb) {
    let isDragging = false;
    let dragStartX = 0;
    let thumbStartX = 0;
    
    // Mouse events
    thumb.addEventListener('mousedown', function(e) {
        e.preventDefault();
        isDragging = true;
        dragStartX = e.clientX;
        thumbStartX = thumb.offsetLeft;
        thumb.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        const deltaX = e.clientX - dragStartX;
        const scrollbarWidth = scrollbar.offsetWidth;
        const thumbWidth = thumb.offsetWidth;
        const maxLeft = scrollbarWidth - thumbWidth;
        
        let newLeft = thumbStartX + deltaX;
        newLeft = Math.max(0, Math.min(maxLeft, newLeft));
        
        thumb.style.left = newLeft + 'px';
        
        // Calculate scroll percentage and apply to calendar
        const scrollPercentage = newLeft / maxLeft;
        scrollCalendarToPercentage(scrollPercentage);
    });
    
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            thumb.style.cursor = 'grab';
        }
    });
    
    // Click to jump functionality
    scrollbar.addEventListener('click', function(e) {
        if (e.target === thumb) return;
        
        const rect = scrollbar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const thumbWidth = thumb.offsetWidth;
        const maxLeft = scrollbar.offsetWidth - thumbWidth;
        
        let newLeft = clickX - thumbWidth / 2;
        newLeft = Math.max(0, Math.min(maxLeft, newLeft));
        
        thumb.style.left = newLeft + 'px';
        
        const scrollPercentage = newLeft / maxLeft;
        scrollCalendarToPercentage(scrollPercentage);
    });
}

// Function to scroll calendar to a specific percentage
function scrollCalendarToPercentage(percentage) {
    // Debug: Find ALL elements with scroll capability
    
    const allCalendarElements = document.querySelectorAll('#calendar *');
    const scrollableElements = [];
    
    allCalendarElements.forEach((element, index) => {
        if (element.scrollWidth > element.clientWidth) {
            const info = {
                element: element,
                selector: getElementSelector(element),
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
                maxScroll: element.scrollWidth - element.clientWidth
            };
            scrollableElements.push(info);
        }
    });
    
    // Try to use the element with the most scroll capability
    if (scrollableElements.length > 0) {
        const bestElement = scrollableElements.reduce((prev, current) => 
            current.maxScroll > prev.maxScroll ? current : prev
        );
        
        const maxScroll = bestElement.maxScroll;
        const newScrollLeft = maxScroll * percentage;
        bestElement.element.scrollLeft = newScrollLeft;
        
        return true;
    }
    
    // Fallback: try specific selectors
    const selectors = [
        '#calendar .fc-timeline-body',
        '#calendar .fc-timeline-lane',
        '#calendar .fc-timeline-slots',
        '#calendar .fc-scroller-harness',
        '#calendar .fc-scroller',
        '#calendar .fc-timeline-lane-frame',
        '#calendar .fc-view-harness',
        '#calendar .fc-timeline'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.scrollWidth > element.clientWidth) {
            const maxScroll = element.scrollWidth - element.clientWidth;
            const newScrollLeft = maxScroll * percentage;
            element.scrollLeft = newScrollLeft;
            return true;
        }
    }
    
    return false;
}

// Helper function to get CSS selector for an element
function getElementSelector(element) {
    if (element.id) return `#${element.id}`;
    if (element.className) {
        const classes = element.className.split(' ').filter(c => c.length > 0);
        if (classes.length > 0) return `.${classes.join('.')}`;
    }
    return element.tagName.toLowerCase();
}

// Create test scrollbar immediately
setTimeout(createTestScrollbar, 1000);

// Function to update scrollbar when calendar scrolls
function setupCalendarScrollListener() {
    
    // Find all scrollable elements in calendar
    const allCalendarElements = document.querySelectorAll('#calendar *');
    const scrollableElements = [];
    
    allCalendarElements.forEach((element) => {
        if (element.scrollWidth > element.clientWidth) {
            scrollableElements.push(element);
        }
    });
    
    if (scrollableElements.length > 0) {
        // Use the element with the most scroll capability
        const bestElement = scrollableElements.reduce((prev, current) => 
            (current.scrollWidth - current.clientWidth) > (prev.scrollWidth - prev.clientWidth) ? current : prev
        );
        
        bestElement.addEventListener('scroll', function() {
            const thumb = document.querySelector('#scrollbar-thumb');
            const scrollbar = document.querySelector('#custom-calendar-scrollbar');
            
            if (thumb && scrollbar) {
                const scrollLeft = bestElement.scrollLeft;
                const maxScroll = bestElement.scrollWidth - bestElement.clientWidth;
                const scrollPercentage = maxScroll > 0 ? scrollLeft / maxScroll : 0;
                
                const thumbWidth = thumb.offsetWidth;
                const maxThumbLeft = scrollbar.offsetWidth - thumbWidth;
                const newThumbLeft = scrollPercentage * maxThumbLeft;
                
                thumb.style.left = newThumbLeft + 'px';
            }
        });
        
        return true;
    }
    
    setTimeout(setupCalendarScrollListener, 2000);
    return false;
}

// Setup scroll listener after calendar loads
setTimeout(setupCalendarScrollListener, 3000);

// Add a manual inspection function that can be called from console
window.inspectCalendarScrollElements = function() {
    const allElements = document.querySelectorAll('#calendar *');
    
    allElements.forEach((element, index) => {
        if (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight) {
        }
    });
    
    // Also check the main calendar container
    const calendar = document.querySelector('#calendar');
    if (calendar) {
    }
};

// Auto-run inspection after calendar loads
setTimeout(() => {
    window.inspectCalendarScrollElements();
}, 4000);

