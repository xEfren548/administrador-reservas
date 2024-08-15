const calendarContainer = document.getElementById('calendar-container');
const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
const monthsToShow = 24; // Mostrar 2 años

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
        daysDiv.appendChild(dayDiv);
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
