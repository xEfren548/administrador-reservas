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

    let preciosTotalesGlobal = 0
    let precioMinimoPermitido = 0
    let comisionesReserva = 0

    const totalCostoBaseInput = document.querySelector("#total-costo-base")
    let totalSinComisiones = document.querySelector("#total-sin-comisiones")

    if (totalSinComisiones.value === undefined || totalSinComisiones.value === null || !totalSinComisiones.value) {
        totalSinComisiones.value = 0
    }

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

    async function showAvailableChalets() {

        const arrivalValue = new Date(`${arrivalDate.value}T00:00:00`);
        const departureValue = new Date(`${departureDate.value}T00:00:00`);
        const tipologiaHabitacionInput = document.querySelector('#tipologia_habitacion');
        const options = tipologiaHabitacionInput.querySelectorAll('option');

        const verificarDisponibilidadElement = document.getElementById('verificar-disponibilidad');

        const dataBsIds = [];


        try {
            if (!isNaN(arrivalValue) && !isNaN(departureValue) && departureValue >= arrivalValue) {

                console.log(arrivalValue)
                console.log(departureValue)

                verificarDisponibilidadElement.style.display = 'block';

                const arrivalYear = arrivalValue.getFullYear();
                const arrivalMonth = (arrivalValue.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
                const arrivalDay = arrivalValue.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
                const arrivalDate = `${arrivalYear}-${arrivalMonth}-${arrivalDay}`;

                const departureYear = departureValue.getFullYear();
                const departureMonth = (departureValue.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
                const departureDay = departureValue.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
                const departureDate = `${departureYear}-${departureMonth}-${departureDay}`;

                console.log(arrivalDate)
                console.log(departureDate)


                options.forEach(option => {
                    const dataBsId = option.getAttribute('data-bs-id');
                    if (dataBsId) {
                        dataBsIds.push(dataBsId);
                    }
                });
                console.log(dataBsIds);

                const results = [];
                for (const idHabitacion of dataBsIds) {
                    const response = await fetch(`/api/check-availability/?resourceId=${idHabitacion}&arrivalDate=${arrivalDate}&departureDate=${departureDate}`);
                    const result = await response.json();
                    results.push({ idHabitacion, available: result.available });
                }

                console.log(results);

                results.forEach(result => {
                    const option = document.querySelector(`option[data-bs-id="${result.idHabitacion}"]`);
                    if (result.available) {
                        option.style.backgroundColor = 'lightgreen'; // Marca las cabañas disponibles
                        option.disabled = false;
                    } else {
                        option.style.backgroundColor = 'lightcoral'; // Marca las cabañas no disponibles
                        option.disabled = true;
                    }
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: "Error en la solicitud: " + error.message,
                confirmButtonText: 'Aceptar'
            });
        } finally {
            verificarDisponibilidadElement.style.display = 'none';
        }


    }

    // Creating new reservation.
    document.getElementById('save-event-btn').addEventListener('click', async function () {
        // Mostrar el spinner y deshabilitar el botón
        const spinner = document.querySelector('#save-event-btn .spinner-grow');
        const spinnerText = document.querySelector('#save-event-btn .spinner-text');
        spinner.classList.remove('d-none');
        spinnerText.textContent = 'Loading...';
        this.disabled = true; // Deshabilitar el botón

        try {
            // Esperar a que obtenerComisiones() se resuelva            
            comisionesReserva = document.getElementById('habitacion_total').value.trim() - precioMinimoPermitido; // 3250 - 3000
            console.log(comisionesReserva)
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
                discount: document.getElementById('habitacion_descuento').value.trim(),
                isDeposit: document.getElementById('chckDeposit').checked,
                comisionVendedor: comisionesReserva
            };

            if (!formData.units) {
                throw new Error('Asegúrate de poner las unidades.')
            }

            console.log(preciosTotalesGlobal)
            console.log("precioMinimoPermitido: ", precioMinimoPermitido)

            if (formData.total > preciosTotalesGlobal) {
                throw new Error(`No puedes dar un precio mayor al establecido ($${preciosTotalesGlobal})`);
            }

            if (formData.total < precioMinimoPermitido) {
                throw new Error(`No puedes dar un precio menor al establecido ($${precioMinimoPermitido})`); //
            }


            const response = await fetch('/api/eventos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errors = errorData.error;
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: "Error en la solicitud: " + errors[0].message.toLowerCase() + ".",
                    confirmButtonText: 'Aceptar'
                });
                throw new Error('Error en la solicitud');
            }

            const data = await response.json();
            console.log('Respuesta exitosa del servidor:', data);

            const reservationId = data.reservationId;

            const comisionBody = {
                precioMinimo: precioMinimoPermitido,
                precioMaximo: preciosTotalesGlobal,
                costoBase: totalCostoBaseInput.value,
                totalSinComisiones: totalSinComisiones.value,
                precioAsignado: formData.total,
                chaletName: formData.chaletName,
                idReserva: reservationId,
                arrivalDate: formData.arrivalDate,
                departureDate: formData.departureDate

            }

            const agregarComisiones = await fetch('/api/utilidades/reserva', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(comisionBody)
            })

            if (!agregarComisiones.ok) {
                const additionalErrorData = await agregarComisiones.json();
                const additionalErrors = additionalErrorData.error;
                Swal.fire({
                    icon: 'error',
                    title: 'Additional Error',
                    text: "Error en la solicitud adicional: " + additionalErrors[0].message.toLowerCase() + ".",
                    confirmButtonText: 'Aceptar'
                });
                throw new Error('Error en la solicitud adicional');
            }

            const additionalData = await agregarComisiones.json();
            console.log('Additional data received:', additionalData);




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
                    window.location.href = `/api/eventos/${data.reservationId}`;
                }
            });

        } catch (error) {
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

        } finally {
            // Ocultar el spinner y habilitar el botón nuevamente en caso de error
            spinner.classList.add('d-none');
            spinnerText.textContent = 'Crear Reserva'; // Limpiar el texto
            document.getElementById('save-event-btn').disabled = false; // Habilitar el botón
        }
    });

    const nightsInput = document.querySelector('#event_nights');
    const arrivalDate = document.getElementById('event_start_date')
    const departureDate = document.getElementById('event_end_date')
 

    arrivalDate.addEventListener('input', calculateNightDifference);
    departureDate.addEventListener('input', calculateNightDifference);
    arrivalDate.addEventListener('input', showAvailableChalets);
    departureDate.addEventListener('input', showAvailableChalets);

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
        showAvailableChalets()

    });

    arrivalDate.addEventListener('change', obtenerTotalReserva);

    // Agregar un listener para el evento change a departureDate
    departureDate.addEventListener('change', obtenerTotalReserva);

    const descuentoReservaInput = document.querySelector('#habitacion_descuento')
    const subtotalInput = document.getElementById('habitacion_total');
    const totalFinal = document.getElementById('habitacion_totalcondescuento');

    function actualizarTotalConDescuento() {
        const descuento = parseFloat(descuentoReservaInput.value);
        const subtotal = parseFloat(subtotalInput.value);

        if (!isNaN(descuento) && descuento >= 0 && descuento <= 100 && !isNaN(subtotal)) {
            const descuentoCalculado = subtotal * (descuento / 100);
            totalFinal.value = (subtotal - descuentoCalculado).toFixed(2);
        } else {
            totalFinal.value = subtotal.toFixed(2);
        }
    }

    descuentoReservaInput.addEventListener('input', actualizarTotalConDescuento);
    subtotalInput.addEventListener('input', actualizarTotalConDescuento);





    async function obtenerTotalReserva() {
        const fechaInicio = new Date(`${arrivalDate.value}T00:00:00`); // Agregar la hora en formato UTC
        const fechaFin = new Date(`${departureDate.value}T00:00:00`); // Agregar la hora en formato UTC


        if (arrivalDate.value && departureDate.value && tipologiaSelect.value) {

            const calculandoPreciosElement = document.getElementById('calculando-precios');
            calculandoPreciosElement.style.display = 'block';
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

                    const response = await fetch(`/api/consulta-fechas?fecha=${formatedDate}&habitacionid=${habitacionId}`);

                    // Verificar el estado de la respuesta
                    if (!response.ok) {
                        throw new Error('Error en la solicitud fetch: ' + response.statusText);
                    }

                    // Convertir la respuesta a JSON
                    const data = await response.json();

                    // Agregar el resultado al array de resultados
                    resultados.push(data);

                }
                console.log(resultados)
                let totalPrecios = 0
                let totalCostoBase = 0

                resultados.forEach(resultado => {



                    if (nNights > 1) {
                        if (resultado.precio_base_2noches) {
                            totalPrecios += resultado.precio_base_2noches
                            totalCostoBase += resultado.costo_base_2noches
                        } else {
                            console.log('no hay precios disponibles')
                        }
                    } else {
                        if (resultado.precio_modificado) {
                            totalPrecios += resultado.precio_modificado
                            totalCostoBase += resultado.costo_base

                        } else {
                            console.log('No hay precios disponibles')
                        }
                    }
                })

                console.log("Total precio sin comisiones: ", totalPrecios)
                comisionesReserva = totalPrecios; // comisionesReserva = 3000
                console.log("Total costo base: ", totalCostoBase)

                totalSinComisiones.value = totalPrecios;

                // Asignar comisiones
                const comisionUsuarios = await obtenerComisiones()
                precioMinimoPermitido = comisionUsuarios.minComission + totalPrecios // Sumar comisiones al precio minimo
                totalPrecios += comisionUsuarios.finalComission // Precio maximo permitido
                console.log("Total máximo permitido con comisiones: ", totalPrecios)

                const totalInput = document.getElementById('habitacion_total') // Subtotal 
                totalInput.value = precioMinimoPermitido // Mostrar el minimo permitido

                preciosTotalesGlobal = totalPrecios // Monto maximo en variable global

                totalCostoBaseInput.value = totalCostoBase

                console.log('Total maximo permitido: ', preciosTotalesGlobal)



            } catch (error) {
                console.error('Ha ocurrido un error: ', error.message);

            } finally {
                // Ocultar la leyenda de "Calculando precios..."
                calculandoPreciosElement.style.display = 'none';
            }

        }
    }

    async function obtenerComisiones() {
        try {
            const response = await fetch('/api/utilidades');
            const data = await response.json();
            const minComission = data.minComission
            const finalComission = data.finalComission
            const comisiones = { minComission: minComission, finalComission: finalComission }
            return comisiones

        } catch (error) {
            console.log(error.message);
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

    // Alta de usuarios
    var btnSaveClient = document.getElementById("btnSaveClient");
    if (btnSaveClient) {
        btnSaveClient.addEventListener("click", async (event) => {
            event.preventDefault();

            const data = {
                firstName: document.getElementById("txtClientName").value,
                lastName: document.getElementById("txtClientLastname").value,
                phone: document.getElementById("txtClientPhone").value,
                address: document.getElementById("txtClientAddress").value,
                email: document.getElementById("txtClientEmail").value,
                identificationType: document.getElementById("slctClientIdType").value,
                identificationNumber: document.getElementById("txtClientIdNumber").value
            };

            try {
                const response = await fetch('/api/clientes/crear-cliente', {
                    method: 'POST',
                    headers: {
                        // Once logged in, the authorization token stored inthe session cookies will automatically be added in each HTTP request.
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                })

                if (!response.ok) {
                    throw new Error('Error en la solicitud');
                }

                const dataR = await response.json();
                console.log(dataR);

                Swal.fire({
                    icon: 'success',
                    title: '¡Completado!',
                    text: dataR.message + '.',
                    confirmButtonText: 'Regresar'
                }).then((result) => {
                    if (result.isConfirmed) {
                        $('#clientEntryModal').modal('hide');
                        $('#event_entry_modal').modal('show');
                        // Update the clients dropdown
                        const newOption = document.createElement("option");
                        newOption.value = dataR.client.email;
                        newOption.text = dataR.client.firstName + " " + dataR.client.lastName + "(" + dataR.client.email + ")";
                        newOption.selected = true;

                        document.getElementById("lblClient").appendChild(newOption);

                    }
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al enviar la solicitud: ' + error,
                    confirmButtonText: 'Aceptar'
                });
            }
        });
    }


});