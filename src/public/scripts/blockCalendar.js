const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
const monthsToShow = 24; // Mostrar 2 años

// Arreglo para almacenar todas las fechas generadas
const dateArray = [];

const restrictedDates = [
    {
        date: new Date('2024-12-01T00:00:00'), // Hora configurada
        description: 'Min 2 pax',
        min: 2
    },
    // Puedes agregar más fechas restringidas aquí
];

// Función para normalizar las fechas a medianoche (00:00:00)
function normalizeDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function createCalendar(month, year, calendarContainerId) {
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
        const currentDate = normalizeDate(new Date(year, month, day));

        // Verificar si la fecha actual coincide con alguna fecha restringida
        const isRestricted = restrictedDates.some(restrictedDate => {
            return normalizeDate(restrictedDate.date).getTime() === currentDate.getTime();
        });

        // Si es una fecha restringida, añadir la clase .restricted
        if (isRestricted) {
            dayDiv.classList.add('restricted');
        }

        daysDiv.appendChild(dayDiv);
        
        // Agregar la fecha al arreglo dateArray
        dateArray.push({ date: currentDate });
    }
    
    monthDiv.appendChild(daysDiv);

    const calendarContainer = document.getElementById(calendarContainerId);
    calendarContainer.appendChild(monthDiv);
}

function generateCalendars() {
    const calendarContainers = document.querySelectorAll('[id^="calendar-container-"]');

    calendarContainers.forEach(container => {
        let currentMonth = today.getMonth();
        let currentYear = today.getFullYear();
        for (let i = 0; i < monthsToShow; i++) {
            createCalendar(currentMonth, currentYear, container.id);
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
