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
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA SUITE CHANDE CAP.2 PAX'
            },
            {
                habitaciones: 'Hotel', title: 'MAZAMITLA CABAÑA SUITE PAULETTE CAP.2 PAX'
            },
            {
                habitaciones: 'Hotel', title: ''

            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA SUITE DIKARLO CAP.2 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUNA MIEL1 CAP.2 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUNA MIEL2 CAP.2 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUNA MIEL3 CAP.2 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA ANA CAP.2 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUZ CAP.2 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA GARDENIA1 CAP.6 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LUZ CAP.7 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA GARDENIA2 CAP.6 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA ANA CAP.10 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LETY CAP.12 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA LETY CAP.14 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA GARDENIA CAP.14 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA GARDENIA CAP.16 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA DEPARTAMENTO JADE CAP.4 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA RINCONCITO CAP.10 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA RINCONCITO CAP.12 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA JANNY CAP.14 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA MANANTIAL CAP.8 PAX'
            },
            {
                habitaciones: 'Cabañas', title: 'MAZAMITLA CABAÑA MANANTIAL CAP.14 PAX'
            }
        ]
    });
    calendar.render();
    

    
});