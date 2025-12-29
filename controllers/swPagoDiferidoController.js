const { check, validationResult } = require('express-validator');
const SWPagoDiferido = require('../models/SWPagoDiferido');
const SWCuenta = require('../models/SWCuenta');
const SWTransaccion = require('../models/SWTransaccion');
const SWParticipante = require('../models/SWParticipante');

// Validadores
const createPagoDiferidoValidators = [
    check('cuentaId').isMongoId().withMessage('ID de cuenta inválido'),
    check('montoTotal').isFloat({ min: 0.01 }).withMessage('Monto total debe ser mayor a 0'),
    check('numeroPagos').isInt({ min: 2 }).withMessage('Debe tener al menos 2 pagos'),
    check('concepto').trim().notEmpty().withMessage('El concepto es requerido'),
    check('fechaInicio').isISO8601().withMessage('Fecha de inicio inválida'),
    check('interes').optional().isFloat({ min: 0 }).withMessage('Interés debe ser mayor o igual a 0')
];

/**
 * Crear un pago diferido
 */
const createPagoDiferido = async (req, res) => {
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
            montoTotal,
            numeroPagos,
            concepto,
            descripcion,
            categoria,
            fechaInicio,
            interes
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

        // Verificar permisos
        const esPropietario = cuenta.propietario.toString() === userId;
        const participante = await SWParticipante.findOne({
            cuenta: cuentaId,
            usuario: userId,
            activo: true
        });

        if (!esPropietario && (!participante || !participante.permisos.puedeCrearTransacciones)) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para crear pagos diferidos en esta cuenta'
            });
        }

        // Calcular cuotas
        const tasaInteres = (interes || 0) / 100;
        let montoPorPago;
        
        if (tasaInteres > 0) {
            // Fórmula de anualidad con interés
            montoPorPago = (montoTotal * tasaInteres * Math.pow(1 + tasaInteres, numeroPagos)) / 
                           (Math.pow(1 + tasaInteres, numeroPagos) - 1);
        } else {
            // Sin interés, división simple
            montoPorPago = montoTotal / numeroPagos;
        }

        montoPorPago = Math.round(montoPorPago * 100) / 100; // Redondear a 2 decimales

        // Generar cuotas
        const cuotas = [];
        const fechaBase = new Date(fechaInicio + 'T00:00:00');

        for (let i = 0; i < numeroPagos; i++) {
            const fechaCuota = new Date(fechaBase);
            fechaCuota.setMonth(fechaCuota.getMonth() + i);

            cuotas.push({
                numero: i + 1,
                monto: montoPorPago,
                fechaProgramada: fechaCuota,
                estado: 'Pendiente'
            });
        }

        // Crear el pago diferido
        const pagoDiferido = new SWPagoDiferido({
            cuenta: cuentaId,
            montoTotal,
            numeroPagos,
            montoPorPago,
            concepto,
            descripcion,
            categoria: categoria || 'Otro',
            fechaInicio: new Date(fechaInicio + 'T00:00:00'),
            interes: interes || 0,
            cuotas,
            creadoPor: userId
        });

        await pagoDiferido.save();

        const pagoDiferidoPopulado = await SWPagoDiferido.findById(pagoDiferido._id)
            .populate('cuenta', 'nombre moneda')
            .populate('creadoPor', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Pago diferido creado exitosamente',
            data: pagoDiferidoPopulado
        });
    } catch (error) {
        console.error('Error al crear pago diferido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear el pago diferido',
            error: error.message
        });
    }
};

/**
 * Obtener todos los pagos diferidos
 */
const getAllPagosDiferidos = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { cuentaId, estado } = req.query;

        // Construir filtro
        let filtro = {};

        if (cuentaId) {
            filtro.cuenta = cuentaId;
        } else {
            // Obtener cuentas del usuario
            const cuentasPropias = await SWCuenta.find({ propietario: userId }).select('_id');
            const participaciones = await SWParticipante.find({ usuario: userId, activo: true }).select('cuenta');
            
            const cuentasIds = [
                ...cuentasPropias.map(c => c._id),
                ...participaciones.map(p => p.cuenta)
            ];

            filtro.cuenta = { $in: cuentasIds };
        }

        if (estado) {
            filtro.estado = estado;
        }

        const pagosDiferidos = await SWPagoDiferido.find(filtro)
            .populate('cuenta', 'nombre moneda')
            .populate('creadoPor', 'firstName lastName email')
            .populate('cuotas.transaccion', 'concepto monto fecha')
            .sort({ createdAt: -1 });

        // Agregar información de progreso a cada pago
        const pagosConProgreso = pagosDiferidos.map(pago => {
            const pagoObj = pago.toObject();
            pagoObj.progreso = pago.calcularProgreso();
            return pagoObj;
        });

        res.status(200).json({
            success: true,
            data: pagosConProgreso
        });
    } catch (error) {
        console.error('Error al obtener pagos diferidos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener pagos diferidos',
            error: error.message
        });
    }
};

/**
 * Obtener un pago diferido por ID
 */
const getPagoDiferidoById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const pagoDiferido = await SWPagoDiferido.findById(id)
            .populate('cuenta', 'nombre moneda propietario')
            .populate('creadoPor', 'firstName lastName email')
            .populate('cuotas.transaccion');

        if (!pagoDiferido) {
            return res.status(404).json({
                success: false,
                message: 'Pago diferido no encontrado'
            });
        }

        // Verificar permisos
        const esPropietario = pagoDiferido.cuenta.propietario.toString() === userId;
        const participante = await SWParticipante.findOne({
            cuenta: pagoDiferido.cuenta._id,
            usuario: userId,
            activo: true
        });

        if (!esPropietario && !participante) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para ver este pago diferido'
            });
        }

        const pagoObj = pagoDiferido.toObject();
        pagoObj.progreso = pagoDiferido.calcularProgreso();

        res.status(200).json({
            success: true,
            data: pagoObj
        });
    } catch (error) {
        console.error('Error al obtener pago diferido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener pago diferido',
            error: error.message
        });
    }
};

/**
 * Pagar una cuota
 */
const pagarCuota = async (req, res) => {
    try {
        const { id, cuotaNumero } = req.params;
        const userId = req.session.userId;

        const pagoDiferido = await SWPagoDiferido.findById(id).populate('cuenta');

        if (!pagoDiferido) {
            return res.status(404).json({
                success: false,
                message: 'Pago diferido no encontrado'
            });
        }

        if (pagoDiferido.estado !== 'Activo') {
            return res.status(400).json({
                success: false,
                message: 'Este pago diferido no está activo'
            });
        }

        // Buscar la cuota
        const cuota = pagoDiferido.cuotas.find(c => c.numero === parseInt(cuotaNumero));
        
        if (!cuota) {
            return res.status(404).json({
                success: false,
                message: 'Cuota no encontrada'
            });
        }

        if (cuota.estado === 'Pagada') {
            return res.status(400).json({
                success: false,
                message: 'Esta cuota ya ha sido pagada'
            });
        }

        // Verificar permisos
        const esPropietario = pagoDiferido.cuenta.propietario.toString() === userId;
        const participante = await SWParticipante.findOne({
            cuenta: pagoDiferido.cuenta._id,
            usuario: userId,
            activo: true
        });

        if (!esPropietario && (!participante || !participante.permisos.puedeCrearTransacciones)) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para pagar cuotas en esta cuenta'
            });
        }

        // Crear la transacción de pago
        const transaccion = new SWTransaccion({
            cuenta: pagoDiferido.cuenta._id,
            tipo: 'Gasto',
            monto: cuota.monto,
            concepto: `${pagoDiferido.concepto} - Cuota ${cuota.numero}/${pagoDiferido.numeroPagos}`,
            categoria: pagoDiferido.categoria,
            descripcion: `[Pago Diferido] ${pagoDiferido.descripcion || ''}`,
            fecha: new Date(),
            creadoPor: userId,
            aprobada: true,
            aprobadaPor: userId,
            fechaAprobacion: new Date(),
            esPagoDiferido: true,
            pagoDiferidoId: pagoDiferido._id
        });

        await transaccion.save();

        // Actualizar saldo de la cuenta
        await pagoDiferido.cuenta.calcularSaldo();
        await pagoDiferido.cuenta.save();

        // Actualizar la cuota
        cuota.estado = 'Pagada';
        cuota.fechaPago = new Date();
        cuota.transaccion = transaccion._id;

        // Verificar si todas las cuotas están pagadas
        const todasPagadas = pagoDiferido.cuotas.every(c => c.estado === 'Pagada');
        if (todasPagadas) {
            pagoDiferido.estado = 'Completado';
        }

        await pagoDiferido.save();

        const pagoActualizado = await SWPagoDiferido.findById(id)
            .populate('cuenta', 'nombre moneda')
            .populate('creadoPor', 'firstName lastName email')
            .populate('cuotas.transaccion');

        const pagoObj = pagoActualizado.toObject();
        pagoObj.progreso = pagoActualizado.calcularProgreso();

        res.status(200).json({
            success: true,
            message: 'Cuota pagada exitosamente',
            data: pagoObj
        });
    } catch (error) {
        console.error('Error al pagar cuota:', error);
        res.status(500).json({
            success: false,
            message: 'Error al pagar cuota',
            error: error.message
        });
    }
};

/**
 * Cancelar un pago diferido
 */
const cancelarPagoDiferido = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const pagoDiferido = await SWPagoDiferido.findById(id).populate('cuenta');

        if (!pagoDiferido) {
            return res.status(404).json({
                success: false,
                message: 'Pago diferido no encontrado'
            });
        }

        // Solo el propietario o creador puede cancelar
        const esPropietario = pagoDiferido.cuenta.propietario.toString() === userId;
        const esCreador = pagoDiferido.creadoPor.toString() === userId;

        if (!esPropietario && !esCreador) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para cancelar este pago diferido'
            });
        }

        if (pagoDiferido.estado === 'Completado') {
            return res.status(400).json({
                success: false,
                message: 'No se puede cancelar un pago diferido completado'
            });
        }

        pagoDiferido.estado = 'Cancelado';
        await pagoDiferido.save();

        res.status(200).json({
            success: true,
            message: 'Pago diferido cancelado exitosamente',
            data: pagoDiferido
        });
    } catch (error) {
        console.error('Error al cancelar pago diferido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cancelar pago diferido',
            error: error.message
        });
    }
};

module.exports = {
    createPagoDiferidoValidators,
    createPagoDiferido,
    getAllPagosDiferidos,
    getPagoDiferidoById,
    pagarCuota,
    cancelarPagoDiferido
};
