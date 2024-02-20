document.addEventListener('DOMContentLoaded', function() {
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
        events: [
            {
                id: '1',
                resourceId: '1',
                title: "Juan Perez",
                start: "2024-02-20",
                end: "2024-02-22",
                url: "https://fullcalendar.io/"
            },
            {
                id: '2',
                resourceId: '2',
                title: "Maria del Canto",
                start: "2024-02-23",
                end: "2024-02-25"
            },
            {
                id: '3',
                resourceId: '3',
                title: "Maria Antonieta",
                start: "2024-02-21",
                end: "2024-02-24"
            },
            {
                id: '4',
                resourceId: '4',
                title: "Chabelo",
                start: "2024-02-23",
                end: "2024-02-29"
            },
        ]
    });
    calendar.render();
    

    
});