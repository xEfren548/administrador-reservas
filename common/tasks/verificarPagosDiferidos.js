const cron = require('node-cron');
const SWPagoDiferido = require('../../models/SWPagoDiferido');

/**
 * Verificar y actualizar estado de cuotas vencidas
 */
async function verificarCuotasVencidas() {
    try {
        console.log('[CRON] Iniciando verificación de cuotas vencidas...');
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        // Buscar pagos diferidos activos
        const pagosDiferidos = await SWPagoDiferido.find({
            estado: 'Activo'
        }).populate('cuenta');
        
        console.log(`[CRON] Se encontraron ${pagosDiferidos.length} pagos diferidos activos`);
        
        let cuotasActualizadas = 0;
        
        for (const pago of pagosDiferidos) {
            let huboActualizacion = false;
            
            for (let cuota of pago.cuotas) {
                if (cuota.estado === 'Pendiente' && cuota.fechaProgramada <= hoy) {
                    cuota.estado = 'Vencida';
                    huboActualizacion = true;
                    cuotasActualizadas++;
                    
                    console.log(`[CRON] Cuota vencida: Pago ${pago._id}, Cuota ${cuota.numero}/${pago.numeroPagos}`);
                    
                    // Aquí puedes agregar lógica para enviar notificaciones
                    // Por ejemplo: enviarEmailCuotaVencida(pago, cuota);
                }
            }
            
            if (huboActualizacion) {
                await pago.save();
            }
        }
        
        console.log(`[CRON] Finalizado: ${cuotasActualizadas} cuotas marcadas como vencidas`);
        
        return {
            totalPagos: pagosDiferidos.length,
            cuotasVencidas: cuotasActualizadas
        };
        
    } catch (error) {
        console.error('[CRON] Error verificando cuotas vencidas:', error);
        throw error;
    }
}

/**
 * Notificar cuotas próximas a vencer (3 días antes)
 */
async function notificarCuotasProximas() {
    try {
        console.log('[CRON] Verificando cuotas próximas a vencer...');
        
        const hoy = new Date();
        const tresDiasDespues = new Date(hoy);
        tresDiasDespues.setDate(tresDiasDespues.getDate() + 3);
        
        const pagosDiferidos = await SWPagoDiferido.find({
            estado: 'Activo'
        }).populate('cuenta').populate('creadoPor', 'firstName lastName email');
        
        let notificaciones = 0;
        
        for (const pago of pagosDiferidos) {
            for (let cuota of pago.cuotas) {
                if (cuota.estado === 'Pendiente' && 
                    cuota.fechaProgramada >= hoy && 
                    cuota.fechaProgramada <= tresDiasDespues) {
                    
                    console.log(`[CRON] Cuota próxima a vencer: ${pago.concepto} - Cuota ${cuota.numero} - ${cuota.fechaProgramada.toLocaleDateString()}`);
                    notificaciones++;
                    
                    // Aquí puedes agregar lógica para enviar notificaciones
                    // Por ejemplo: enviarEmailCuotaProxima(pago, cuota);
                }
            }
        }
        
        console.log(`[CRON] ${notificaciones} cuotas próximas a vencer encontradas`);
        
        return { notificaciones };
        
    } catch (error) {
        console.error('[CRON] Error notificando cuotas próximas:', error);
        throw error;
    }
}

/**
 * Programar tareas de pagos diferidos
 */
function iniciarCronPagosDiferidos() {
    // Verificar cuotas vencidas todos los días a las 6:30 AM
    cron.schedule('30 6 * * *', async () => {
        console.log('[CRON] Ejecutando tarea de verificación de cuotas vencidas');
        await verificarCuotasVencidas();
    }, {
        timezone: "America/Mexico_City"
    });
    
    // Notificar cuotas próximas todos los días a las 6:40 AM
    cron.schedule('40 6 * * *', async () => {
        console.log('[CRON] Ejecutando tarea de notificación de cuotas próximas');
        await notificarCuotasProximas();
    }, {
        timezone: "America/Mexico_City"
    });
    
    console.log('✓ Tareas programadas de pagos diferidos iniciadas (6:30 AM y 6:40 AM)');
}

module.exports = {
    iniciarCronPagosDiferidos,
    verificarCuotasVencidas, // Exportar para ejecución manual
    notificarCuotasProximas // Exportar para ejecución manual
};
