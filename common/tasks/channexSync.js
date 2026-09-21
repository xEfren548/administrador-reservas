const cron = require('node-cron');
const moment = require('moment');
const Habitacion = require('../../models/Habitacion');
const channexController = require('../../controllers/channexController');

const ESTADO_A_EVENTO = {
    new: 'booking_new',
    modified: 'booking_modification',
    cancelled: 'booking_cancellation'
};

/**
 * Arma el body que espera procesarEventoBooking a partir de una revisión del feed,
 * para que el poller y el webhook compartan exactamente la misma lógica de aplicación.
 */
function revisionABody(revision) {
    const attrs = revision.attributes || {};
    const noches = moment(attrs.departure_date).diff(moment(attrs.arrival_date), 'days');

    return {
        event: ESTADO_A_EVENTO[attrs.status],
        payload: {
            booking_id: attrs.booking_id,
            booking_revision_id: revision.id,
            property_id: attrs.property_id,
            amount: Number(attrs.amount),
            count_of_nights: noches
        }
    };
}

/**
 * Drena el feed de revisiones hasta vaciarlo.
 *
 * El feed NO es una cola durable: una revisión sin ack se re-sirve ~30 minutos y
 * después desaparece para siempre. Por eso se drena entero en cada vuelta en vez
 * de una página por tick, y un error en una revisión no corta el resto.
 */
async function procesarFeed() {
    let vueltas = 0;
    // ponytail: tope de 20 páginas por corrida (200 revisiones) para no quedarse girando
    // si algo falla y el feed nunca se vacía. Si se topa seguido, revisar las alertas.
    const MAX_VUELTAS = 20;

    while (vueltas < MAX_VUELTAS) {
        vueltas++;

        const revisiones = await channexController.obtenerFeedRevisiones();
        if (revisiones.length === 0) return;

        console.log(`[CHANNEX] Feed: ${revisiones.length} revisión(es) por aplicar`);

        for (const revision of revisiones) {
            const attrs = revision.attributes || {};
            try {
                const evento = ESTADO_A_EVENTO[attrs.status];
                if (!evento) {
                    await channexController.descartarRevision(revision.id, `status desconocido "${attrs.status}"`);
                    continue;
                }

                // Propiedades ajenas (pruebas sueltas en la cuenta) se descartan con ack,
                // si no atoran el feed cada minuto durante media hora.
                const esNuestra = await Habitacion.exists({ channexPropertyId: attrs.property_id });
                if (!esNuestra) {
                    await channexController.descartarRevision(revision.id, `property_id ${attrs.property_id} no está mapeado en el PMS`);
                    continue;
                }

                await channexController.procesarEventoBooking(revisionABody(revision));
                console.log(`[CHANNEX] Revisión ${revision.id} (${evento}) aplicada`);
            } catch (err) {
                // Sin ack: se reintenta en la siguiente vuelta, dentro de la ventana de 30 min.
                console.error(`[CHANNEX][ALERTA] Falló la revisión ${revision.id} (booking ${attrs.booking_id}):`, err.message);
            }
        }
    }

    console.warn(`[CHANNEX][ALERTA] El feed no se vació en ${MAX_VUELTAS} vueltas, hay revisiones atoradas`);
}

/**
 * Push completo de precios y disponibilidad. Corrige la deriva que deja
 * cualquier evento perdido: sin esto, un push fallido desincroniza para siempre.
 */
async function pushCompletoChannex() {
    const habitaciones = await Habitacion.find({
        channexPropertyId: { $exists: true, $ne: null },
        channexRoomId: { $exists: true, $ne: null },
        'channels.0': { $exists: true }
    }).select('_id propertyDetails.name').lean();

    console.log(`[CHANNEX] Push completo: ${habitaciones.length} habitación(es)`);

    for (const hab of habitaciones) {
        try {
            await channexController.updateChannexPrices(hab._id);
            await channexController.updateChannexAvailability(hab._id);
            console.log(`[CHANNEX] Push completo OK: ${hab.propertyDetails?.name}`);
        } catch (err) {
            console.error(`[CHANNEX][ALERTA] Push completo falló para ${hab.propertyDetails?.name}:`, err.message);
        }
    }
}

function iniciarCronChannex() {
    // El feed es el respaldo del webhook: si el webhook se pierde (deploy, caída,
    // túnel muerto), esto recoge la reserva antes de que expire a los 30 min.
    cron.schedule('* * * * *', async () => {
        try {
            await procesarFeed();
        } catch (err) {
            console.error('[CHANNEX][ALERTA] Error leyendo el feed:', err.message);
        }
    });

    // Corrección de deriva, 4:00 AM
    cron.schedule('0 4 * * *', async () => {
        console.log('[CHANNEX] Ejecutando push completo diario...');
        await pushCompletoChannex();
    }, {
        scheduled: true,
        timezone: 'America/Mexico_City'
    });

    console.log('[CHANNEX] Crons iniciados: feed cada minuto, push completo 4:00 AM');
}

module.exports = { iniciarCronChannex, procesarFeed, pushCompletoChannex };
