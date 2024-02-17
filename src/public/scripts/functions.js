const saveEventBtn = document.querySelector('#save-event-btn');

const eventName = document.querySelector('#event_name');
const eventStart = document.querySelector('#event_start_date');
const eventEnd = document.querySelector('#event_end_date');


saveEventBtn.addEventListener('click', saveEvent);

function saveEvent(e) {
    console.log(eventName.value)
    console.log(eventStart.value)
    console.log(eventEnd.value)
    
    
}


