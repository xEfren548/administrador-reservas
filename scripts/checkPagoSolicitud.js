// Check de la regla que protege el pago ligado a una solicitud SW.
// Correr: node scripts/checkPagoSolicitud.js
const assert = require('assert');
const { accionSobreSolicitudLigada } = require('../utils/validations');

// Aprobada = ya hay transaccion y saldo movido: nunca se toca el pago.
assert.strictEqual(accionSobreSolicitudLigada('Aprobada'), 'bloquear');
// Pendiente = el dueño todavia no aprueba: editar sincroniza, eliminar cancela.
assert.strictEqual(accionSobreSolicitudLigada('Pendiente'), 'sincronizar');
// Sin solicitud viva: el pago es libre.
assert.strictEqual(accionSobreSolicitudLigada('Rechazada'), 'ninguna');
assert.strictEqual(accionSobreSolicitudLigada('Cancelada'), 'ninguna');
assert.strictEqual(accionSobreSolicitudLigada(undefined), 'ninguna');

console.log('OK: accionSobreSolicitudLigada');
