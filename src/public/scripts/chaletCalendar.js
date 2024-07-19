document.addEventListener('DOMContentLoaded', function () {

    async function renderCalendar(idHabitacion) {
        const urlEventos = `/api/eventos/chalet/${idHabitacion}`;
        const urlHabitaciones = `/api/habitaciones/${idHabitacion}`;
        const urlClientes = '/api/clientes/show-clients';

        var calendarEl = document.getElementById('calendar');
        var calendar = new FullCalendar.Calendar(calendarEl, {
            height: 'auto',
            expandRows: true,
            navLinks: true,
            editable: true,
            selectable: true,
            nowIndicator: true,
            dayMaxEvents: true,
            timeZone: 'UTC',

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
                        start: new Date(event.arrivalDate),
                        end: new Date(event.departureDate),
                        url: event.url,
                        total: event.total,
                        clientId: event.client,
                        status: event.status,
                        color: event.colorUsuario
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
                const color = info.event.extendedProps.color || '#0dcaf0';

                    return {
                        html: `
                    <div class="p-1 rounded bg-gradient text-black" style="overflow: hidden; font-size: 12px; position: relative;  cursor: pointer; font-family: 'Overpass', sans-serif; color: ${color};">
                        <div>Reserva</div>
                        <div><b>Total: $ ${info.event.extendedProps.total}</b></div>
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

                    const confirmacion = await Swal.fire({
                        icon: 'warning',
                        title: '¿Estás seguro?',
                        text: 'Esta acción cambiará las fechas de la reserva.',
                        showCancelButton: true,
                        confirmButtonColor: '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: 'Sí, mover',
                        cancelButtonText: 'Cancelar'
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
                                timer: 2500
                            });
                        } catch (error) {
                            console.error('Error al actualizar fechas: ', error);
                            Swal.fire({
                                icon: 'error',
                                title: 'Error al actualizar fechas: ' + error.message,
                                showConfirmButton: false,
                                timer: 2500
                            });
                        }
                    }

                    document.querySelector(".fc-hoverable-event").remove();
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
});
