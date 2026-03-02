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
        // Ocultar secci├│n de habitaci├│n
        const sectionHabitacion = document.getElementById('section-habitacion');
        if (sectionHabitacion) {
            sectionHabitacion.style.display = 'none';
        }
        // Reset flag de validaci├│n
        disponibilidadValidada = false;
        
        // Resetear opciones de habitaci├│n (ocultar todas)
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
    let disponibilidadValidada = false; // Flag para evitar doble validaci├│n
    let costoBaseAjustadoGlobal = null; // Para guardar el costo base ajustado cuando hay cup├│n

    const totalCostoBaseInput = document.querySelector("#total-costo-base")
    let totalSinComisiones = document.querySelector("#total-sin-comisiones")

    if (totalSinComisiones.value === undefined || totalSinComisiones.value === null || !totalSinComisiones.value) {
        totalSinComisiones.value = 0
    }

    function calculateNightDifference() {
        console.log('Desde calcular noches')
        const arrivalValue = new Date(arrivalDate.value);
        const departureValue = new Date(departureDate.value);

        // Verifica si las fechas son v├ílidas
        if (!isNaN(arrivalValue) && !isNaN(departureValue) && departureValue >= arrivalValue) {
            const timeDifference = departureValue.getTime() - arrivalValue.getTime();
            const nightDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)); // Calcula la diferencia en d├¡as

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
                title: 'Fechas inv├ílidas',
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
            // Mantener la primera opci├│n vac├¡a
            const firstOption = tipologiaHabitacionInput.querySelector('option[value=""]');
            tipologiaHabitacionInput.innerHTML = '';
            if (firstOption) {
                tipologiaHabitacionInput.appendChild(firstOption);
            }

            availableRooms.forEach(room => {
                // Crear nueva opci├│n
                const option = document.createElement('option');
                option.value = room.displayName; // Nombre que se muestra (puede ser nombre de grupo)
                option.setAttribute('data-bs-id', room.id); // ID espec├¡fico de la habitaci├│n
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
                    disponibilidadText.innerHTML = `<i class="fa fa-check-circle"></i> ${availableRooms.length} habitaci├│n(es) disponible(s)`;
                    
                    // Mostrar secci├│n de habitaci├│n
                    if (sectionHabitacion) {
                        sectionHabitacion.style.display = 'block';
                    }
                } else {
                    disponibilidadStatus.className = 'disponibilidad-badge no-disponible';
                    disponibilidadText.innerHTML = '<i class="fa fa-times-circle"></i> No hay habitaciones disponibles para estas fechas';
                    
                    // Ocultar secci├│n de habitaci├│n
                    if (sectionHabitacion) {
                        sectionHabitacion.style.display = 'none';
                    }
                }
            }

            // Marcar como validado
            disponibilidadValidada = true;
            
            // Actualizar paso visual (paso 3 = habitaci├│n)
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
        // Mostrar el spinner y deshabilitar el bot├│n
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

            // Obtener el ID de la habitaci├│n (ya fue validado y seleccionado)
            const habitacionId = document.getElementById('id_cabana').value;
            
            if (!habitacionId) {
                throw new Error('No se ha seleccionado una habitaci├│n v├ílida');
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
            // Usar el nombre de la habitaci├│n asignada
            const chaletNameParaComisiones = data.assignedChaletName || 'Habitaci├│n';

            console.log("\n========== PREPARANDO BODY DE COMISIONES ==========");
            const comisionBody = {
                precioMinimo: precioMinimoPermitido,
                precioMaximo: preciosTotalesGlobal,
                // SIEMPRE enviar el costo base ORIGINAL - el backend calcular├í el ajuste si hay cup├│n
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
            
            console.log("Datos base para comisiones:");
            console.log("  - Precio M├¡nimo:", comisionBody.precioMinimo);
            console.log("  - Precio M├íximo:", comisionBody.precioMaximo);
            console.log("  - Costo Base (ORIGINAL):", comisionBody.costoBase);
            console.log("  - Total Sin Comisiones:", comisionBody.totalSinComisiones);
            console.log("  - Precio Asignado:", comisionBody.precioAsignado);
            console.log("  - Noches:", comisionBody.nNights);

            // Agregar datos del cup├│n si existe
            if (cuponAplicado) {
                comisionBody.cupon = {
                    cuponId: cuponAplicado.cuponId,
                    codigo: cuponAplicado.codigo,
                    tipo: cuponAplicado.tipo,
                    valor: cuponAplicado.valor,
                    descuentoTotal: cuponAplicado.descuentoTotal,
                    aplicableA: cuponAplicado.aplicableA,
                    clienteId: formData.clientEmail ? null : undefined, // Se puede agregar si es necesario
                    clienteWebId: undefined // Se puede agregar si es necesario
                };
                console.log('Cup├│n incluido en comisionBody:', comisionBody.cupon);
            } else {
                console.log('Sin cup├│n aplicado');
            }
            console.log("===================================================\n");

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
                    // Resetear variables globales del cup├│n
                    cuponAplicado = null;
                    costoBaseAjustadoGlobal = null;
                    precioOriginalSinCupon.valor = 0;
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
        console.log('ID Habitaci├│n:', idHabitacion);

        if (pax != undefined && pax != null && pax.trim() !== '') {
            ocupacionInput.value = pax;
        } else {
            ocupacionInput.value = 0
        }

        // Guardar el ID de la habitaci├│n espec├¡fica
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

        // Calcular precios con el ID espec├¡fico
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
            // Aqu├¡ puedes ejecutar la acci├│n deseada
            console.log("Los 4 elementos tienen un valor. Ejecutar acci├│n...");
            const fechas = obtenerRangoFechas(fechaInicio, fechaFin)
            const nNights = document.getElementById("event_nights").value.trim();
            let habitacionId = idHabitacionInput.value;
            const isGroup = idHabitacionInput.getAttribute('data-is-group') === 'true';

            const resultados = []

            try {
                // Si es un grupo, obtener el ID de la habitaci├│n representativa
                if (isGroup) {
                    const groupName = habitacionId.replace('group:', '');
                    const groupResponse = await fetch(`/api/grupos-habitaciones/${encodeURIComponent(groupName)}/details`);
                    if (!groupResponse.ok) {
                        throw new Error('Error al obtener informaci├│n del grupo');
                    }
                    const groupData = await groupResponse.json();
                    // Usar la primera habitaci├│n del grupo para consultar precios
                    if (groupData.rooms && groupData.rooms.length > 0) {
                        habitacionId = groupData.rooms[0]._id;
                        console.log('Usando habitaci├│n representativa del grupo:', habitacionId);
                    } else {
                        throw new Error('El grupo no tiene habitaciones');
                    }
                }

                for (const fecha of fechas) {
                    const year = fecha.getFullYear();
                    const month = (fecha.getMonth() + 1).toString().padStart(2, '0'); // Asegura que el mes tenga dos d├¡gitos
                    const day = fecha.getDate().toString().padStart(2, '0'); // Asegura que el d├¡a tenga dos d├¡gitos
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
                console.log("\n========== OBTENIENDO COMISIONES (FRONTEND) ==========");
                console.log("Noches:", nNights);
                console.log("Habitaci├│n ID:", habitacionId);
                console.log("Total sin comisiones:", totalPrecios);
                console.log("Costo base:", totalCostoBase);
                const comisionUsuarios = await obtenerComisiones(nNights, habitacionId, null, totalPrecios, totalCostoBase)
                console.log("Comisiones recibidas del servidor:");
                console.log("  - minComission:", comisionUsuarios.minComission);
                console.log("  - finalComission:", comisionUsuarios.finalComission);
                
                precioMinimoPermitido = comisionUsuarios.minComission + totalPrecios // Sumar comisiones al precio minimo
                totalPrecios += comisionUsuarios.finalComission // Precio maximo permitido
                
                console.log("C├ílculos finales:");
                console.log("  - Precio M├¡nimo Permitido:", precioMinimoPermitido, `(${comisionUsuarios.minComission} + ${totalPrecios - comisionUsuarios.finalComission})`);
                console.log("  - Total M├íximo Permitido:", totalPrecios);
                console.log("======================================================\n");

                const totalInput = document.getElementById('habitacion_total') // Subtotal 
                totalInput.value = precioMinimoPermitido // Mostrar el minimo permitido

                preciosTotalesGlobal = totalPrecios // Monto maximo en variable global

                totalCostoBaseInput.value = totalCostoBase

                console.log('Total maximo permitido: ', preciosTotalesGlobal)

                // Mostrar secci├│n de cup├│n despu├®s de calcular el precio
                mostrarSeccionCupon();
                // Guardar precio sin cup├│n para referencia
                precioOriginalSinCupon.valor = precioMinimoPermitido;

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

    async function obtenerComisiones(nNights, habitacionId, cuponData = null, totalSinComisiones = 0, costoBase = 0) {
        try {
            let url = `/api/utilidades?nnights=${nNights}&habitacionid=${habitacionId}`;
            
            // Si hay cup├│n, agregar par├ímetros adicionales
            if (cuponData) {
                const cuponParam = encodeURIComponent(JSON.stringify(cuponData));
                url += `&cupon=${cuponParam}&totalsincomisiones=${totalSinComisiones}&costobase=${costoBase}`;
                console.log("Llamando a calcularComisiones CON cup├│n:", { nNights, habitacionId, cuponData, totalSinComisiones, costoBase });
                console.log("URL completa:", url);
            } else {
                console.log("Llamando a calcularComisiones SIN cup├│n:", { nNights, habitacionId });
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            // El backend ahora devuelve m├ís informaci├│n cuando hay cup├│n
            const resultado = {
                minComission: data.minComission,
                finalComission: data.finalComission,
                costoBaseAjustado: data.costoBaseAjustado,
                utilidadAjustada: data.utilidadAjustada,
                precioBaseAjustado: data.precioBaseAjustado,
                precioTotalFinal: data.precioTotalFinal
            };
            
            console.log("Respuesta completa del servidor:", resultado);
            return resultado;

        } catch (error) {
            console.log("Error al obtener comisiones:", error.message);
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
                    title: '┬íCompletado!',
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
            rangeSeparator: " ÔåÆ "
        },
        //minDate: "today",        
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                // Guardar las fechas en los campos ocultos
                document.getElementById('event_start_date').value = selectedDates[0].toISOString().split('T')[0];
                document.getElementById('event_end_date').value = selectedDates[1].toISOString().split('T')[0];

                console.log("Initial date: ", $('#event_start_date').val());
                console.log("Final date: ", $('#event_end_date').val());

                // Resetear flag de validaci├│n cuando cambian las fechas
                disponibilidadValidada = false;

                // Ocultar secci├│n de habitaci├│n hasta nueva validaci├│n
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

    // Bot├│n para validar disponibilidad
    const btnValidarDisponibilidad = document.getElementById('btn-validar-disponibilidad');
    if (btnValidarDisponibilidad) {
        btnValidarDisponibilidad.addEventListener('click', function() {
            showAvailableChalets();
        });
    }

    // Listener para filtro de tipolog├¡a - solo oculta la secci├│n de habitaci├│n hasta nueva b├║squeda
    const tipologiaFilterSelectElement = document.getElementById('tipologia_select');
    tipologiaFilterSelectElement.addEventListener('change', function() {
        // Ocultar secci├│n de habitaci├│n hasta que se vuelva a validar
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

    // ========== FUNCIONES PARA CUPONES ==========
    let cuponAplicado = null; // Objeto con datos del cup├│n aplicado
    
    // Mostrar secci├│n de cup├│n despu├®s de calcular precio
    function mostrarSeccionCupon() {
        const sectionCupon = document.getElementById('section-cupon');
        if (sectionCupon) {
            sectionCupon.style.display = 'block';
        }
    }

    // Actualizar precio original (llamar desde obtenerTotalReserva)
    const precioOriginalSinCupon = { valor: 0 };

    // Aplicar cup├│n
    const btnAplicarCupon = document.getElementById('btn-aplicar-cupon');
    if (btnAplicarCupon) {
        btnAplicarCupon.addEventListener('click', async function() {
            const codigoCupon = document.getElementById('input-codigo-cupon').value.trim();
            
            if (!codigoCupon) {
                mostrarEstadoCupon('invalido', 'Por favor ingresa un c├│digo de cup├│n');
                return;
            }

            // Validar que haya precio calculado
            const total = parseFloat(document.getElementById('habitacion_total').value) || 0;
            if (total === 0) {
                mostrarEstadoCupon('invalido', 'Primero debes seleccionar una habitaci├│n y hu├®spedes');
                return;
            }

            try {
                mostrarEstadoCupon('validando', 'Validando cup├│n...');
                document.getElementById('validando-cupon').style.display = 'block';
                btnAplicarCupon.disabled = true;

                const habitacionId = document.getElementById('id_cabana').value;
                const noches = parseInt(document.getElementById('event_nights').value) || 0;
                const clienteId = document.getElementById('lblClientValue').value || null;

                const response = await fetch('/api/cupones/validar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        codigo: codigoCupon,
                        montoReserva: total,
                        habitacionId: habitacionId,
                        noches: noches,
                        clienteId: clienteId
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    mostrarEstadoCupon('invalido', data.message || 'Cup├│n inv├ílido');
                    return;
                }

                // Cup├│n v├ílido - guardar datos y mostrar detalle
                cuponAplicado = {
                    cuponId: data.data.cupon.id,
                    codigo: data.data.cupon.codigo,
                    nombre: data.data.cupon.nombre,
                    descripcion: data.data.cupon.descripcion,
                    tipo: data.data.cupon.tipo,
                    valor: data.data.cupon.valor,
                    aplicableA: data.data.cupon.aplicableA,
                    descuentoTotal: data.data.descuento,
                    descuentoOwner: data.data.descuentoOwner,
                    descuentoUsuarios: data.data.descuentoUsuarios,
                    montoFinal: data.data.montoFinal
                };

                // Guardar precio original
                precioOriginalSinCupon.valor = total;

                mostrarEstadoCupon('valido', 'Cup├│n aplicado correctamente');
                mostrarDetalleCupon(cuponAplicado);
                aplicarDescuentoCupon(cuponAplicado);

                // Deshabilitar input y bot├│n aplicar
                document.getElementById('input-codigo-cupon').disabled = true;
                btnAplicarCupon.disabled = true;

            } catch (error) {
                console.error('Error al validar cup├│n:', error);
                mostrarEstadoCupon('invalido', 'Error al validar el cup├│n');
            } finally {
                document.getElementById('validando-cupon').style.display = 'none';
                btnAplicarCupon.disabled = false;
            }
        });
    }

    // Remover cup├│n
    const btnRemoverCupon = document.getElementById('btn-remover-cupon');
    if (btnRemoverCupon) {
        btnRemoverCupon.addEventListener('click', function() {
            removerCupon();
        });
    }

    function mostrarEstadoCupon(tipo, mensaje) {
        const badge = document.getElementById('cupon-estado-badge');
        if (!badge) return;

        badge.style.display = 'inline-flex';
        badge.className = `cupon-estado-badge ${tipo}`;
        
        let icono = '';
        if (tipo === 'validando') icono = '<i class="fa fa-spinner fa-spin"></i>';
        else if (tipo === 'valido') icono = '<i class="fa fa-check-circle"></i>';
        else if (tipo === 'invalido') icono = '<i class="fa fa-times-circle"></i>';

        badge.innerHTML = `${icono} ${mensaje}`;

        // Ocultar badge despu├®s de 3 segundos si es error
        if (tipo === 'invalido') {
            setTimeout(() => {
                badge.style.display = 'none';
            }, 3000);
        }
    }

    function mostrarDetalleCupon(cupon) {
        const detalleCard = document.getElementById('cupon-detalle');
        if (!detalleCard) return;

        document.getElementById('cupon-nombre').textContent = cupon.nombre;
        document.getElementById('cupon-descripcion').textContent = cupon.descripcion || '';
        
        let descuentoTexto = '';
        if (cupon.tipo === 'percentage') {
            descuentoTexto = `Descuento: ${cupon.valor}% (-$${cupon.descuentoTotal.toFixed(2)} MXN)`;
        } else if (cupon.tipo === 'fixed_amount') {
            descuentoTexto = `Descuento: $${cupon.descuentoTotal.toFixed(2)} MXN`;
        } else if (cupon.tipo === 'nights_free') {
            descuentoTexto = `Descuento: $${cupon.descuentoTotal.toFixed(2)} MXN (noches gratis)`;
        }
        document.getElementById('cupon-descuento').textContent = descuentoTexto;

        let aplicableTexto = '';
        if (cupon.aplicableA === 'all') {
            aplicableTexto = 'Aplica a: Owner y comisiones (distribuci├│n proporcional)';
        } else if (cupon.aplicableA === 'owner_only') {
            aplicableTexto = 'Aplica a: Solo owner (costo base)';
        } else if (cupon.aplicableA === 'except_owner') {
            aplicableTexto = 'Aplica a: Solo comisiones (excepto owner)';
        }
        document.getElementById('cupon-aplicable').textContent = aplicableTexto;

        detalleCard.style.display = 'block';
    }

    async function aplicarDescuentoCupon(cupon) {
        console.log("\n========== APLICANDO DESCUENTO CUP├ôN (FRONTEND) ==========");
        console.log("Cup├│n:", cupon);
        
        const subtotalMonto = document.getElementById('subtotal-monto');
        const descuentoMonto = document.getElementById('descuento-monto');
        const totalInput = document.getElementById('habitacion_total');
        
        const rowSubtotal = document.getElementById('row-subtotal');
        const rowDescuento = document.getElementById('row-descuento');
        const separator = document.getElementById('separator-descuento');

        // Recalcular comisiones con el cup├│n usando la nueva l├│gica de pools
        console.log("Recalculando comisiones con cup├│n...");
        const habitacionId = document.getElementById('id_cabana').value;
        const nNights = parseInt(document.getElementById('event_nights').value) || 0;
        const totalSinComisionesOriginal = parseFloat(totalSinComisiones.value) || 0;
        const costoBaseOriginal = parseFloat(totalCostoBaseInput.value) || 0;
        
        // Obtener comisiones originales primero
        const comisionesOriginales = await obtenerComisiones(nNights, habitacionId, null, totalSinComisionesOriginal, costoBaseOriginal);
        
        // Calcular componentes usando la nueva l├│gica de pools
        const F = 35; // NyN siempre fijo
        const utilidadOriginal = totalSinComisionesOriginal - costoBaseOriginal;
        
        // T = Total original
        const T = precioOriginalSinCupon.valor;
        
        // T' = Total nuevo (despu├®s del descuento)
        const Tprima = T - cupon.descuentoTotal;
        
        // V' = Pool variable nuevo (todo menos NyN)
        const Vprima = Tprima - F;
        
        console.log("=== C├ílculo con nueva l├│gica de pools ===");
        console.log("Total original (T):", T);
        console.log("Descuento:", cupon.descuentoTotal);
        console.log("Total nuevo (T'):", Tprima);
        console.log("NyN (fijo):", F);
        console.log("Pool variable (V'):", Vprima);
        
        // Calcular costo base ajustado seg├║n regla de absorci├│n
        let costoBaseAjustado = costoBaseOriginal;
        
        if (cupon.aplicableA === 'owner_only') {
            // Regla 1: Solo el due├▒o absorbe
            // Owner' = V' - (Util + comisiones ajustables)
            // Las comisiones NO cambian (se les restar├í al pool para obtener el nuevo owner)
            costoBaseAjustado = Vprima - (utilidadOriginal + comisionesOriginales.minComission - F);
            console.log("OWNER_ONLY: Solo el due├▒o absorbe");
            console.log("  Costo base ajustado:", costoBaseAjustado);
            
        } else if (cupon.aplicableA === 'except_owner') {
            // Regla 2: Todos menos el due├▒o
            // Owner queda fijo, resto se escala
            costoBaseAjustado = costoBaseOriginal; // No cambia
            console.log("EXCEPT_OWNER: Owner fijo, resto se escala");
            console.log("  Costo base (sin cambio):", costoBaseAjustado);
            
        } else if (cupon.aplicableA === 'all') {
            // Regla 3: Todos absorben
            // Todo se escala proporcionalmente
            const Vall = costoBaseOriginal + utilidadOriginal + (comisionesOriginales.minComission - F);
            const factor = Vprima / Vall;
            
            costoBaseAjustado = costoBaseOriginal * factor;
            console.log("ALL: Todos absorben");
            console.log("  Pool total variable (Vall):", Vall);
            console.log("  Factor:", factor.toFixed(4));
            console.log("  Costo base ajustado:", costoBaseAjustado);
        }
        
        console.log("=========================================");
        
        const cuponData = {
            descuentoTotal: cupon.descuentoTotal,
            aplicableA: cupon.aplicableA
        };
        
        const comisionesConCupon = await obtenerComisiones(nNights, habitacionId, cuponData, totalSinComisionesOriginal, costoBaseAjustado);
        console.log("Comisiones recalculadas con cup├│n:", comisionesConCupon);
        
        // El servidor ahora regresa el precio base ajustado y el precio total final
        // Usamos precioBaseAjustado en lugar de totalSinComisionesOriginal
        const precioBaseNuevo = comisionesConCupon.precioBaseAjustado || totalSinComisionesOriginal;
        const precioTotalCalculado = comisionesConCupon.precioTotalFinal || (precioBaseNuevo + comisionesConCupon.minComission);
        
        // Guardar el costo base ajustado en variable global para usarlo al crear la reserva
        costoBaseAjustadoGlobal = comisionesConCupon.costoBaseAjustado || costoBaseOriginal;
        
        precioMinimoPermitido = precioTotalCalculado;
        
        console.log("========== RESUMEN FINAL CON CUP├ôN ==========");
        console.log("Precio Base Original:", totalSinComisionesOriginal);
        console.log("Precio Base Ajustado:", precioBaseNuevo);
        console.log("Comisiones Ajustadas:", comisionesConCupon.minComission);
        console.log("Precio Total Final:", precioTotalCalculado);
        console.log("Verificaci├│n T':", Tprima);
        console.log("=============================================");
        
        // Mostrar filas de subtotal y descuento
        rowSubtotal.style.display = 'flex';
        rowDescuento.style.display = 'flex';
        separator.style.display = 'block';

        // Actualizar valores
        subtotalMonto.textContent = `$${precioOriginalSinCupon.valor.toFixed(2)} MXN`;
        descuentoMonto.textContent = `-$${cupon.descuentoTotal.toFixed(2)} MXN`;
        totalInput.value = cupon.montoFinal.toFixed(2);
        
        console.log("Precio original sin cup├│n:", precioOriginalSinCupon.valor);
        console.log("Descuento total:", cupon.descuentoTotal);
        console.log("Monto final:", cupon.montoFinal);
        console.log("========== FIN APLICAR DESCUENTO CUP├ôN ==========\n");
    }

    function removerCupon() {
        console.log("\n========== REMOVIENDO CUP├ôN ==========");
        // Restaurar precio original
        if (precioOriginalSinCupon.valor > 0) {
            document.getElementById('habitacion_total').value = precioOriginalSinCupon.valor;
            console.log("Precio restaurado a:", precioOriginalSinCupon.valor);
        }

        // Ocultar filas de descuento
        document.getElementById('row-subtotal').style.display = 'none';
        document.getElementById('row-descuento').style.display = 'none';
        document.getElementById('separator-descuento').style.display = 'none';

        // Ocultar detalle y badge
        document.getElementById('cupon-detalle').style.display = 'none';
        document.getElementById('cupon-estado-badge').style.display = 'none';

        // Limpiar input y habilitar
        document.getElementById('input-codigo-cupon').value = '';
        document.getElementById('input-codigo-cupon').disabled = false;
        document.getElementById('btn-aplicar-cupon').disabled = false;

        // Limpiar datos del cup├│n
        cuponAplicado = null;
        costoBaseAjustadoGlobal = null; // Resetear el costo base ajustado
        precioOriginalSinCupon.valor = 0;

        console.log("Cup├│n removido, recalculando precios...");
        // Recalcular precio m├¡nimo sin cup├│n
        obtenerTotalReserva();
        console.log("========== FIN REMOVER CUP├ôN ==========\n");
    }

});
