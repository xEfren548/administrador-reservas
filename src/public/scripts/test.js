var btnUpdateClient = document.getElementById("btnUpdateClient");

if (btnUpdateClient) {
    btnUpdateClient.addEventListener("click", async (event) => {
        event.preventDefault();

        const selectClientOption = document.getElementById('seleccionar-opcion-cliente').value;
        const reservacionId = "{{evento._id}}"


        if (selectClientOption === "completar-datos-cliente") {

            if (document.getElementById("txtClientPhoneUpd").value.trim().length > 10) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'El número de teléfono debe tener 10 dígitos.',
                    confirmButtonText: 'Aceptar'
                })
                return;
            }

            const clientId = document.querySelector('#cliente-id').value;
            const data = {
                firstName: document.getElementById("txtClientNameUpd").value.trim(),
                lastName: document.getElementById("txtClientLastnameUpd").value.trim(),
                phone: document.getElementById("txtClientPhoneUpd").value.trim(),
                address: document.getElementById("txtClientAddressUpd").value.trim(),
                email: document.getElementById("txtClientEmailUpd").value.trim(),
                identificationType: document.getElementById("slctClientIdTypeUpd").value.trim(),
                identificationNumber: document.getElementById("txtClientIdNumberUpd").value.trim()
            };

            try {
                const response = await fetch(`/api/clientes/editar-cliente/${clientId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    const errorMessage = errorData?.error?.[0]?.message.toLowerCase() || "Unknown error";

                    return Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: "Error en la solicitud: " + errorMessage + ".",
                        confirmButtonText: 'Aceptar'
                    });
                }

                const updatedData = await response.json();
                document.getElementById('cliente-email').value = updatedData.clienteToUpdate.email;
                document.getElementById('cliente-phone').value = updatedData.clienteToUpdate.phone;
                document.getElementById('cliente-address').value = updatedData.clienteToUpdate.address;

                isClientUpdated = true;

                Swal.fire({
                    icon: 'success',
                    title: '¡Completado!',
                    text: "Cliente actualizado con éxito.",
                    confirmButtonText: 'Aceptar'
                }).then((result) => {
                    if (result.isConfirmed) {
                        $('#modifyClientEntryModal').modal('hide');
                    }
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al enviar la solicitud: ' + error.message.toLowerCase() + '.',
                    confirmButtonText: 'Aceptar'
                });
            }
        } else if (selectClientOption === "seleccionar-cliente") {
            const clientId = document.querySelector('#lblClientValue').value;
            console.log("Client email: ", clientId);

            try {
                const response = await fetch('/clientes/asignar-cliente', {
                    method: 'PUT',
                    body: JSON.stringify({
                        email: clientId,
                        idReservation: reservacionId
                    })

                })

                if (!response.ok) {
                    const errorData = await response.json();
                    const errorMessage = errorData.message || "Unknown error";
                    return Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: "Error en la solicitud: " + errorMessage + ".",
                        confirmButtonText: 'Aceptar'
                    });
                }

            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al enviar la solicitud: ' + error.message.toLowerCase() + '.',
                    confirmButtonText: 'Aceptar'
                })
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona una opción.',
                confirmButtonText: 'Aceptar'
            })
            return;
        }
    });
}