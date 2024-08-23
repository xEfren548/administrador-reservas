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

    // Set an ID if this is the current month and year
    if (month === today.getMonth() && year === today.getFullYear()) {
        monthHeader.id = `current-month-${calendarContainerId}`;
    }

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
            if (restrictedDate.habitacionId === chaletId) {
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
        let currentMonth = 0;
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

function goToCurrentMonth(name) {

    const currentMonthElement = document.getElementById(`current-month-calendar-container-${name}`);
    if (currentMonthElement) {
        currentMonthElement.scrollIntoView({ behavior: 'smooth' });
    }
}

function scrollToCurrentMonth() {
    const currentMonthName = today.toLocaleString('es-ES', { month: 'long' });
    const currentYear = today.getFullYear();

    const calendarContainers = document.querySelectorAll('[id^="calendar-container-"]');

    calendarContainers.forEach(container => {
        const monthHeaders = container.querySelectorAll('.month-header');
        monthHeaders.forEach(header => {
            if (header.textContent.trim().toLowerCase() === `${currentMonthName} ${currentYear}`.toLowerCase()) {
                setTimeout(() => {
                    header.scrollIntoView({ behavior: 'smooth' });
                }, 0);
            }
        });
    });
}

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

const agregarFechasBtn = document.querySelector('#add-bloqueadas-btn');

agregarFechasBtn.addEventListener("click", async (e) => {
    e.preventDefault()
    const fechaInicioString = document.querySelector('#fecha-inicio').value; // Obtener el valor del input de tipo date
    const fechaInicio = new Date(`${fechaInicioString}T00:00:00`); // Agregar la hora en formato UTC

    const fechaFinString = document.querySelector('#fecha-fin').value; // Obtener el valor del input de tipo date
    const fechaFin = new Date(`${fechaFinString}T00:00:00`); // Agregar la hora en formato UTC

    const diasSeleccionados = [];

    const checkboxes = document.querySelectorAll('input[type="checkbox"].chk-general');
    checkboxes.forEach(function (checkbox) {
        if (checkbox.checked) {
            diasSeleccionados.push(checkbox.value);
        }
    });

    const fechas = obtenerRangoFechas(fechaInicio, fechaFin);

    try {
        const resultados = await fetchRepetido(fechas);
        console.log(resultados)
        if (resultados.length === 0) {
            throw new Error('No hay fechas seleccionadas para actualizar.');
        }

        Swal.fire({
            icon: 'success',
            title: '¡Completado!',
            text: 'Precios actualizados correctamente.',
            confirmButtonText: 'Aceptar'
        }).then((result) => {
            console.log('Resultados de fetch repetido:', resultados);
            // Verificar si el usuario hizo clic en el botón de confirmación
            if (result.isConfirmed) {
                // Actualizar la página
                location.reload();
            }
        });

    } catch (error) {
        console.error(error)
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al actualizar los precios. Por favor, verifica que todos los campos están completos o intenta de nuevo más tarde.',
            confirmButtonText: 'Aceptar'
        });
    }



    async function fetchRepetido(fechas) {
        try {
            console.log('Holaaaaa')

            const resultados = [];
            console.log('ejecutando fetch repetido...');

            // const {date, description, min, habitacionId} = req.body;
            const estanciaMinima = document.querySelector('#estancia-minima-select')
            const habitacionId = document.querySelector('#select-cabana').value

            for (const fecha of fechas) {

                const jsonBody = {
                    date: fecha,
                    min: estanciaMinima.value,
                    habitacionId: habitacionId
                }

                const response = await fetch('/api/calendario-bloqueofechas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(jsonBody)
                })

                // Verificar el estado de la respuesta
                if (!response.ok) {
                    throw new Error('Error en la solicitud fetch: ' + response.message);
                }

                // Convertir la respuesta a JSON
                const data = await response.json();
                console.log(data);

                // Agregar el resultado al array de resultados
                resultados.push(data);

            }

            return resultados;

        } catch (e) {
            console.error(e);
            throw error;
        }
    }

    function obtenerRangoFechas(fechaInicio, fechaFin) {
        const fechas = [];
        let fechaActual = new Date(fechaInicio);

        while (fechaActual <= fechaFin) {
            if (diasSeleccionados.includes(obtenerNombreDia(fechaActual))) {
                fechas.push(new Date(fechaActual));
            }
            fechaActual.setDate(fechaActual.getDate() + 1);
        }
        return fechas;
    }

    function obtenerNombreDia(fecha) {
        const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        return diasSemana[fecha.getDay()];
    }
});

