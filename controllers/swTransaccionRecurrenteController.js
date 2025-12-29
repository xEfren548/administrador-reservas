const { check, validationResult } = require('express-validator');
const SWTransaccionRecurrente = require('../models/SWTransaccionRecurrente');
const SWCuenta = require('../models/SWCuenta');
const SWTransaccion = require('../models/SWTransaccion');
const SWParticipante = require('../models/SWParticipante');

// Validadores para crear transacción recurrente
const createRecurrenteValidators = [
    check('cuentaId').isMongoId().withMessage('ID de cuenta inválido'),
    check('tipo').isIn(['Ingreso', 'Gasto']).withMessage('Tipo debe ser Ingreso o Gasto'),
    check('monto').isFloat({ min: 0.01 }).withMessage('Monto debe ser mayor a 0'),
    check('concepto').trim().notEmpty().withMessage('El concepto es requerido'),
    check('categoria').notEmpty().withMessage('La categoría es requerida'),
    check('frecuencia').isIn(['Diaria', 'Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral', 'Anual']).withMessage('Frecuencia inválida'),
    check('fechaInicio').isISO8601().withMessage('Fecha de inicio inválida')
];

/**
 * Crear una transacción recurrente
 */
const createRecurrente = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const {
            cuentaId,
            tipo,
            monto,
            concepto,
            descripcion,
            categoria,
            frecuencia,
            diaEjecucion,
            fechaInicio,
            fechaFin,
            notificarAntes,
            ejecutarAutomaticamente
        } = req.body;

        const userId = req.session.userId;

        // Verificar que la cuenta existe
        const cuenta = await SWCuenta.findById(cuentaId);
        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        // Verificar permisos (propietario o participante con permisos)
        const esPropietario = cuenta.propietario.toString() === userId;
        const participante = await SWParticipante.findOne({
            cuenta: cuentaId,
            usuario: userId,
            activo: true
        });

        if (!esPropietario && (!participante || !participante.permisos.puedeCrearTransacciones)) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para crear transacciones recurrentes en esta cuenta'
            });
        }

        // Crear la transacción recurrente
        // Normalizar fechas para evitar problemas de zona horaria
        const fechaInicioNormalizada = new Date(fechaInicio + 'T00:00:00');
        const fechaFinNormalizada = fechaFin ? new Date(fechaFin + 'T00:00:00') : null;
        
        const recurrente = new SWTransaccionRecurrente({
            cuenta: cuentaId,
            tipo,
            monto,
            concepto,
            descripcion,
            categoria,
            frecuencia,
            diaEjecucion,
            fechaInicio: fechaInicioNormalizada,
            fechaFin: fechaFinNormalizada,
            proximaEjecucion: fechaInicioNormalizada,
            notificarAntes: notificarAntes || 1,
            ejecutarAutomaticamente: ejecutarAutomaticamente || false,
            creadoPor: userId
        });

        await recurrente.save();

        const recurrentePopulado = await SWTransaccionRecurrente.findById(recurrente._id)
            .populate('cuenta', 'nombre moneda')
            .populate('creadoPor', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Transacción recurrente creada exitosamente',
            data: recurrentePopulado
        });
    } catch (error) {
        console.error('Error al crear transacción recurrente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la transacción recurrente',
            error: error.message
        });
    }
};

/**
 * Obtener todas las transacciones recurrentes
 */
const getAllRecurrentes = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { cuentaId, activa } = req.query;

        // Construir filtro
        let filtro = {};

        // Si se especifica una cuenta
        if (cuentaId) {
            filtro.cuenta = cuentaId;
        } else {
            // Obtener cuentas donde el usuario es propietario o participante
            const cuentasPropias = await SWCuenta.find({ propietario: userId }).select('_id');
            const participaciones = await SWParticipante.find({ usuario: userId, activo: true }).select('cuenta');
            
            const cuentasIds = [
                ...cuentasPropias.map(c => c._id),
                ...participaciones.map(p => p.cuenta)
            ];

            filtro.cuenta = { $in: cuentasIds };
        }

        // Filtrar por estado activo/inactivo
        if (activa !== undefined) {
            filtro.activa = activa === 'true';
        }

        const recurrentes = await SWTransaccionRecurrente.find(filtro)
            .populate('cuenta', 'nombre moneda')
            .populate('creadoPor', 'firstName lastName email')
            .sort({ proximaEjecucion: 1 });

        res.status(200).json({
            success: true,
            data: recurrentes
        });
    } catch (error) {
        console.error('Error al obtener transacciones recurrentes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener transacciones recurrentes',
            error: error.message
        });
    }
};

/**
 * Obtener una transacción recurrente por ID
 */
const getRecurrenteById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const recurrente = await SWTransaccionRecurrente.findById(id)
            .populate('cuenta', 'nombre moneda propietario')
            .populate('creadoPor', 'firstName lastName email')
            .populate({
                path: 'transaccionesGeneradas.transaccion',
                select: 'concepto monto fecha tipo'
            });

        if (!recurrente) {
            return res.status(404).json({
                success: false,
                message: 'Transacción recurrente no encontrada'
            });
        }

        // Verificar permisos
        const esPropietario = recurrente.cuenta.propietario.toString() === userId;
        const participante = await SWParticipante.findOne({
            cuenta: recurrente.cuenta._id,
            usuario: userId,
            activo: true
        });

        if (!esPropietario && !participante) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para ver esta transacción recurrente'
            });
        }

        res.status(200).json({
            success: true,
            data: recurrente
        });
    } catch (error) {
        console.error('Error al obtener transacción recurrente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener transacción recurrente',
            error: error.message
        });
    }
};

/**
 * Actualizar transacción recurrente
 */
const updateRecurrente = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const recurrente = await SWTransaccionRecurrente.findById(id).populate('cuenta');

        if (!recurrente) {
            return res.status(404).json({
                success: false,
                message: 'Transacción recurrente no encontrada'
            });
        }

        // Verificar permisos
        const esPropietario = recurrente.cuenta.propietario.toString() === userId;
        const participante = await SWParticipante.findOne({
            cuenta: recurrente.cuenta._id,
            usuario: userId,
            activo: true
        });

        if (!esPropietario && (!participante || !participante.permisos.puedeEditarTransacciones)) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para editar esta transacción recurrente'
            });
        }

        // Actualizar campos permitidos
        const {
            monto,
            concepto,
            descripcion,
            categoria,
            frecuencia,
            diaEjecucion,
            fechaFin,
            notificarAntes,
            ejecutarAutomaticamente,
            activa
        } = req.body;

        if (monto !== undefined) recurrente.monto = monto;
        if (concepto !== undefined) recurrente.concepto = concepto;
        if (descripcion !== undefined) recurrente.descripcion = descripcion;
        if (categoria !== undefined) recurrente.categoria = categoria;
        if (frecuencia !== undefined) {
            recurrente.frecuencia = frecuencia;
            // Recalcular próxima ejecución si cambia la frecuencia
            recurrente.proximaEjecucion = recurrente.calcularProximaEjecucion();
        }
        if (diaEjecucion !== undefined) recurrente.diaEjecucion = diaEjecucion;
        if (fechaFin !== undefined) recurrente.fechaFin = fechaFin ? new Date(fechaFin + 'T00:00:00') : null;
        if (notificarAntes !== undefined) recurrente.notificarAntes = notificarAntes;
        if (ejecutarAutomaticamente !== undefined) recurrente.ejecutarAutomaticamente = ejecutarAutomaticamente;
        if (activa !== undefined) recurrente.activa = activa;

        await recurrente.save();

        const recurrenteActualizado = await SWTransaccionRecurrente.findById(id)
            .populate('cuenta', 'nombre moneda')
            .populate('creadoPor', 'firstName lastName email');

        res.status(200).json({
            success: true,
            message: 'Transacción recurrente actualizada exitosamente',
            data: recurrenteActualizado
        });
    } catch (error) {
        console.error('Error al actualizar transacción recurrente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar transacción recurrente',
            error: error.message
        });
    }
};

/**
 * Eliminar transacción recurrente
 */
const deleteRecurrente = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const recurrente = await SWTransaccionRecurrente.findById(id).populate('cuenta');

        if (!recurrente) {
            return res.status(404).json({
                success: false,
                message: 'Transacción recurrente no encontrada'
            });
        }

        // Solo el propietario o el creador pueden eliminar
        const esPropietario = recurrente.cuenta.propietario.toString() === userId;
        const esCreador = recurrente.creadoPor.toString() === userId;

        if (!esPropietario && !esCreador) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para eliminar esta transacción recurrente'
            });
        }

        await SWTransaccionRecurrente.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Transacción recurrente eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar transacción recurrente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar transacción recurrente',
            error: error.message
        });
    }
};

/**
 * Ejecutar manualmente una transacción recurrente
 */
const ejecutarManual = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const recurrente = await SWTransaccionRecurrente.findById(id).populate('cuenta');

        if (!recurrente) {
            return res.status(404).json({
                success: false,
                message: 'Transacción recurrente no encontrada'
            });
        }

        // Verificar permisos
        const esPropietario = recurrente.cuenta.propietario.toString() === userId;
        const participante = await SWParticipante.findOne({
            cuenta: recurrente.cuenta._id,
            usuario: userId,
            activo: true
        });

        if (!esPropietario && (!participante || !participante.permisos.puedeCrearTransacciones)) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para ejecutar esta transacción recurrente'
            });
        }

        // Crear la transacción
        const nuevaTransaccion = new SWTransaccion({
            cuenta: recurrente.cuenta._id,
            tipo: recurrente.tipo,
            monto: recurrente.monto,
            concepto: recurrente.concepto,
            categoria: recurrente.categoria,
            descripcion: `[Recurrente] ${recurrente.descripcion || ''}`,
            fecha: new Date(),
            creadoPor: userId,
            aprobada: true,
            aprobadaPor: userId,
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
        await recurrente.save();

        const transaccionPopulada = await SWTransaccion.findById(nuevaTransaccion._id)
            .populate('cuenta', 'nombre moneda')
            .populate('creadoPor', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Transacción ejecutada exitosamente',
            data: {
                transaccion: transaccionPopulada,
                proximaEjecucion: recurrente.proximaEjecucion
            }
        });
    } catch (error) {
        console.error('Error al ejecutar transacción recurrente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al ejecutar transacción recurrente',
            error: error.message
        });
    }
};

module.exports = {
    createRecurrenteValidators,
    createRecurrente,
    getAllRecurrentes,
    getRecurrenteById,
    updateRecurrente,
    deleteRecurrente,
    ejecutarManual
};
