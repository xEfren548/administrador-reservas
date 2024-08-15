const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
const monthsToShow = 24; // Mostrar 2 años

// Arreglo para almacenar todas las fechas generadas
const dateArray = [];
let restrictedDates = [];

async function fetchRestrictedDates() {
    try {
        const response = await fetch('/api/calendario-bloqueofechas');
        if (!response.ok) {
            throw new Error('Error al obtener las fechas restringidas');
        }
        restrictedDates = await response.json(); // Asumimos que la API devuelve un arreglo de objetos con date, description y min
    } catch (error) {
        console.error('Error al hacer fetch:', error);
    }
}

// const restrictedDates = [
//     {
//         date: new Date('2024-12-01T00:00:00'), // Hora configurada
//         description: 'Min 2 pax',
//         min: 2
//     },
//     // Puedes agregar más fechas restringidas aquí
// ];


// Función para normalizar las fechas a medianoche (00:00:00)
function normalizeDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function createCalendar(month, year, calendarContainerId, chaletId) {
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const monthDiv = document.createElement('div');
    monthDiv.classList.add('month', 'col-md-4');
    
    const monthHeader = document.createElement('div');
    monthHeader.classList.add('month-header');
    monthHeader.textContent = `${monthNames[month]} ${year}`;
    monthDiv.appendChild(monthHeader);
    
    const weekdaysDiv = document.createElement('div');
    weekdaysDiv.classList.add('weekdays');
    const weekdays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    weekdays.forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.textContent = day;
        weekdaysDiv.appendChild(dayDiv);
    });
    monthDiv.appendChild(weekdaysDiv);
    
    const daysDiv = document.createElement('div');
    daysDiv.classList.add('days');
    
    for (let i = 0; i < firstDay; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('empty-day');
        daysDiv.appendChild(emptyDiv);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.textContent = day;


        // Crear un objeto de fecha para este día y normalizarla
        const currentDate = new Date(year, month, day).toISOString().split("T")[0];
        let description = ''
        // Verificar si la fecha actual coincide con alguna fecha restringida
        const isRestricted = restrictedDates.some(restrictedDate => {
            if (restrictedDate.habitacionId === chaletId){
                description = restrictedDate.description;
                return restrictedDate.date.split("T")[0] === currentDate;

            }
        });

        // Si es una fecha restringida, añadir la clase .restricted
        if (isRestricted) {
            dayDiv.classList.add('restricted');
            dayDiv.setAttribute('data-description', description);
        }

        daysDiv.appendChild(dayDiv);
        
        // Agregar la fecha al arreglo dateArray
        dateArray.push({ date: currentDate });
    }
    
    monthDiv.appendChild(daysDiv);

    const calendarContainer = document.getElementById(calendarContainerId);
    calendarContainer.appendChild(monthDiv);
}

async function generateCalendars() {
    await fetchRestrictedDates(); // Esperamos a que se obtengan las fechas restringidas antes de generar el calendario
    console.log(restrictedDates);
    const calendarContainers = document.querySelectorAll('[id^="calendar-container-"]');

    calendarContainers.forEach(container => {
        const chaletId = container.getAttribute('data-id');
        let currentMonth = today.getMonth();
        let currentYear = today.getFullYear();
        for (let i = 0; i < monthsToShow; i++) {
            createCalendar(currentMonth, currentYear, container.id, chaletId);
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }
    });
}

generateCalendars();

console.log(dateArray); // Aquí puedes ver todas las fechas generadas
window.addEventListener("load", () => {
    const preloader = document.querySelector(".pre-loader");
    preloader.classList.add("loader--hidden");
    preloader.addEventListener("transitionend", () => {
        if (preloader) {
            preloader.style.display = "none"; // Hide instead of removing
        }
    });
});

// document.addEventListener("DOMContentLoaded", () => {
//     const fechasBloqueadas = document.querySelectorAll('.restricted');
//     console.log(fechasBloqueadas)
    
//     fechasBloqueadas.forEach(fechasBloqueada => {
//         fechasBloqueada.addEventListener('click', (event) => {
//             const description = event.target.getAttribute('data-description');
//             alert(description);
//         });
//     });

// })
