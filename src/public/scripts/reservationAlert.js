// Alerta de reserva creada; si es tentativa por depo muestra los datos de depósito para que el vendedor los copie al cliente
function showReservationCreatedAlert(message, depositInstructions) {
    if (!depositInstructions) {
        return Swal.fire({ icon: 'success', title: 'Reserva creada', text: message, confirmButtonColor: '#3085d6', confirmButtonText: 'Aceptar' });
    }

    const container = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = message;
    const textarea = document.createElement('textarea');
    textarea.readOnly = true;
    textarea.rows = 12;
    textarea.className = 'form-control';
    textarea.style.cssText = 'width:100%;font-size:0.85rem;white-space:pre-wrap;';
    textarea.value = depositInstructions;
    container.append(p, textarea);

    return Swal.fire({
        icon: 'success',
        title: 'Reserva creada',
        html: container,
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Aceptar',
        showDenyButton: true,
        denyButtonColor: '#6c757d',
        denyButtonText: 'Copiar datos',
        preDeny: async () => {
            try {
                await navigator.clipboard.writeText(depositInstructions);
            } catch (e) {
                textarea.select();
                document.execCommand('copy');
            }
            Swal.getDenyButton().textContent = '¡Copiado!';
            return false; // no cerrar la alerta
        }
    });
}
