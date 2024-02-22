const Reserva = require('../../../models/Evento'); // Importa el modelo de reserva

const saveEventBtn = document.querySelector('#save-event-btn');


const eventName = document.querySelector('#event_name');
const eventStart = document.querySelector('#event_start_date');
const eventEnd = document.querySelector('#event_end_date');


saveEventBtn.addEventListener('click', agregarEvento);

// const newEvent = {
//     id: "5",
//     resourceId: "10",
//     title: "Juan Lopez",
//     start: "2024-02-20",
//     end: "2024-02-22",
//     url: "https://fullcalendar.io/",
//     total: 3300
// }
// Define la función para agregar un evento
function agregarEvento(evento) {


}