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
        
        // Reset progress steps
        resetProgressSteps();
        // Reset disponibilidad badge
        const disponibilidadStatus = document.getElementById('disponibilidad-status');
        if (disponibilidadStatus) {
            disponibilidadStatus.style.display = 'none';
        }
        // Ocultar sección de habitación
        const sectionHabitacion = document.getElementById('section-habitacion');
        if (sectionHabitacion) {
            sectionHabitacion.style.display = 'none';
        }
        // Reset flag de validación
        disponibilidadValidada = false;
        
        // Resetear opciones de habitación (ocultar todas)
        const tipologiaHabitacionInput = document.querySelector('#tipologia_habitacion');
        if (tipologiaHabitacionInput) {
            const options = tipologiaHabitacionInput.querySelectorAll('option');
            options.forEach((option, index) => {
                if (index === 0) {
                    option.textContent = 'Primero busca disponibilidad';
                } else {
                    option.style.display = 'none';
                    option.style.backgroundColor = '';
                }
            });
        }
    }

    // Progress Steps Management
    function updateProgressStep(stepNumber) {
        const steps = document.querySelectorAll('.reservation-steps .step');
        steps.forEach((step, index) => {
            const stepNum = index + 1;
            step.classList.remove('active', 'completed');
            if (stepNum < stepNumber) {
                step.classList.add('completed');
            } else if (stepNum === stepNumber) {
                step.classList.add('active');
            }
        });
    }

    function resetProgressSteps() {
        const steps = document.querySelectorAll('.reservation-steps .step');
        steps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index === 0) step.classList.add('active');
        });
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
    let disponibilidadValidada = false; // Flag para evitar doble validación

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
        const tipologiaFilterSelect = document.querySelector('#tipologia_select');
        const options = tipologiaHabitacionInput.querySelectorAll('option');
        const selectedTipologia = tipologiaFilterSelect.value;
        const sectionHabitacion = document.getElementById('section-habitacion');
        const btnValidar = document.getElementById('btn-validar-disponibilidad');

        const verificarDisponibilidadElement = document.getElementById('verificar-disponibilidad');
        const disponibilidadStatus = document.getElementById('disponibilidad-status');
        const disponibilidadText = document.getElementById('disponibilidad-text');

        // Validar que se hayan seleccionado fechas
        if (isNaN(arrivalValue) || isNaN(departureValue) || !arrivalDate.value || !departureDate.value) {
            Swal.fire({
                icon: 'warning',
                title: 'Fechas requeridas',
                text: 'Por favor selecciona las fechas de check-in y check-out primero.',
                confirmButtonText: 'Entendido'
            });
            return;
        }

        if (departureValue <= arrivalValue) {
            Swal.fire({
                icon: 'warning',
                title: 'Fechas inválidas',
                text: 'La fecha de check-out debe ser posterior a la fecha de check-in.',
                confirmButtonText: 'Entendido'
            });
            return;
        }

        try {
            // Resetear opciones - ocultar todas primero
            options.forEach(option => {
                if (option.value !== '') {
                    option.style.display = 'none';
                    option.disabled = true;
                    option.removeAttribute('data-available');
                }
            });

            if (btnValidar) btnValidar.disabled = true;
            tipologiaFilterSelect.disabled = true;
            verificarDisponibilidadElement.style.display = 'flex';
            if (disponibilidadStatus) disponibilidadStatus.style.display = 'none';

            const arrivalYear = arrivalValue.getFullYear();
            const arrivalMonth = (arrivalValue.getMonth() + 1).toString().padStart(2, '0');
            const arrivalDay = arrivalValue.getDate().toString().padStart(2, '0');
            const arrivalDateStr = `${arrivalYear}-${arrivalMonth}-${arrivalDay}`;

            const departureYear = departureValue.getFullYear();
            const departureMonth = (departureValue.getMonth() + 1).toString().padStart(2, '0');
            const departureDay = departureValue.getDate().toString().padStart(2, '0');
            const departureDateStr = `${departureYear}-${departureMonth}-${departureDay}`;

            // Construir query params
            let queryParams = `fechaLlegada=${arrivalDateStr}&fechaSalida=${departureDateStr}`;
            if (selectedTipologia && selectedTipologia !== 'all') {
                queryParams += `&tipo=${encodeURIComponent(selectedTipologia)}`;
            }

            // Llamar al endpoint simplificado
            const response = await fetch(`/api/eventos/disponibilidad?${queryParams}`);
            
            if (!response.ok) {
                throw new Error('Error al consultar disponibilidad');
            }

            const data = await response.json();
            console.log('Habitaciones disponibles:', data);

            const availableRooms = data.availableRooms || [];
            
            // Limpiar select y agregar solo las disponibles
            // Mantener la primera opción vacía
            const firstOption = tipologiaHabitacionInput.querySelector('option[value=""]');
            tipologiaHabitacionInput.innerHTML = '';
            if (firstOption) {
                tipologiaHabitacionInput.appendChild(firstOption);
            }

            availableRooms.forEach(room => {
                // Crear nueva opción
                const option = document.createElement('option');
                option.value = room.displayName; // Nombre que se muestra (puede ser nombre de grupo)
                option.setAttribute('data-bs-id', room.id); // ID específico de la habitación
                option.setAttribute('data-bs-pax', room.maxPax);
                option.setAttribute('data-available', 'true');
                
                // Configurar texto del option
                if (room.isGrouped && room.availableCount) {
                    option.textContent = `${room.displayName} (${room.availableCount} disponibles)`;
                } else {
                    option.textContent = room.displayName;
                }
                
                option.style.backgroundColor = '#d4edda';
                option.style.display = '';
                option.disabled = false;
                
                tipologiaHabitacionInput.appendChild(option);
            });

            // Mostrar badge de disponibilidad
            if (disponibilidadStatus && disponibilidadText) {
                disponibilidadStatus.style.display = 'flex';
                if (availableRooms.length > 0) {
                    disponibilidadStatus.className = 'disponibilidad-badge disponible';
                    disponibilidadText.innerHTML = `<i class="fa fa-check-circle"></i> ${availableRooms.length} habitación(es) disponible(s)`;
                    
                    // Mostrar sección de habitación
                    if (sectionHabitacion) {
                        sectionHabitacion.style.display = 'block';
                    }
                } else {
                    disponibilidadStatus.className = 'disponibilidad-badge no-disponible';
                    disponibilidadText.innerHTML = '<i class="fa fa-times-circle"></i> No hay habitaciones disponibles para estas fechas';
                    
                    // Ocultar sección de habitación
                    if (sectionHabitacion) {
                        sectionHabitacion.style.display = 'none';
                    }
                }
            }

            // Marcar como validado
            disponibilidadValidada = true;
            
            // Actualizar paso visual (paso 3 = habitación)
            updateProgressStep(3);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: "Error en la solicitud: " + error.message,
                confirmButtonText: 'Aceptar'
            });
        } finally {
            verificarDisponibilidadElement.style.display = 'none';
            tipologiaFilterSelect.disabled = false;
            if (btnValidar) btnValidar.disabled = false;
        }
    }

    // Creating new reservation.
    document.getElementById('save-event-btn').addEventListener('click', async function () {
        // Mostrar el spinner y deshabilitar el botón
        const spinner = document.querySelector('.loader');
        spinner.classList.remove('loader--hidden');


        try {

            // Esperar a que obtenerComisiones() se resuelva            
            comisionesReserva = document.getElementById('habitacion_total').value.trim() - precioMinimoPermitido; // 3250 - 3000
            console.log(comisionesReserva)
            const tipoReserva = document.getElementById('tipo-reserva-select').value.trim();
            if (tipoReserva !== "reserva" && tipoReserva !== "por-depo") {
                throw new Error("El tipo de reserva debe ser 'reserva' o 'por-depo'");
            }
            const isDeposit = tipoReserva === 'por-depo' ? true : false;

            console.log("Por depo?: ", isDeposit)
            console.log("Email cliente: ", document.getElementById("lblClientValue").value.trim())

            if (!isDeposit){
                if (document.getElementById("lblClientValue").value.trim() === "" || document.getElementById("lblClientValue").value.trim() === null || document.getElementById("lblClientValue").value.trim() === undefined) {
                    throw new Error("Por favor selecciona un cliente de la lista.");
                }

            }


            let formData = {};

            // Obtener el ID de la habitación (ya fue validado y seleccionado)
            const habitacionId = document.getElementById('id_cabana').value;
            
            if (!habitacionId) {
                throw new Error('No se ha seleccionado una habitación válida');
            }

            if (isDeposit){
                const codigoPais = document.getElementById('codigo-pais-select').value;
                const numeroTelefono = document.getElementById('telefono-cliente-provisional').value.trim();
                const telefonoCompleto = numeroTelefono ? codigoPais + numeroTelefono : '';
                
                formData = {
                    clientFirstName: document.getElementById('nombre-cliente-provisional').value.trim(),
                    clientLastName: document.getElementById('apellido-cliente-provisional').value.trim(),
                    arrivalDate: document.getElementById('event_start_date').value.trim(),
                    departureDate: document.getElementById('event_end_date').value.trim(),
                    nNights: document.getElementById("event_nights").value.trim(),
                    habitacionId: habitacionId,
                    maxOccupation: document.getElementById('ocupacion_habitacion').value.trim(),
                    pax: document.getElementById('numero-personas').value.trim(),
                    total: document.getElementById('habitacion_total').value.trim(),
                    isDeposit: isDeposit,
                    comisionVendedor: comisionesReserva
                };
                
                // Only add clientPhone if provided
                if (telefonoCompleto) {
                    formData.clientPhone = telefonoCompleto;
                }
            } else {
                formData = {
                    clientEmail: document.getElementById("lblClientValue").value.trim(),
                    arrivalDate: document.getElementById('event_start_date').value.trim(),
                    departureDate: document.getElementById('event_end_date').value.trim(),
                    nNights: document.getElementById("event_nights").value.trim(),
                    habitacionId: habitacionId,
                    maxOccupation: document.getElementById('ocupacion_habitacion').value.trim(),
                    pax: document.getElementById('numero-personas').value.trim(),
                    total: document.getElementById('habitacion_total').value.trim(),
                    isDeposit: isDeposit,
                    comisionVendedor: comisionesReserva
                };
            }

            // Crear un objeto con los datos del formulario


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
                console.log(errorData)
                let errors = []

                if (errorData.message){
                    errors.push(errorData.message);
                } else {
                    errors = errorData.error.map(err => err.message);
                }
                
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: "Error en la solicitud: " + errors.join(' ') + ".",
                    confirmButtonText: 'Aceptar'
                });
                throw new Error(errors);
            }

            const data = await response.json();
            console.log('Respuesta exitosa del servidor:', data);

            const reservationId = data.reservationId;
            // Usar el nombre de la habitación asignada
            const chaletNameParaComisiones = data.assignedChaletName || 'Habitación';

            const comisionBody = {
                precioMinimo: precioMinimoPermitido,
                precioMaximo: preciosTotalesGlobal,
                costoBase: totalCostoBaseInput.value,
                totalSinComisiones: totalSinComisiones.value,
                precioAsignado: formData.total,
                chaletName: chaletNameParaComisiones,
                habitacionId: formData.habitacionId,
                idReserva: reservationId,
                arrivalDate: formData.arrivalDate,
                departureDate: formData.departureDate,
                nNights: formData.nNights
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
            // Ocultar el spinner 
            spinner.classList.add('loader--hidden');

        }
    });

    const nightsInput = document.querySelector('#event_nights');
    const arrivalDate = document.getElementById('event_start_date')
    const departureDate = document.getElementById('event_end_date')
    const selectedPax = document.getElementById('numero-personas')


    // const datePicker = $('#date_range')
    // arrivalDate.addEventListener('input', calculateNightDifference);
    // departureDate.addEventListener('input', calculateNightDifference);
    // arrivalDate.addEventListener('input', showAvailableChalets);
    // departureDate.addEventListener('input', showAvailableChalets);

    const tipologiaSelect = document.getElementById('tipologia_habitacion');
    const ocupacionInput = document.getElementById('ocupacion_habitacion');
    const idHabitacionInput = document.getElementById('id_cabana');

    tipologiaSelect.addEventListener('change', function () {
        const selectedOption = tipologiaSelect.options[tipologiaSelect.selectedIndex];
        const pax = selectedOption.getAttribute('data-bs-pax');
        const idHabitacion = selectedOption.getAttribute('data-bs-id');

        console.log('PAX:', pax);
        console.log('ID Habitación:', idHabitacion);

        if (pax != undefined && pax != null && pax.trim() !== '') {
            ocupacionInput.value = pax;
        } else {
            ocupacionInput.value = 0
        }

        // Guardar el ID de la habitación específica
        idHabitacionInput.value = idHabitacion;
        
        console.log('ID guardado:', idHabitacionInput.value);

        const numeroPersonasSelect = document.getElementById('numero-personas');
        const maxOccupancy = selectedOption.getAttribute('data-bs-pax');
        numeroPersonasSelect.innerHTML = '<option value="" selected disabled>Personas</option>';
        for (let i = 2; i <= maxOccupancy; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            numeroPersonasSelect.appendChild(option);
        }

        // Actualizar paso visual
        updateProgressStep(3);

        // Calcular precios con el ID específico
        obtenerTotalReserva();
    });

    // arrivalDate.addEventListener('change', obtenerTotalReserva);

    // Agregar un listener para el evento change a departureDate
    // departureDate.addEventListener('change', obtenerTotalReserva);

    selectedPax.addEventListener('change', function() {
        obtenerTotalReserva();
        // Actualizar paso a "Confirmar" cuando se selecciona pax
        updateProgressStep(4);
    });








    async function obtenerTotalReserva() {
        const fechaInicio = new Date(`${arrivalDate.value}T00:00:00`); // Agregar la hora en formato UTC
        const fechaFin = new Date(`${departureDate.value}T00:00:00`); // Agregar la hora en formato UTC

        console.log('pax: ', selectedPax.value);
        if (arrivalDate.value && departureDate.value && tipologiaSelect.value && selectedPax.value !== "") {

            const calculandoPreciosElement = document.getElementById('calculando-precios');
            calculandoPreciosElement.style.display = 'block';
            // Aquí puedes ejecutar la acción deseada
            console.log("Los 4 elementos tienen un valor. Ejecutar acción...");
            const fechas = obtenerRangoFechas(fechaInicio, fechaFin)
            const nNights = document.getElementById("event_nights").value.trim();
            let habitacionId = idHabitacionInput.value;
            const isGroup = idHabitacionInput.getAttribute('data-is-group') === 'true';

            const resultados = []

            try {
                // Si es un grupo, obtener el ID de la habitación representativa
                if (isGroup) {
                    const groupName = habitacionId.replace('group:', '');
                    const groupResponse = await fetch(`/api/grupos-habitaciones/${encodeURIComponent(groupName)}/details`);
                    if (!groupResponse.ok) {
                        throw new Error('Error al obtener información del grupo');
                    }
                    const groupData = await groupResponse.json();
                    // Usar la primera habitación del grupo para consultar precios
                    if (groupData.rooms && groupData.rooms.length > 0) {
                        habitacionId = groupData.rooms[0]._id;
                        console.log('Usando habitación representativa del grupo:', habitacionId);
                    } else {
                        throw new Error('El grupo no tiene habitaciones');
                    }
                }

                for (const fecha of fechas) {
                    const year = fecha.getFullYear();
                    const month = (fecha.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos dígitos
                    const day = fecha.getDate().toString().padStart(2, '0'); // Asegura que el día tenga dos dígitos
                    const formatedDate = `${year}-${month}-${day}`;

                    console.log("estoy consultando precios")
                    const maxOccupation = document.getElementById('ocupacion_habitacion').value.trim()
                    const selectedPax = document.getElementById('numero-personas').value.trim()

                    const needSpecialPrice = (selectedPax === maxOccupation) ? false : true;

                    const response = await fetch(`/api/consulta-fechas?fecha=${formatedDate}&habitacionid=${habitacionId}&needSpecialPrice=${needSpecialPrice}&pax=${selectedPax}`);

                    // Verificar el estado de la respuesta
                    if (!response.ok) {
                        const data = await response.json();
                        console.log(data)
                        throw new Error('Error en la solicitud: ' + data.mensaje);
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
                const comisionUsuarios = await obtenerComisiones(nNights, habitacionId)
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
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: `${error.message || 'Ha ocurrido un error al calcular los precios.'}`,
                    showCancelButton: false,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                })

            } finally {
                // Ocultar la leyenda de "Calculando precios..."
                calculandoPreciosElement.style.display = 'none';
            }

        }
    }

    async function obtenerComisiones(nNights, habitacionId) {
        try {
            const response = await fetch(`/api/utilidades?nnights=${nNights}&habitacionid=${habitacionId}`);
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
                    const errorData = await response.json(); // Extract the error data
                    const errorMessage = errorData.error && errorData.error[0] && errorData.error[0].message
                        ? errorData.error[0].message
                        : 'Error en la solicitud'; // Fallback if message is not found
                    throw new Error(errorMessage);
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
                        // const newOption = document.createElement("option");
                        // newOption.value = dataR.client.email;
                        // newOption.text = dataR.client.firstName + " " + dataR.client.lastName + "(" + dataR.client.email + ")";
                        // newOption.selected = true;

                        // document.getElementById("lblClient").appendChild(newOption);

                        window.addNewClientOption({
                            email: dataR.client.email,
                            firstName: dataR.client.firstName,
                            lastName: dataR.client.lastName
                        });

                    }
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al enviar la solicitud: ' + error.message,
                    confirmButtonText: 'Aceptar'
                });
            }
        });
    }

    flatpickr("#date_range", {
        mode: "range",
        dateFormat: "d-m-Y",
        locale: {
            rangeSeparator: " → "
        },
        //minDate: "today",        
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                // Guardar las fechas en los campos ocultos
                document.getElementById('event_start_date').value = selectedDates[0].toISOString().split('T')[0];
                document.getElementById('event_end_date').value = selectedDates[1].toISOString().split('T')[0];

                console.log("Initial date: ", $('#event_start_date').val());
                console.log("Final date: ", $('#event_end_date').val());

                // Resetear flag de validación cuando cambian las fechas
                disponibilidadValidada = false;

                // Ocultar sección de habitación hasta nueva validación
                const sectionHabitacion = document.getElementById('section-habitacion');
                const disponibilidadStatus = document.getElementById('disponibilidad-status');
                if (sectionHabitacion) {
                    sectionHabitacion.style.display = 'none';
                }
                if (disponibilidadStatus) {
                    disponibilidadStatus.style.display = 'none';
                }

                calculateNightDifference();
            }
        },
        
    });

    const tipoReservaSelect = document.querySelector('#tipo-reserva-select');
    tipoReservaSelect.addEventListener('change', function() {
        console.log("Ejecutando...")
        
        const containerAltaCliente = document.querySelectorAll('.container-alta-cliente');
        const containerAltaClienteProvisional = document.querySelector('#container-alta-cliente-provisional')

        const selectedOption = tipoReservaSelect.options[tipoReservaSelect.selectedIndex];
        console.log(selectedOption)

        if (selectedOption.value === "reserva"){
            containerAltaCliente.forEach(element => {
                element.classList.remove('d-none')
            });
            containerAltaClienteProvisional.classList.add('d-none')
        } else {
            containerAltaCliente.forEach(element => {
                element.classList.add('d-none')
            });
            containerAltaClienteProvisional.classList.remove('d-none')
        }
    });

    const searchInput = document.getElementById('lblClient');
    const optionsContainer = document.querySelector('.select-options');
    const hiddenInput = document.getElementById('lblClientValue');
    let allOptions = Array.from(document.querySelectorAll('.select-option'));

    window.addNewClientOption = function(clientData) {
        // Create new option element
        const newOption = document.createElement('div');
        newOption.className = 'select-option';
        newOption.dataset.value = clientData.email;
        newOption.dataset.label = `${clientData.firstName} ${clientData.lastName} (${clientData.email})`;
        newOption.textContent = `${clientData.firstName} ${clientData.lastName} (${clientData.email})`;

        // Add the new option to the container
        optionsContainer.appendChild(newOption);

        // Update allOptions array
        allOptions = Array.from(document.querySelectorAll('.select-option'));

        // Set the new option as selected
        searchInput.value = newOption.dataset.label;
        hiddenInput.value = newOption.dataset.value;
    };

    // Function to filter options
    function filterOptions(searchText) {
        const filteredOptions = allOptions.filter(option => {
            const optionText = option.textContent.toLowerCase();
            return optionText.includes(searchText.toLowerCase());
        });

        // Hide all options first
        allOptions.forEach(option => option.style.display = 'none');

        // Show filtered options
        filteredOptions.forEach(option => option.style.display = 'block');

        // Show/hide options container based on whether there are results
        optionsContainer.style.display = filteredOptions.length > 0 ? 'block' : 'none';
    }

    // Input event handler
    searchInput.addEventListener('input', (e) => {
        filterOptions(e.target.value);
    });

    // Focus event handler
    searchInput.addEventListener('focus', () => {
        optionsContainer.style.display = 'block';
        filterOptions(searchInput.value);
    });

    // Click handler for options
    optionsContainer.addEventListener('click', (e) => {
        const option = e.target.closest('.select-option');
        if (option) {
            const value = option.dataset.value;
            const label = option.dataset.label || option.textContent;
            
            searchInput.value = label;
            hiddenInput.value = value;
            optionsContainer.style.display = 'none';
        }
    });

    // Close options when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.select-container')) {
            optionsContainer.style.display = 'none';
        }
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const visibleOptions = Array.from(optionsContainer.querySelectorAll('.select-option')).filter(
            option => option.style.display !== 'none'
        );
        const currentIndex = visibleOptions.findIndex(option => option.classList.contains('selected'));

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < visibleOptions.length - 1) {
                    visibleOptions.forEach(opt => opt.classList.remove('selected'));
                    visibleOptions[currentIndex + 1].classList.add('selected');
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    visibleOptions.forEach(opt => opt.classList.remove('selected'));
                    visibleOptions[currentIndex - 1].classList.add('selected');
                }
                break;
            case 'Enter':
                e.preventDefault();
                const selectedOption = visibleOptions.find(opt => opt.classList.contains('selected'));
                if (selectedOption) {
                    const value = selectedOption.dataset.value;
                    const label = selectedOption.dataset.label || selectedOption.textContent;
                    searchInput.value = label;
                    hiddenInput.value = value;
                    optionsContainer.style.display = 'none';
                }
                break;
        }
    });

    // Botón para validar disponibilidad
    const btnValidarDisponibilidad = document.getElementById('btn-validar-disponibilidad');
    if (btnValidarDisponibilidad) {
        btnValidarDisponibilidad.addEventListener('click', function() {
            showAvailableChalets();
        });
    }

    // Listener para filtro de tipología - solo oculta la sección de habitación hasta nueva búsqueda
    const tipologiaFilterSelectElement = document.getElementById('tipologia_select');
    tipologiaFilterSelectElement.addEventListener('change', function() {
        // Ocultar sección de habitación hasta que se vuelva a validar
        const sectionHabitacion = document.getElementById('section-habitacion');
        const disponibilidadStatus = document.getElementById('disponibilidad-status');
        if (sectionHabitacion) {
            sectionHabitacion.style.display = 'none';
        }
        if (disponibilidadStatus) {
            disponibilidadStatus.style.display = 'none';
        }
        disponibilidadValidada = false;
    });

});