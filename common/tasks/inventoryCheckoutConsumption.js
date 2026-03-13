const cron = require('node-cron');
const { processFinishedReservationsCheckoutConsumption, TZ } = require('../../services/inventoryCheckoutService');

const runInventoryCheckoutConsumption = async () => {
    try {
        console.log('[CRON] Running inventory checkout consumption...');
        const summary = await processFinishedReservationsCheckoutConsumption(null);
        console.log('[CRON] Inventory checkout consumption completed:', summary);
        return summary;
    } catch (error) {
        console.error('[CRON] Error in inventory checkout consumption:', error);
        throw error;
    }
};

const iniciarCronInventarioCheckout = () => {
    // 6:50 AM Mexico City time, after other finance checks.
    cron.schedule('50 6 * * *', async () => {
        await runInventoryCheckoutConsumption();
    }, {
        timezone: TZ
    });

    console.log('✓ Inventory checkout cron initialized (6:50 AM America/Mexico_City)');
};

module.exports = {
    iniciarCronInventarioCheckout,
    runInventoryCheckoutConsumption
};
