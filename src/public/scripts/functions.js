document.addEventListener("DOMContentLoaded", function() {
    // Functions.
    function clearModal(modal){
        const inputs = modal.querySelectorAll('input');
        inputs.forEach(function(input) {
            input.value = "";
        });
        const selectors = modal.querySelectorAll('select');
        selectors.forEach(function(selector) {
            selector.value = "";
        });
        modal.querySelectorAll("p[name='errMsg']")[0].innerHTML = "";
    }

    // Clearing user's info when closing modal.
    const modals = document.querySelectorAll('.modal');
    modals.forEach(function(modal) {
        modal.addEventListener('hidden.bs.modal', () => {
            clearModal(modal);
        });
    });

    // Creating new reservation.
    document.getElementById('save-event-btn').addEventListener('click', function () {  
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
        };
        fetch('/api/eventos/create-reservation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                const error = response.statusText;
                document.getElementById("txtReservationError").innerHTML = "Error en la soliciutud: " + error.toLowerCase() + ".";
                throw new Error('Error en la solicitud: ' + error);
            }
            return response.json();
        })
        .then(data => {
            console.log('Respuesta exitosa del servidor:', data);
            clearModal(document.getElementById("event_entry_modal"));
            $('#event_entry_modal').modal('hide');
            //window.location.href = 'http://localhost:3005/instrucciones/' + data.reservationId;
        })
        .catch(error => {
            console.error('Ha ocurrido un error: ', error);
        });  
    })
});