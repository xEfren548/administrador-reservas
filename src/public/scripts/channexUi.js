/**
 * Bloqueo de botón para las acciones de Channex.
 *
 * Los endpoints de creación de Channex NO son idempotentes: cada POST a
 * /properties, /room_types, /rate_plans o /channels crea un recurso nuevo. Un
 * doble clic deja duplicados que después hay que limpiar a mano en el dashboard
 * de Channex, así que el botón se deshabilita mientras la petición está en vuelo.
 *
 * ponytail: es una protección de UI, no del servidor. No cubre un F5 a medio
 * camino ni dos pestañas abiertas; si eso llega a pasar, el arreglo de fondo es
 * reutilizar el recurso existente en el controlador antes de hacer el POST.
 */
async function bloquearMientras(boton, accion) {
    if (boton && boton.disabled) return; // ya hay una petición corriendo
    const textoOriginal = boton ? boton.innerHTML : null;
    if (boton) {
        boton.disabled = true;
        boton.innerHTML = 'Procesando...';
    }
    try {
        return await accion();
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.innerHTML = textoOriginal;
        }
    }
}

/** El botón de submit de un formulario, para poder bloquearlo desde su handler. */
function botonSubmit(form) {
    return form.querySelector('button[type="submit"]');
}

// Autocomprobación: `node src/public/scripts/channexUi.js`. En el navegador no corre.
if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
    const assert = require('assert');
    (async () => {
        const boton = { disabled: false, innerHTML: 'Dar de alta' };
        let llamadas = 0;
        const accion = () => new Promise(r => setTimeout(() => { llamadas++; r('listo'); }, 20));

        // El segundo clic mientras el primero está en vuelo no dispara nada
        const primero = bloquearMientras(boton, accion);
        assert.strictEqual(boton.disabled, true, 'el botón debe quedar deshabilitado');
        await bloquearMientras(boton, accion);
        assert.strictEqual(await primero, 'listo');
        assert.strictEqual(llamadas, 1, 'el doble clic no debe repetir la acción');

        // Y el botón vuelve a su estado original
        assert.strictEqual(boton.disabled, false);
        assert.strictEqual(boton.innerHTML, 'Dar de alta');

        // Si la acción truena, el botón se libera igual
        await assert.rejects(bloquearMientras(boton, async () => { throw new Error('boom'); }), /boom/);
        assert.strictEqual(boton.disabled, false, 'un error no debe dejar el botón trabado');

        console.log('channexUi: ok');
    })();
}
