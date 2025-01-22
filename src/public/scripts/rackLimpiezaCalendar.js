document.addEventListener('DOMContentLoaded', function () {

    const urlEventos = './api/eventos';
    const urlHabitaciones = './api/habitaciones';
    const url = '/api/racklimpieza/calendardata';

    let resourceMap = {};

    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        // initialView: 'resourceTimelineMonth',
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
                                    allDay: true
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
                console.log(info.event.extendedProps);
                const color = '#0dcaf0';

                const resourceTitle = resourceMap[info.event.resourceId] || 'Unknown Resource';


                return {
                    html: `
                    <div class="p-1 rounded bg-gradient text-black" style="overflow: hidden; font-size: 12px; position: relative;  cursor: pointer; font-family: 'Overpass', sans-serif; background-color: ${color} !important;">
                        <div>${resourceTitle}</div>
                        <div>${info.event.title}</div>
                    </div>
                    `
                };
            },
    });

    calendar.render();

});