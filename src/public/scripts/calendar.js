document.addEventListener('DOMContentLoaded', async function () {

    // const url =  `${process.env.URL}/eventos`;
    // const urlEventos = 'https://administrador-reservas.onrender.com/eventos'
    const urlEventos = './api/eventos';
    const urlHabitaciones = './api/habitaciones';
    const urlClientes = './api/clientes/show-clients';
    var today = new Date();
    var milliseconds = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(today.getFullYear(), 0, 0);


    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'resourceTimelineYear',
        scrollTime: milliseconds,
        height: 'auto',
        expandRows: true,
        navLinks: true, // can click day/week names to navigate views
        editable: true,
        selectable: true,
        nowIndicator: true,
        dayMaxEvents: true, // allow "more" link when too many events
        timeZone: 'UTC',

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
                        let resources = data[0].resources.map(function (event) {
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
                fetch(urlEventos)
                    .then(function (response) {
                        return response.json()
                    })
                    .then(function (data) {
                        // console.log(data);
                        let events = data[0].events
                            .filter(event => event.status !== 'cancelled')
                            .map(function (event) {

                                return {
                                    id: event._id,
                                    resourceId: event.resourceId,
                                    title: event.title,
                                    start: new Date(event.arrivalDate),
                                    end: new Date(event.departureDate),
                                    url: event.url,
                                    total: event.total,
                                    clientId: event.client,
                                    status: event.status,
                                    createdBy: event.createdBy,
                                    comisionVendedor: event.comisionVendedor
                                }
                            })
                        successCallback(events);
                        // console.log(events);
                    })
                    .catch(function (error) {
                        failureCallback(error);
                    })
            },
        eventContent: function (info) {
            
            let background;
            let textColor;

            if (info.event.extendedProps.status === 'active') {
                background = 'bg-success';
                textColor = 'text-white';
            } else if (info.event.extendedProps.status === 'playground') {
                background = 'bg-warning';
                textColor = 'text-black-50';
            } else if (info.event.extendedProps.status === 'cancelled') {
                background = 'bg-danger';
                textColor = 'text-white';
            } else if (info.event.extendedProps.status === 'pending') {
                background = 'bg-info';
                textColor = 'text-black';
            }





            console.log(info);
            return {
                html: `
                <div class="p-1 rounded ${background} bg-gradient ${textColor}" style="overflow: hidden; font-size: 12px; position: relative;  cursor: pointer; font-family: "Overpass", sans-serif;">
                    <div>Reserva</div>
                    <div><b>Total: $ ${info.event.extendedProps.total}</b></div>
                </div>
                `
            }
        },
        eventMouseEnter: function (mouseEnterInfo) {
            let el = mouseEnterInfo.el;
            el.classList.add("relative");

            let newEl = document.createElement("div");
            let newElTitle = mouseEnterInfo.event.id;
            let newElTotal = mouseEnterInfo.event.extendedProps.total;
            let newElStatus = mouseEnterInfo.event.extendedProps.status;
            newEl.innerHTML = `
            <div
                class="fc-hoverable-event"
                style="position: absolute; top: 100%; left: 0; width: 300px; height: auto; background-color: black; z-index: 100000000 !important; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.75rem; font-size: 14px; font-family: 'Inter', sans-serif; cursor: pointer;"
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
            const event = info.event;
            console.log(info);
            idReserva = event.id;
            const newEventStart = info.event.start;
            const eventDateStart = new Date(newEventStart);

            const newEventEnd = info.event.end;
            const eventDateEnd = new Date(newEventEnd);
            const comisionVendedor = info.event.extendedProps.comisionVendedor;
            const totalViejo = info.event.extendedProps.total;

            const resourceId = (info.newResource && info.newResource.id) || info.el.fcSeg.eventRange.def.resourceIds[0];

            console.log(eventDateStart, eventDateEnd)

            const hoverableEventElement = document.querySelector(".fc-hoverable-event");
            if (hoverableEventElement) {
                hoverableEventElement.remove();
            }
            const nuevoTotal = await obtenerNuevoTotal(resourceId, eventDateStart, eventDateEnd, comisionVendedor);
            let diferencia = nuevoTotal - totalViejo; // 2650 - 3250 
            console.log(diferencia)

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

                console.log(info)

                const newResource = info.newResource ? { id: info.newResource.id } : null;
                console.log(newResource);

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

                    console.log('Respuesta del servidor: ', data);
                } catch (err) {
                    console.log('Error: ', err);
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
        }
    });
    calendar.render();





    var contextMenu = document.getElementById('context-menu');
    const moveToActiveEl = document.getElementById('move-to-active');
    const moveToPlaygroundEl = document.getElementById('move-to-playground');
    const cancelReservationEl = document.getElementById('delete');
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
        } else if (currentEvent.extendedProps.status === 'pending') {
            moveToPlaygroundEl.style.display = 'none';
            moveToActiveEl.style.display = 'none';
            cancelReservationEl.style.display = 'block';
        }
        else {
            moveToPlaygroundEl.style.display = 'none';
            moveToActiveEl.style.display = 'none';
            cancelReservationEl.style.display = 'none';

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
                    console.log(eventData);

                })
                .catch(err => {
                    console.log('Error: ', err);
                });
        } catch (err) {
            console.log(err);
        }
    }

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

    console.log(arrivalDateSend)
    console.log(departureDateSend)

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
            const comisionUsuarios = await obtenerComisiones() 
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

async function obtenerComisiones() {
    try {
        const response = await fetch('/api/utilidades');
        const data = await response.json();
        const minComission = data.minComission
        const finalComission = data.finalComission
        const comisiones = { minComission: minComission, finalComission: finalComission }
        return comisiones

    } catch (error) {
        console.log(error.message);
    }
}

