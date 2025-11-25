const SWOrganizacion = require('../models/SWOrganizacion');
const SWCuenta = require('../models/SWCuenta');
const SWTransaccion = require('../models/SWTransaccion');
const SWParticipante = require('../models/SWParticipante');
const mongoose = require('mongoose');

/**
 * Obtener estadísticas de una organización
 */
const getEstadisticasOrganizacion = async (req, res) => {
    try {
        const { organizacionId } = req.params;
        const userId = req.session.userId;

        // Verificar que la organización existe
        const organizacion = await SWOrganizacion.findById(organizacionId);
        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        // Obtener todas las cuentas de la organización
        const cuentas = await SWCuenta.find({ 
            organizacion: organizacionId,
            activa: true 
        }).populate('propietario', 'firstName lastName');

        const cuentasIds = cuentas.map(c => c._id);

        // Verificar que el usuario es participante de al menos una cuenta de esta organización
        const participacion = await SWParticipante.findOne({
            cuenta: { $in: cuentasIds },
            usuario: userId,
            activo: true
        });

        if (!participacion) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a esta organización'
            });
        }

        // Obtener todas las transacciones de las cuentas
        const transacciones = await SWTransaccion.find({
            cuenta: { $in: cuentasIds },
            aprobada: true
        }).populate('creadoPor', 'firstName lastName')
          .populate('cuenta', 'nombre moneda');

        // Calcular totales generales
        let totalIngresos = 0;
        let totalGastos = 0;
        let saldoTotal = 0;

        cuentas.forEach(cuenta => {
            saldoTotal += cuenta.saldoActual || 0;
        });

        transacciones.forEach(trans => {
            if (trans.tipo === 'Ingreso') {
                totalIngresos += trans.monto;
            } else {
                totalGastos += trans.monto;
            }
        });

        // Estadísticas del mes actual
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const transaccionesMes = transacciones.filter(t => 
            new Date(t.fecha) >= inicioMes
        );

        let ingresosMes = 0;
        let gastosMes = 0;

        transaccionesMes.forEach(trans => {
            if (trans.tipo === 'Ingreso') {
                ingresosMes += trans.monto;
            } else {
                gastosMes += trans.monto;
            }
        });

        // Transacciones por categoría
        const transaccionesPorCategoria = {};
        transacciones.forEach(trans => {
            if (!transaccionesPorCategoria[trans.categoria]) {
                transaccionesPorCategoria[trans.categoria] = {
                    total: 0,
                    cantidad: 0,
                    tipo: trans.tipo
                };
            }
            transaccionesPorCategoria[trans.categoria].total += trans.monto;
            transaccionesPorCategoria[trans.categoria].cantidad += 1;
        });

        // Top usuarios por transacciones
        const usuariosStats = {};
        transacciones.forEach(trans => {
            const usuarioId = trans.creadoPor?._id?.toString();
            if (!usuarioId) return;

            if (!usuariosStats[usuarioId]) {
                usuariosStats[usuarioId] = {
                    nombre: `${trans.creadoPor.firstName} ${trans.creadoPor.lastName}`,
                    ingresos: 0,
                    gastos: 0,
                    cantidad: 0
                };
            }

            if (trans.tipo === 'Ingreso') {
                usuariosStats[usuarioId].ingresos += trans.monto;
            } else {
                usuariosStats[usuarioId].gastos += trans.monto;
            }
            usuariosStats[usuarioId].cantidad += 1;
        });

        const topUsuarios = Object.values(usuariosStats)
            .sort((a, b) => b.cantidad - a.cantidad);

        // Transacciones por mes (últimos 6 meses)
        const transaccionesPorMes = [];
        for (let i = 5; i >= 0; i--) {
            const fecha = new Date();
            fecha.setMonth(fecha.getMonth() - i);
            fecha.setDate(1);
            fecha.setHours(0, 0, 0, 0);

            const siguienteMes = new Date(fecha);
            siguienteMes.setMonth(siguienteMes.getMonth() + 1);

            const transaccionesPeriodo = transacciones.filter(t => {
                const fechaTrans = new Date(t.fecha);
                return fechaTrans >= fecha && fechaTrans < siguienteMes;
            });

            let ingresos = 0;
            let gastos = 0;

            transaccionesPeriodo.forEach(trans => {
                if (trans.tipo === 'Ingreso') {
                    ingresos += trans.monto;
                } else {
                    gastos += trans.monto;
                }
            });

            transaccionesPorMes.push({
                mes: fecha.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }),
                ingresos,
                gastos,
                neto: ingresos - gastos
            });
        }

        // Mi participación personal
        const misCuentas = await SWParticipante.find({
            usuario: userId,
            activo: true
        }).populate('cuenta');

        const misCuentasIds = misCuentas.map(p => p.cuenta._id);

        const misTransacciones = transacciones.filter(t => 
            misCuentasIds.some(id => id.toString() === t.cuenta._id.toString())
        );

        let misIngresos = 0;
        let misGastos = 0;

        misTransacciones.forEach(trans => {
            if (trans.tipo === 'Ingreso') {
                misIngresos += trans.monto;
            } else {
                misGastos += trans.monto;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                resumenGeneral: {
                    totalIngresos,
                    totalGastos,
                    saldoTotal,
                    numeroCuentas: cuentas.length,
                    numeroTransacciones: transacciones.length
                },
                resumenMes: {
                    ingresosMes,
                    gastosMes,
                    netoMes: ingresosMes - gastosMes,
                    numeroTransacciones: transaccionesMes.length
                },
                transaccionesPorCategoria: Object.entries(transaccionesPorCategoria)
                    .map(([categoria, data]) => ({
                        categoria,
                        ...data
                    }))
                    .sort((a, b) => b.total - a.total),
                topUsuarios,
                transaccionesPorMes,
                miParticipacion: {
                    ingresos: misIngresos,
                    gastos: misGastos,
                    neto: misIngresos - misGastos,
                    numeroCuentas: misCuentas.length,
                    numeroTransacciones: misTransacciones.length
                }
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
};

/**
 * Obtener estadísticas personales del usuario en todas las organizaciones
 * SOLO muestra estadísticas de las cuentas donde el usuario es PROPIETARIO
 */
const getEstadisticasPersonales = async (req, res) => {
    try {
        const userId = req.session.userId;

        // Obtener SOLO las cuentas donde el usuario es PROPIETARIO
        const cuentasPropias = await SWCuenta.find({
            propietario: userId,
            activa: true
        });

        const cuentasIds = cuentasPropias.map(c => c._id);

        // Obtener todas las transacciones de las cuentas propias
        const transacciones = await SWTransaccion.find({
            cuenta: { $in: cuentasIds },
            aprobada: true
        }).populate('cuenta', 'nombre moneda organizacion');

        // Calcular totales personales
        let totalIngresos = 0;
        let totalGastos = 0;
        let saldoTotal = 0;

        cuentasPropias.forEach(cuenta => {
            saldoTotal += cuenta.saldoActual || 0;
        });

        transacciones.forEach(trans => {
            if (trans.tipo === 'Ingreso') {
                totalIngresos += trans.monto;
            } else {
                totalGastos += trans.monto;
            }
        });

        // Transacciones por cuenta
        const transaccionesPorCuenta = {};
        transacciones.forEach(trans => {
            const cuentaId = trans.cuenta._id.toString();
            if (!transaccionesPorCuenta[cuentaId]) {
                transaccionesPorCuenta[cuentaId] = {
                    nombre: trans.cuenta.nombre,
                    ingresos: 0,
                    gastos: 0,
                    cantidad: 0
                };
            }

            if (trans.tipo === 'Ingreso') {
                transaccionesPorCuenta[cuentaId].ingresos += trans.monto;
            } else {
                transaccionesPorCuenta[cuentaId].gastos += trans.monto;
            }
            transaccionesPorCuenta[cuentaId].cantidad += 1;
        });

        // Transacciones recientes
        const transaccionesRecientes = transacciones
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 10)
            .map(t => ({
                _id: t._id,
                concepto: t.concepto,
                monto: t.monto,
                tipo: t.tipo,
                fecha: t.fecha,
                cuenta: t.cuenta.nombre,
                categoria: t.categoria
            }));

        res.status(200).json({
            success: true,
            data: {
                resumenGeneral: {
                    totalIngresos,
                    totalGastos,
                    saldoTotal,
                    neto: totalIngresos - totalGastos,
                    numeroCuentas: cuentasPropias.length,
                    numeroTransacciones: transacciones.length
                },
                transaccionesPorCuenta: Object.values(transaccionesPorCuenta)
                    .sort((a, b) => b.cantidad - a.cantidad),
                transaccionesRecientes
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas personales:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas personales',
            error: error.message
        });
    }
};

module.exports = {
    getEstadisticasOrganizacion,
    getEstadisticasPersonales
};
