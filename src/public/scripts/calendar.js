document.addEventListener('DOMContentLoaded', async function() {

    // const url =  `${process.env.URL}/eventos`;
    const url = './eventos';

        

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
            right: ' resourceTimelineMonth, resourceTimelineYear'
        },

        resourceAreaHeaderContent: 'Habitaciones',
        resourceGroupField: 'habitaciones',
        resources: [{
                id: "1", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA SUITE CHANDE CAP.2 PAX'
            },
            {
                id: "2", habitaciones: 'Hotel', title: 'MAZAMITLA CABAÑA SUITE PAULETTE CAP.2 PAX'
            },
            {
                habitaciones: 'Hotel', title: ''

            },
            {
                id: "3", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA SUITE DIKARLO CAP.2 PAX'
            },
            {
                id: "4", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUNA MIEL1 CAP.2 PAX'
            },
            {
                id: "5", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUNA MIEL2 CAP.2 PAX'
            },
            {
                id: "6", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUNA MIEL3 CAP.2 PAX'
            },
            {
                id: "7", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA ANA CAP.2 PAX'
            },
            {
                id: "8", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUZ CAP.2 PAX'
            },
            {
                id: "9", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA GARDENIA1 CAP.6 PAX'
            },
            {
                id: "10", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUZ CAP.7 PAX'
            },
            {
                id: "11", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA GARDENIA2 CAP.6 PAX'
            },
            {
                id: "12", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA ANA CAP.10 PAX'
            },
            {
                id: "13", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LETY CAP.12 PAX'
            },
            {
                id: "14", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LETY CAP.14 PAX'
            },
            {
                id: "15", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA GARDENIA CAP.14 PAX'
            },
            {
                id: "16", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA GARDENIA CAP.16 PAX'
            },
            {
                id: "17", habitaciones: 'Cabañas', title: 'MAZAMITLA DEPARTAMENTO JADE CAP.4 PAX'
            },
            {
                id: "18", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA RINCONCITO CAP.10 PAX'
            },
            {
                id: "19", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA RINCONCITO CAP.12 PAX'
            },
            {
                id: "20", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA JANNY CAP.14 PAX'
            },
            {
                id: "21", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA MANANTIAL CAP.8 PAX'
            },
            {
                id: "22", habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA MANANTIAL CAP.14 PAX'
            }
        ],
        events:
        function(info, successCallback, failureCallback) {
            fetch(url)
                .then(function(response) {
                    return response.json()
                })
                .then(function(data){
                    // console.log(data);
                    let events = data[0].events.map(function(event){
                        return {
                            id: event.id,
                            resourceId: event.resourceId,
                            title: event.title,
                            start: new Date(event.start),
                            end: new Date(event.end),
                            url: event.url,
                            total: event.total
                        }
                    })
                    successCallback(events);
                    // console.log(events);
                })
                .catch(function (error) {
                    failureCallback(error);
                })
        },
        eventContent: function(info) {
            // console.log(info);
            return {
                html: `
                <div class="p-1 rounded bg-success bg-gradient" style="overflow: hidden; font-size: 12px; position: relative;  cursor: pointer; font-family: "Overpass", sans-serif;">
                    <div>${info.event.title}</div>
                    <div><b>Total: $ ${info.event.extendedProps.total}</b></div>
                </div>
                `
            }
        },
        eventMouseEnter: function(mouseEnterInfo) {
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

        eventMouseLeave: function() {
            document.querySelector(".fc-hoverable-event").remove();
        },
    });
    calendar.render();
    

    
});