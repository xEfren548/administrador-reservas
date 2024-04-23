function mostrarIconoSeleccionado() {
    const seleccion = document.getElementById('accion-precios').value;
    const iconoSeleccionado = document.getElementById('icono-seleccionado');

    // Dependiendo de la opción seleccionada, mostramos el icono correspondiente
    switch (seleccion) {
        case 'precio-fijo':
            iconoSeleccionado.innerHTML = '<i class="fa fa-dollar" aria-hidden="true"></i>';
            break;
        case 'incrementar-natural':
        case 'disminuir-natural':
            iconoSeleccionado.innerHTML = '<i class="fa fa-dollar" aria-hidden="true"></i>';
            break;
        case 'incrementar-porcentual':
        case 'disminuir-porcentual':
            iconoSeleccionado.innerHTML = '<i class="fa fa-percent" aria-hidden="true"></i>';
            break;
        default:
            break;
    }
}

// Llamar a la función al cargar la página para mostrar el icono seleccionado inicialmente
mostrarIconoSeleccionado();

// Agregar un event listener al campo #accion-precios para actualizar el icono seleccionado cuando cambie la selección
document.getElementById('accion-precios').addEventListener('change', function () {
    mostrarIconoSeleccionado();
});

document.getElementById('select-cabana').addEventListener('change', function () {
    const selectElement = document.getElementById('select-cabana');
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const precioBase = selectedOption.getAttribute('data-precio-base');
    document.getElementById('precio-base-input-id').value = precioBase;
});

const botonFormulario = document.querySelector('#update-prices-btn');

botonFormulario.addEventListener('click', async function (e) {
    e.preventDefault();

    // Obtener los datos del formulario
    const habitacionAmodificar = document.querySelector('#select-cabana').value;
    const fechaInicio = new Date(document.querySelector('#fecha-inicio').value);
    const fechaFin = new Date(document.querySelector('#fecha-fin').value);
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const diasSeleccionados = [];
    checkboxes.forEach(function (checkbox) {
        if (checkbox.checked) {
            diasSeleccionados.push(checkbox.value);
        }
    });
    const accionPrecios = document.querySelector('#accion-precios').value;
    const valorAccion = parseInt(document.querySelector('#valor-accion').value);
    const precioCabana = parseInt(document.querySelector('#precio-base-input-id').value);
    let precioFinal = 0

    // Validar que la fecha final sea posterior o igual a la fecha inicial
    if (fechaInicio === '' || fechaFin === '') {
        // Mostrar mensaje de error en el modal
        const errorModal = document.querySelector('#error-modal');
        errorModal.textContent = 'Por favor, seleccione una fecha de inicio y una fecha de fin.';
        errorModal.style.display = 'block'; // Mostrar el mensaje de error
        return; // Detener la ejecución del resto del código
    }

    // Restablecer el mensaje de error en el modal
    const errorModal = document.querySelector('#error-modal');
    errorModal.innerHTML = '';
    errorModal.classList.remove('show');

    // Validacion para actualizar el precio natural o precio porcentual
    const seleccion = document.getElementById('accion-precios').value;

    switch (seleccion) {
        case 'precio-fijo':
            precioFinal = valorAccion;
            break;
        case 'incrementar-natural':
            precioFinal = precioCabana + valorAccion;
            break;
        case 'disminuir-natural':
            precioFinal = precioCabana - valorAccion;
            break;
        case 'incrementar-porcentual':
            precioFinal = precioCabana * (valorAccion / 100) + precioCabana;
            break;
        case 'disminuir-porcentual':
            let pre = precioCabana * (valorAccion / 100)
            precioFinal = precioCabana - pre;
            break;
    }

    console.log(precioFinal);

    // Función para realizar el fetch repetido para cada fecha en el rango
    async function fetchRepetido(url, fechas) {
        try {
            const resultados = [];

            // Iterar sobre cada fecha en el rango
            for (const fecha of fechas) {
                const existeRegistro = await verificarExistenciaRegistro(url, fecha, habitacionAmodificar);

                // Obtener el objeto de datos para enviar en la solicitud fetch
                if (!existeRegistro) {
                    // Obtener el objeto de datos para enviar en la solicitud fetch
                    const datosFetch = {
                        precio_modificado: precioFinal,
                        fecha: fecha,
                        habitacionId: habitacionAmodificar
                    };

                    console.log(JSON.stringify(datosFetch));

                    // Realizar la solicitud fetch para la fecha actual con los datos especificados
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(datosFetch)
                    });

                    // Verificar el estado de la respuesta
                    if (!response.ok) {
                        throw new Error('Error en la solicitud fetch: ' + response.statusText);
                    }

                    // Convertir la respuesta a JSON
                    const data = await response.json();

                    // Agregar el resultado al array de resultados
                    resultados.push(data);
                }
            }

            return resultados;
        } catch (error) {
            console.error('Error al realizar el fetch repetido:', error);
            throw error;
        }
    }


    // Función para obtener un rango de fechas entre la fecha de inicio y la fecha de fin
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

    // Función para obtener el nombre del día de la semana
    function obtenerNombreDia(fecha) {
        const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        console.log([fecha.getDay()]);
        return diasSemana[fecha.getDay()];
    }

    async function verificarExistenciaRegistro(url, fecha, habitacionId) {
        try {
            const response = await fetch(`${url}?fecha=${fecha}&habitacionId=${habitacionId}`);
            if (!response.ok) {
                throw new Error('Error al verificar la existencia del registro en la base de datos');
            }
            const data = await response.json();
            return data.length > 0; // Devuelve true si ya existe un registro, false de lo contrario
        } catch (error) {
            console.error('Error al verificar la existencia del registro:', error);
            throw error;
        }
    }

    // URL para la solicitud fetch (debes reemplazarla con tu propia URL)
    const url = 'http://localhost:3005/api/calendario-precios';

    // Obtener el rango de fechas entre fechaInicio y fechaFin
    const fechas = obtenerRangoFechas(fechaInicio, fechaFin);



    try {
        // Realizar el fetch repetido para cada fecha en el rango

        const resultados = await fetchRepetido(url, fechas);

        if (resultados.length === 0) {
            throw new Error('No hay fechas seleccionadas para actualizar.');
        }

        Swal.fire({
            icon: 'success',
            title: '¡Completado!',
            text: 'Precios actualizados correctamente.',
            confirmButtonText: 'Aceptar'
        }).then((result) => {
            // Verificar si el usuario hizo clic en el botón de confirmación
            if (result.isConfirmed) {
                // Actualizar la página
                location.reload();
            }
        });


        // Manejar los resultados obtenidos
        console.log('Resultados de fetch repetido:', resultados);
        // Aquí puedes realizar cualquier otra acción con los resultados obtenidos
    } catch (error) {
        console.error('Error al realizar el fetch repetido:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al actualizar los precios. Por favor, verifica que todos los campos están completos o intenta de nuevo más tarde.',
            confirmButtonText: 'Aceptar'
        });
    }
});

