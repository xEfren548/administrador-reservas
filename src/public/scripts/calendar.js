document.addEventListener('DOMContentLoaded', async function () {

    // const url =  `${process.env.URL}/eventos`;
    // const urlEventos = 'https://administrador-reservas.onrender.com/eventos'
    const urlEventos = './api/eventos';
    const urlHabitaciones = './api/habitaciones';
    const urlClientes = './api/clientes/show-clients';


    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'resourceTimelineYear',
        height: 'auto',

        expandRows: true,
        navLinks: true, // can click day/week names to navigate views
        editable: true,
        selectable: true,
        nowIndicator: true,
        dayMaxEvents: true, // allow "more" link when too many events


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
                                habitaciones: 'Cabañas',
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
                        let events = data[0].events.map(function (event) {
                            return {
                                id: event._id,
                                resourceId: event.resourceId,
                                title: event.title,
                                start: new Date(event.arrivalDate),
                                end: new Date(event.departureDate),
                                url: event.url,
                                total: event.total,
                                clientId: event.client,
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


            // console.log(data);


            console.log(info);
            return {
                html: `
                <div class="p-1 rounded bg-success bg-gradient" style="overflow: hidden; font-size: 12px; position: relative;  cursor: pointer; font-family: "Overpass", sans-serif;">
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
            let newElTitle = mouseEnterInfo.event.title;
            let newElTotal = mouseEnterInfo.event.extendedProps.total;
            newEl.innerHTML = `
            <div
                class="fc-hoverable-event"
                style="position: absolute; bottom: 100%; left: 0; width: 300px; height: auto; background-color: black; z-index: 50; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.75rem; font-size: 14px; font-family: 'Inter', sans-serif; cursor: pointer;"
            >
                <strong>${newElTitle}</strong>
                <div>Total: $${newElTotal}</div>

            </div>
            `
            el.after(newEl);
        },

        eventMouseLeave: function () {
            document.querySelector(".fc-hoverable-event").remove();
        },
        eventDrop: function (info) {
            const event = info.event;
            console.log(info);
            console.log(event.id)

            fetch(`/api/eventos/${event.id}/modificar`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(info)
            })
                .then(response => response.json())
                .then(data => {
                    console.log('Respuesta del servidor: ', data);
                })
                .catch(err => {
                    console.log('Error: ', err);
                });
        },
    });
    calendar.render();

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

