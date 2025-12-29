const cron = require('node-cron');
const SWTransaccionRecurrente = require('../../models/SWTransaccionRecurrente');
const SWTransaccion = require('../../models/SWTransaccion');

/**
 * Ejecutar transacciones recurrentes que deben procesarse
 */
async function ejecutarTransaccionesRecurrentes() {
    try {
        console.log('[CRON] Iniciando ejecución de transacciones recurrentes...');
        
        const hoy = new Date();
        hoy.setHours(23, 59, 59, 999); // Incluir todo el día de hoy
        
        // Buscar transacciones recurrentes que deben ejecutarse
        const recurrentes = await SWTransaccionRecurrente.find({
            activa: true,
            proximaEjecucion: { $lte: hoy },
            ejecutarAutomaticamente: true,
            $or: [
                { fechaFin: { $exists: false } },
                { fechaFin: null },
                { fechaFin: { $gte: hoy } }
            ]
        }).populate('cuenta');
        
        console.log(`[CRON] Se encontraron ${recurrentes.length} transacciones recurrentes para ejecutar`);
        
        let ejecutadas = 0;
        let errores = 0;
        
        for (const recurrente of recurrentes) {
            try {
                // Crear la transacción
                const nuevaTransaccion = new SWTransaccion({
                    cuenta: recurrente.cuenta._id,
                    tipo: recurrente.tipo,
                    monto: recurrente.monto,
                    concepto: recurrente.concepto,
                    categoria: recurrente.categoria,
                    descripcion: `[Recurrente] ${recurrente.descripcion || ''}`,
                    fecha: new Date(),
                    creadoPor: recurrente.creadoPor,
                    aprobada: true,
                    aprobadaPor: recurrente.creadoPor,
                    fechaAprobacion: new Date(),
                    esRecurrente: true,
                    transaccionRecurrenteId: recurrente._id
                });
                
                await nuevaTransaccion.save();
                
                // Actualizar saldo de la cuenta
                await recurrente.cuenta.calcularSaldo();
                await recurrente.cuenta.save();
                
                // Actualizar la transacción recurrente
                recurrente.ultimaEjecucion = new Date();
                recurrente.proximaEjecucion = recurrente.calcularProximaEjecucion();
                recurrente.transaccionesGeneradas.push({
                    transaccion: nuevaTransaccion._id,
                    fecha: new Date()
                });
                
                // Si ya pasó la fecha fin, desactivar
                if (recurrente.fechaFin && recurrente.proximaEjecucion > recurrente.fechaFin) {
                    recurrente.activa = false;
                }
                
                await recurrente.save();
                
                console.log(`[CRON] ✓ Transacción recurrente ejecutada: ${recurrente.concepto} (${recurrente._id})`);
                ejecutadas++;
                
            } catch (error) {
                console.error(`[CRON] ✗ Error ejecutando transacción recurrente ${recurrente._id}:`, error.message);
                errores++;
            }
        }
        
        console.log(`[CRON] Finalizado: ${ejecutadas} ejecutadas, ${errores} errores`);
        
        return {
            total: recurrentes.length,
            ejecutadas,
            errores
        };
        
    } catch (error) {
        console.error('[CRON] Error en ejecución de transacciones recurrentes:', error);
        throw error;
    }
}

/**
 * Programar la tarea para ejecutarse todos los días a las 6:00 AM
 */
function iniciarCronTransaccionesRecurrentes() {
    // Ejecutar todos los días a las 6:00 AM
    cron.schedule('0 6 * * *', async () => {
        console.log('[CRON] Ejecutando tarea programada de transacciones recurrentes');
        await ejecutarTransaccionesRecurrentes();
    }, {
        timezone: "America/Mexico_City"
    });
    
    console.log('✓ Tarea programada de transacciones recurrentes iniciada (6:00 AM diario)');
}

module.exports = {
    iniciarCronTransaccionesRecurrentes,
    ejecutarTransaccionesRecurrentes // Exportar para ejecución manual
};
