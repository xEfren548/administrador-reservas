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
        const { fechaDesde, fechaHasta } = req.query;
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

        // Construir filtro de fechas con timezone de México
        let dateFilter = {};
        if (fechaDesde || fechaHasta) {
            dateFilter.fecha = {};
            if (fechaDesde) {
                // Agregar timezone de México (UTC-6)
                dateFilter.fecha.$gte = new Date(fechaDesde + 'T00:00:00-06:00');
            }
            if (fechaHasta) {
                // Agregar timezone de México (UTC-6)
                dateFilter.fecha.$lte = new Date(fechaHasta + 'T23:59:59-06:00');
            }
        }

        // Obtener todas las transacciones de las cuentas con filtro de fechas
        const transacciones = await SWTransaccion.find({
            cuenta: { $in: cuentasIds },
            aprobada: true,
            ...dateFilter
        }).populate('creadoPor', 'firstName lastName')
          .populate('cuenta', 'nombre moneda');

        // Calcular saldos iniciales de todas las cuentas
        let totalSaldosIniciales = 0;
        cuentas.forEach(cuenta => {
            totalSaldosIniciales += cuenta.saldoInicial || 0;
        });

        // Calcular totales generales basados en transacciones filtradas
        let totalIngresos = 0;
        let totalGastos = 0;

        transacciones.forEach(trans => {
            if (trans.tipo === 'Ingreso') {
                totalIngresos += trans.monto;
            } else {
                totalGastos += trans.monto;
            }
        });

        // Saldo total = saldos iniciales + ingresos - gastos
        const saldoTotal = totalSaldosIniciales + totalIngresos - totalGastos;

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

        // Obtener todos los participantes de las cuentas de la organización
        const participantes = await SWParticipante.find({
            cuenta: { $in: cuentasIds },
            activo: true
        }).populate('usuario', 'firstName lastName email')
          .populate('cuenta', 'nombre');

        // Contar participantes únicos
        const usuariosUnicos = new Set();
        participantes.forEach(p => {
            if (p.usuario && p.usuario._id) {
                usuariosUnicos.add(p.usuario._id.toString());
            }
        });

        // Participantes por rol
        const participantesPorRol = {};
        participantes.forEach(p => {
            if (!participantesPorRol[p.rol]) {
                participantesPorRol[p.rol] = 0;
            }
            participantesPorRol[p.rol]++;
        });

        res.status(200).json({
            success: true,
            data: {
                resumenGeneral: {
                    totalSaldosIniciales,
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
                participantes: {
                    unicos: usuariosUnicos.size,
                    porRol: participantesPorRol
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
        const { fechaDesde, fechaHasta } = req.query;
        const userId = req.session.userId;

        // Obtener SOLO las cuentas donde el usuario es PROPIETARIO
        const cuentasPropias = await SWCuenta.find({
            propietario: userId,
            activa: true
        });

        const cuentasIds = cuentasPropias.map(c => c._id);

        // Construir filtro de fechas con timezone de México
        let dateFilter = {};
        if (fechaDesde || fechaHasta) {
            dateFilter.fecha = {};
            if (fechaDesde) {
                // Agregar timezone de México (UTC-6)
                dateFilter.fecha.$gte = new Date(fechaDesde + 'T00:00:00-06:00');
            }
            if (fechaHasta) {
                // Agregar timezone de México (UTC-6)
                dateFilter.fecha.$lte = new Date(fechaHasta + 'T23:59:59-06:00');
            }
        }

        // Obtener todas las transacciones de las cuentas propias con filtro de fechas
        const transacciones = await SWTransaccion.find({
            cuenta: { $in: cuentasIds },
            aprobada: true,
            ...dateFilter
        }).populate('cuenta', 'nombre moneda organizacion');

        // Calcular saldos iniciales de las cuentas propias
        let totalSaldosIniciales = 0;
        cuentasPropias.forEach(cuenta => {
            totalSaldosIniciales += cuenta.saldoInicial || 0;
        });

        // Calcular totales personales basados en transacciones filtradas
        let totalIngresos = 0;
        let totalGastos = 0;

        transacciones.forEach(trans => {
            if (trans.tipo === 'Ingreso') {
                totalIngresos += trans.monto;
            } else {
                totalGastos += trans.monto;
            }
        });

        // Saldo total = saldos iniciales + ingresos - gastos
        const saldoTotal = totalSaldosIniciales + totalIngresos - totalGastos;

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
                    totalSaldosIniciales,
                    totalIngresos,
                    totalGastos,
                    saldoTotal,
                    neto: totalSaldosIniciales + totalIngresos - totalGastos,
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
