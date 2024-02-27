// const saveEventBtn = document.querySelector('#save-event-btn');


// const eventName = document.querySelector('#event_name');
// const eventStart = document.querySelector('#event_start_date');
// const eventEnd = document.querySelector('#event_end_date');


// saveEventBtn.addEventListener('click', agregarEvento);

document.getElementById('save-event-btn').addEventListener('click', function () {
    const eventStartDate = document.getElementById('event_start_date').value;
    const eventEndDate = document.getElementById('event_end_date').value;
    const eventNights = document.getElementById('event_nights').value;
    const tipologiaHabitacion = document.getElementById('tipologia_habitacion').value;
    const ocupacionHabitacion = document.getElementById('ocupacion_habitacion').value;
    const unidades = document.getElementById('habitacion_unidades').value;
    const total = document.getElementById('habitacion_total').value;
    const descuento = document.getElementById('habitacion_descuento').value;


    // Crear un objeto con los datos del formulario
    const formData = {
        resourceId: '10',
        title: 'Reserva pepe',
        start: eventStartDate,
        end: eventEndDate,
        // eventNights: eventNights,
        total: total,
    };

    const url = 'localhost:3005/eventos'

    fetch('/eventos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
        .then(response => response.json())
        .then(data => {
            console.log('Respuesta del servidor: ', data);
        })
        .catch(err => {
            console.log('Error: ', err);
        });
})