const { ejecutarTransaccionesRecurrentes } = require('../common/tasks/ejecutarTransaccionesRecurrentes');
const { verificarCuotasVencidas, notificarCuotasProximas } = require('../common/tasks/verificarPagosDiferidos');

/**
 * Controlador para ejecutar tareas cron manualmente (solo para testing/admin)
 */

/**
 * Ejecutar manualmente todas las transacciones recurrentes pendientes
 */
const ejecutarRecurrentesManual = async (req, res) => {
    try {
        console.log('[MANUAL] Ejecutando transacciones recurrentes manualmente...');
        const resultado = await ejecutarTransaccionesRecurrentes();
        
        res.status(200).json({
            success: true,
            message: 'Tarea de transacciones recurrentes ejecutada',
            data: resultado
        });
    } catch (error) {
        console.error('[MANUAL] Error ejecutando transacciones recurrentes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al ejecutar transacciones recurrentes',
            error: error.message
        });
    }
};

/**
 * Verificar manualmente cuotas vencidas
 */
const verificarCuotasManual = async (req, res) => {
    try {
        console.log('[MANUAL] Verificando cuotas vencidas manualmente...');
        const resultado = await verificarCuotasVencidas();
        
        res.status(200).json({
            success: true,
            message: 'Verificación de cuotas vencidas ejecutada',
            data: resultado
        });
    } catch (error) {
        console.error('[MANUAL] Error verificando cuotas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al verificar cuotas vencidas',
            error: error.message
        });
    }
};

/**
 * Verificar manualmente cuotas próximas a vencer
 */
const notificarCuotasProximasManual = async (req, res) => {
    try {
        console.log('[MANUAL] Verificando cuotas próximas manualmente...');
        const resultado = await notificarCuotasProximas();
        
        res.status(200).json({
            success: true,
            message: 'Verificación de cuotas próximas ejecutada',
            data: resultado
        });
    } catch (error) {
        console.error('[MANUAL] Error verificando cuotas próximas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al verificar cuotas próximas',
            error: error.message
        });
    }
};

/**
 * Ejecutar todas las tareas cron
 */
const ejecutarTodasLasTareas = async (req, res) => {
    try {
        console.log('[MANUAL] Ejecutando todas las tareas cron manualmente...');
        
        const resultados = {
            recurrentes: await ejecutarTransaccionesRecurrentes(),
            cuotasVencidas: await verificarCuotasVencidas(),
            cuotasProximas: await notificarCuotasProximas()
        };
        
        res.status(200).json({
            success: true,
            message: 'Todas las tareas cron ejecutadas exitosamente',
            data: resultados
        });
    } catch (error) {
        console.error('[MANUAL] Error ejecutando tareas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al ejecutar las tareas',
            error: error.message
        });
    }
};

module.exports = {
    ejecutarRecurrentesManual,
    verificarCuotasManual,
    notificarCuotasProximasManual,
    ejecutarTodasLasTareas
};
