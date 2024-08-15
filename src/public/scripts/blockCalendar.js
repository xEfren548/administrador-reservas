const calendarContainer = document.getElementById('calendar-container');
const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
const monthsToShow = 24; // Mostrar 2 años

const dateArray = [];

const restrictedDates = [
    {
        date: new Date('2024-12-01T00:00:00'),
        description: 'Min 2 pax',
        min: 2
    }
]



function createCalendar(month, year) {
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
        
        // Crear un objeto de fecha y agregarlo al arreglo
        const currentDate = new Date(year, month, day);
        
        // Verificar si la fecha actual coincide con alguna fecha restringida
        const isRestricted = restrictedDates.some(restrictedDate => {
            console.log('Restricted date: ' + restrictedDate.date);
            console.log('Current date: ' + currentDate);
            return restrictedDate.date.getTime() === currentDate.getTime();
        });
        
        
        // Si es una fecha restringida, añadir la clase .restricted
        if (isRestricted) {
            console.log('Coincide!!!')
            dayDiv.classList.add('restricted');
        }

        daysDiv.appendChild(dayDiv);

        dateArray.push({ date: currentDate });
    }
    
    monthDiv.appendChild(daysDiv);
    calendarContainer.appendChild(monthDiv);
}

for (let i = 0; i < monthsToShow; i++) {
    createCalendar(currentMonth, currentYear);
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
}

console.log(dateArray)