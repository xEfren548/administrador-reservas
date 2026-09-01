// Decide que hacer con la solicitud SW ligada a un pago cuando el pago se edita o se elimina.
// 'bloquear'    -> la solicitud ya creo la transaccion y movio el saldo: el pago no se puede tocar.
// 'sincronizar' -> solicitud pendiente: hay que reflejar el cambio (o cancelarla si el pago se elimina).
// 'ninguna'     -> no hay solicitud viva que mantener (Rechazada, Cancelada o sin solicitud).
function accionSobreSolicitudLigada(estadoSolicitud) {
    if (estadoSolicitud === 'Aprobada') return 'bloquear';
    if (estadoSolicitud === 'Pendiente') return 'sincronizar';
    return 'ninguna';
}

module.exports = { accionSobreSolicitudLigada };
