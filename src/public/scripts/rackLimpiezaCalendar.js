document.addEventListener('DOMContentLoaded', function () {
    
    async function renderCalendar(idHabitacion) {
        
        const urlEventos = './api/eventos';
        const urlHabitaciones = './api/habitaciones';
        const url = `/api/racklimpieza/calendardata?idHabitacion=${idHabitacion}`;
        
        let resourceMap = {};
        
        var calendarEl = document.getElementById('calendar');
        var calendar = new FullCalendar.Calendar(calendarEl, {
            // initialView: 'resourceTimelineMonth',
            locale: 'es',
            scrollTime: '00:00:00',
            height: 'auto',
            expandRows: true,
            navLinks: false, // can click day/week names to navigate views
            editable: false,
            selectable: false,
            nowIndicator: true,
            dayMaxEvents: true, // allow "more" link when too many events
            timeZone: 'America/Mexico_City',
            resourceAreaWidth: '200px', // Adjust as per your layout
            slotMinWidth: 100, // Adjust column width for better layout
        
        
            resourceAreaHeaderContent: 'Habitaciones',
            resourceGroupField: 'habitaciones',
        
            resources:
                function (info, successCallback, failureCallback) {
                    fetch(url)
                        .then(function (response) {
                            return response.json()
                        })
                        .then(function (data) {
                            console.log(data)
                            let resources = data.resources.map(resource => {
                                resourceMap[resource._id] = resource.propertyDetails.name;
                                return {
                                    id: resource._id,
                                    habitaciones: resource.propertyDetails.accomodationType,
                                    title: resource.propertyDetails.name
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
                    fetch(url)
                        .then(function (response) {
                            return response.json()
                        })
                        .then(function (data) {
                            console.log(data);
                            let events = data.events
                                // .filter(event => (event.status !== 'cancelled') && (event.status !== 'no-show'))
                                .map(function (event) {
        
                                    return {
                                        id: event._id,
                                        resourceId: event.resourceId,
                                        title: event.title,
                                        start: event.arrivalDate.split('T')[0],
                                        end: event.departureDate.split('T')[0],
                                        total: event.total,
                                        clientId: event.client,
                                        status: event.status,
                                        createdBy: event.createdBy,
                                        comisionVendedor: event.comisionVendedor,
                                        clientName: event.clientName,
                                        clientPayments: event.pagosTotales,
                                        madeCheckIn: event.madeCheckIn,
                                        cleaningDetails: event.cleaningDetails,
                                        allDay: true,
                                        color: event.colorUsuario
                                    }
                                })
                            console.log(events);
                            successCallback(events);
                            $(spinner).addClass('loader--hidden')
                        })
                        .catch(function (error) {
                            console.log(error);
                            failureCallback(error);
                        })
                },
                eventContent: function (info) {
                    console.log(info);
                    const color = info.backgroundColor || '#0dcaf0';

                    console.log(resourceMap);
        
                    const resourceTitle = resourceMap[info.event._def.resourceIds[0]] || 'Unknown Resource';
        
        
                    return {
                        html: `
                        <div class="p-1 rounded bg-gradient text-black" style="overflow: hidden; font-size: 12px; position: relative;  cursor: pointer; font-family: 'Overpass', sans-serif; background-color: ${color} !important;">
                            <div class="font-weight-bold">${resourceTitle}</div>
                            <div>Reserva</div>
                        </div>
                        `
                    };
                },
                eventMouseEnter: function (mouseEnterInfo) {
                    let el = mouseEnterInfo.el;
                    el.classList.add("relative");
        
                    let newEl = document.createElement("div");
                    let newElStart = new Date(mouseEnterInfo.event.start);
                    newElStart.setUTCHours(newElStart.getUTCHours() + 6);
                    newElStart = newElStart.toISOString().split('T')[0];
                    let newElEnd = new Date(mouseEnterInfo.event.end);
                    newElEnd.setUTCHours(newElEnd.getUTCHours() + 6);
                    newElEnd = newElEnd.toISOString().split('T')[0];
        
                    newEl.innerHTML = `
                        <div class="fc-hoverable-event" style="position: absolute; top: 100%; left: 0; width: 200px; height: auto; background-color: black; z-index: 100000000 !important; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.75rem; font-size: 14px; font-family: 'Inter', sans-serif; cursor: pointer;">
                            <strong>Llegada: ${newElStart}</strong>
                            <br>
                            <strong>Salida: ${newElEnd}</strong>
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
        });
        
        calendar.render();
    }

    
    const tipologiaHabitacionSelect = document.querySelector('#tipologia_habitacion');

    tipologiaHabitacionSelect.addEventListener('change', function () {
        const selectedOption = tipologiaHabitacionSelect.options[tipologiaHabitacionSelect.selectedIndex];
        const id = selectedOption.getAttribute('data-bs-id');
        renderCalendar(id);
    });


});