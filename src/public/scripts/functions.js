document.addEventListener("DOMContentLoaded", function () {
    // Functions.
    function clearModal(modal) {
        const inputs = modal.querySelectorAll('input');
        inputs.forEach(function (input) {
            input.value = "";
        });
        const selectors = modal.querySelectorAll('select');
        selectors.forEach(function (selector) {
            selector.value = "";
        });
        modal.querySelectorAll("p[name='errMsg']")[0].innerHTML = "";
    }

    // Clearing user's info when closing modal.
    const modals = document.querySelectorAll('.modal');
    modals.forEach(function (modal) {
        modal.addEventListener('hidden.bs.modal', () => {
            clearModal(modal);
        });
    });

    function calculateNightDifference() {
        console.log('Desde calcular noches')
        const arrivalValue = new Date(arrivalDate.value);
        const departureValue = new Date(departureDate.value);

        // Verifica si las fechas son válidas
        if (!isNaN(arrivalValue) && !isNaN(departureValue) && departureValue >= arrivalValue) {
            const timeDifference = departureValue.getTime() - arrivalValue.getTime();
            const nightDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)); // Calcula la diferencia en días

            nightsInput.value = nightDifference
        } else {
            nightsInput.value = 0
        }
    }

    // Creating new reservation.
    document.getElementById('save-event-btn').addEventListener('click', function () {
        // Mostrar el spinner y deshabilitar el botón
        const spinner = document.querySelector('#save-event-btn .spinner-grow');
        const spinnerText = document.querySelector('#save-event-btn .spinner-text');
        spinner.classList.remove('d-none');
        spinnerText.textContent = 'Loading...';
        this.disabled = true; // Deshabilitar el botón

        // Crear un objeto con los datos del formulario
        const formData = {
            clientEmail: document.getElementById("lblClient").value.trim(),
            arrivalDate: document.getElementById('event_start_date').value.trim(),
            departureDate: document.getElementById('event_end_date').value.trim(),
            nNights: document.getElementById("event_nights").value.trim(),
            chaletName: document.getElementById('tipologia_habitacion').value.trim(),
            maxOccupation: document.getElementById('ocupacion_habitacion').value.trim(),
            units: document.getElementById('habitacion_unidades').value.trim(),
            total: document.getElementById('habitacion_total').value.trim(),
            discount: document.getElementById('habitacion_descuento').value.trim()
        };

        fetch('/api/eventos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                response.json().then(errorData => {
                    const errors = errorData.error;
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: "Error en la solicitud: " + errors[0].message.toLowerCase() + ".",
                        confirmButtonText: 'Aceptar'
                    });   
                });                    
                throw new Error('Error en la solicitud');
            }
            return response.json();
        })
        .then(data => {
            console.log('Respuesta exitosa del servidor:', data);
            Swal.fire({
                icon: 'success',
                title: 'Reserva creada',
                text: data.message,
                showCancelButton: false,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            }).then((result) => {
                if (result.isConfirmed) {
                    clearModal(document.getElementById("event_entry_modal"));
                    $('#event_entry_modal').modal('hide');
                    window.location.href = `http://localhost:3005/api/eventos/${data.reservationId}`
                }
            });
        })
        .catch(error => {
            console.error('Ha ocurrido un error: ', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `Ha ocurrido un error al crear la reserva: ${error.message}`,                
                showCancelButton: false,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            });
        });
    })

    const nightsInput = document.querySelector('#event_nights');
    const arrivalDate = document.getElementById('event_start_date')
    const departureDate = document.getElementById('event_end_date')

    arrivalDate.addEventListener('input', calculateNightDifference);
    departureDate.addEventListener('input', calculateNightDifference);

    const tipologiaSelect = document.getElementById('tipologia_habitacion');
    const ocupacionInput = document.getElementById('ocupacion_habitacion');
    const idHabitacionInput = document.getElementById('id_cabana');

    tipologiaSelect.addEventListener('change', function () {
        const selectedOption = tipologiaSelect.options[tipologiaSelect.selectedIndex];
        const pax = selectedOption.getAttribute('data-bs-pax');
        const idHabitacion = selectedOption.getAttribute('data-bs-id');

        console.log(pax);

        if (pax != undefined && pax != null && pax.trim() !== '') {
            ocupacionInput.value = pax;
        } else {
            ocupacionInput.value = 0
        }

        idHabitacionInput.value = idHabitacion;
        console.log(idHabitacionInput);
        console.log(idHabitacionInput.value);



        obtenerTotalReserva()

    });

    arrivalDate.addEventListener('change', obtenerTotalReserva);

    // Agregar un listener para el evento change a departureDate
    departureDate.addEventListener('change', obtenerTotalReserva);

    const descuentoReservaInput = document.querySelector('#habitacion_descuento')
    descuentoReservaInput.addEventListener('input', function () {
        const subtotalInput = document.getElementById('habitacion_total');
        const totalFinal = document.getElementById('habitacion_totalcondescuento');

        if (descuentoReservaInput.value >= 0 && descuentoReservaInput.value <= 100) {
            let pretotal = subtotalInput.value * (descuentoReservaInput.value / 100)
            totalFinal.value = (parseFloat(subtotalInput.value) - parseFloat(pretotal)).toFixed(2)
        } else {
            totalFinal.value = parseFloat(subtotalInput.value).toFixed(2)

        }



    });



    async function obtenerTotalReserva() {
        const fechaInicio = new Date(`${arrivalDate.value}T00:00:00`); // Agregar la hora en formato UTC
        const fechaFin = new Date(`${departureDate.value}T00:00:00`); // Agregar la hora en formato UTC


        if (arrivalDate.value && departureDate.value && tipologiaSelect.value) {
            // Aquí puedes ejecutar la acción deseada
            console.log("Los tres elementos tienen un valor. Ejecutar acción...");
            const fechas = obtenerRangoFechas(fechaInicio, fechaFin)
            const nNights = document.getElementById("event_nights").value.trim();
            const habitacionId = idHabitacionInput.value

            const resultados = []

            try {

                for (const fecha of fechas) {
                    const year = fecha.getFullYear();
                    const month = (fecha.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
                    const day = fecha.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
                    const formatedDate = `${year}-${month}-${day}`;

                    const response = await fetch(`http://localhost:3005/api/consulta-fechas?fecha=${formatedDate}&habitacionid=${habitacionId}`);

                    // Verificar el estado de la respuesta
                    if (!response.ok) {
                        throw new Error('Error en la solicitud fetch: ' + response.statusText);
                    }

                    // Convertir la respuesta a JSON
                    console.log(response)
                    const data = await response.json();

                    // Agregar el resultado al array de resultados
                    resultados.push(data);

                }
                console.log(resultados)
                let totalPrecios = 0

                resultados.forEach(resultado => {



                    if (nNights > 1) {
                        if (resultado.precio_base_2noches) {
                            totalPrecios += resultado.precio_base_2noches
                        } else {
                            console.log('no hay precios disponibles')
                        }
                    } else {
                        if (resultado.precio_modificado) {
                            totalPrecios += resultado.precio_modificado
                        } else {
                            console.log('No hay precios disponibles')
                        }
                    }
                })

                console.log("Total precios: ", totalPrecios)
                const totalInput = document.getElementById('habitacion_total')
                totalInput.value = totalPrecios

            } catch (error) {
                console.error('Ha ocurrido un error: ', error.message);

            }

        }
    }

    function obtenerRangoFechas(fechaInicio, fechaFin) {
        const fechas = [];
        let fechaActual = new Date(fechaInicio);

        while (fechaActual < fechaFin) {
            fechas.push(new Date(fechaActual));
            fechaActual.setDate(fechaActual.getDate() + 1);
        }
        return fechas;
    }
});