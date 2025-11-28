const SWCuenta = require('../models/SWCuenta');
const SWOrganizacion = require('../models/SWOrganizacion');
const SWParticipante = require('../models/SWParticipante');
const Usuario = require('../models/Usuario');
const { check, validationResult } = require('express-validator');

// Validadores
const createCuentaValidators = [
    check('nombre')
        .notEmpty().withMessage('El nombre es requerido')
        .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
        .trim(),
    check('organizacion')
        .notEmpty().withMessage('La organización es requerida')
        .isMongoId().withMessage('ID de organización inválido'),
    check('tipoCuenta')
        .optional()
        .isIn(['Bancaria', 'Efectivo', 'Tarjeta', 'Billetera Digital', 'Otra'])
        .withMessage('Tipo de cuenta inválido'),
    check('moneda')
        .optional()
        .isIn(['MXN', 'USD', 'EUR'])
        .withMessage('Moneda inválida'),
    check('saldoInicial')
        .optional()
        .isNumeric().withMessage('El saldo inicial debe ser numérico'),
    check('descripcion')
        .optional()
        .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres')
        .trim(),
    // Datos bancarios opcionales
    check('datosBancarios.beneficiario')
        .optional()
        .trim(),
    check('datosBancarios.banco')
        .optional()
        .trim(),
    check('datosBancarios.clabe')
        .optional()
        .isLength({ max: 18 }).withMessage('La CLABE no puede exceder 18 caracteres')
        .trim(),
    check('datosBancarios.numeroCuenta')
        .optional()
        .trim(),
    check('datosBancarios.referencia')
        .optional()
        .trim()
];

const updateCuentaValidators = [
    check('nombre')
        .optional()
        .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
        .trim(),
    check('descripcion')
        .optional()
        .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres')
        .trim(),
    check('activa')
        .optional()
        .isBoolean().withMessage('El campo activa debe ser booleano'),
    // Datos bancarios opcionales
    check('datosBancarios.beneficiario')
        .optional()
        .trim(),
    check('datosBancarios.banco')
        .optional()
        .trim(),
    check('datosBancarios.clabe')
        .optional()
        .isLength({ max: 18 }).withMessage('La CLABE no puede exceder 18 caracteres')
        .trim(),
    check('datosBancarios.numeroCuenta')
        .optional()
        .trim(),
    check('datosBancarios.referencia')
        .optional()
        .trim()
];

const addParticipanteValidators = [
    check('usuarioId')
        .notEmpty().withMessage('El ID del usuario es requerido')
        .isMongoId().withMessage('ID de usuario inválido'),
    check('permisos')
        .optional()
        .isObject().withMessage('Los permisos deben ser un objeto'),
    check('permisos.puedeVerTransacciones')
        .optional()
        .isBoolean().withMessage('El permiso debe ser booleano'),
    check('permisos.puedeCrearSolicitudes')
        .optional()
        .isBoolean().withMessage('El permiso debe ser booleano'),
    check('permisos.puedeVerSaldo')
        .optional()
        .isBoolean().withMessage('El permiso debe ser booleano')
];

/**
 * Crear una nueva cuenta
 * El propietario será automáticamente el usuario autenticado
 */
const createCuenta = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { 
            nombre, 
            descripcion, 
            tipoCuenta, 
            moneda, 
            saldoInicial, 
            organizacion,
            datosBancarios
        } = req.body;

        // El propietario es el usuario autenticado
        const userId = req.session?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }

        // Verificar que la organización existe y está activa
        const org = await SWOrganizacion.findById(organizacion);
        if (!org || !org.activa) {
            return res.status(400).json({
                success: false,
                message: 'Organización no encontrada o inactiva'
            });
        }

        // Verificar que no exista otra cuenta con el mismo nombre en la misma organización
        const cuentaExistente = await SWCuenta.findOne({
            nombre: nombre.trim(),
            organizacion: organizacion
        });

        if (cuentaExistente) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una cuenta con ese nombre en esta organización'
            });
        }

        const cuenta = new SWCuenta({
            nombre,
            descripcion,
            tipoCuenta: tipoCuenta || 'Bancaria',
            moneda: moneda || 'MXN',
            saldoInicial: saldoInicial || 0,
            saldoActual: saldoInicial || 0,
            organizacion,
            propietario: userId, // Usuario autenticado
            datosBancarios: datosBancarios || {}
        });

        await cuenta.save();

        // Crear el participante propietario automáticamente
        const participantePropietario = new SWParticipante({
            cuenta: cuenta._id,
            usuario: userId,
            rol: 'Propietario',
            permisos: {
                puedeVerTransacciones: true,
                puedeCrearSolicitudes: true,
                puedeVerSaldo: true
            },
            agregadoPor: userId
        });

        await participantePropietario.save();

        res.status(201).json({
            success: true,
            message: 'Cuenta creada exitosamente',
            data: cuenta
        });
    } catch (error) {
        console.error('Error al crear cuenta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la cuenta',
            error: error.message
        });
    }
};

/**
 * Obtener todas las cuentas del usuario autenticado
 */
const getMisCuentas = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { organizacion, activa } = req.query;

        // Obtener cuentas donde es participante
        const participaciones = await SWParticipante.find({
            usuario: userId,
            activo: true
        }).select('cuenta rol permisos');

        const cuentaIds = participaciones.map(p => p.cuenta);

        const filter = { _id: { $in: cuentaIds } };
        if (organizacion) filter.organizacion = organizacion;
        if (activa !== undefined) filter.activa = activa === 'true';

        const cuentas = await SWCuenta.find(filter)
            .populate('organizacion', 'nombre')
            .populate('propietario', 'firstName lastName email')
            .sort({ createdAt: -1 });

        // Agregar rol del usuario en cada cuenta y ocultar saldo si no tiene permiso
        const cuentasConRol = cuentas.map(cuenta => {
            const participacion = participaciones.find(
                p => p.cuenta.toString() === cuenta._id.toString()
            );
            
            const cuentaObj = cuenta.toObject();
            
            // Si es participante (no propietario) y no tiene permiso de ver saldo
            const esPropietario = cuenta.propietario._id.toString() === userId.toString();
            const puedeVerSaldo = participacion?.permisos?.puedeVerSaldo !== false; // Por defecto true
            
            if (!esPropietario && !puedeVerSaldo) {
                // Ocultar saldos
                delete cuentaObj.saldoActual;
                delete cuentaObj.saldoInicial;
            }
            
            return {
                ...cuentaObj,
                miRol: participacion?.rol || 'Desconocido',
                puedeVerSaldo: esPropietario || puedeVerSaldo
            };
        });

        res.status(200).json({
            success: true,
            data: cuentasConRol
        });
    } catch (error) {
        console.error('Error al obtener cuentas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las cuentas',
            error: error.message
        });
    }
};

/**
 * Obtener una cuenta por ID
 */
const getCuentaById = async (req, res) => {
    try {
        const { id } = req.params;

        const cuenta = await SWCuenta.findById(id)
            .populate('organizacion', 'nombre descripcion')
            .populate('propietario', 'firstName lastName email');

        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        // Verificar acceso del usuario
        const userId = req.session.userId;
        const participante = await SWParticipante.findOne({
            cuenta: id,
            usuario: userId,
            activo: true
        });

        if (!participante) {
            return res.status(403).json({
                success: false,
                message: 'No tiene acceso a esta cuenta'
            });
        }

        // Obtener participantes de la cuenta
        const participantes = await SWParticipante.find({ 
            cuenta: id, 
            activo: true 
        }).populate('usuario', 'firstName lastName email');

        // Verificar permiso para ver saldo
        const esPropietario = cuenta.propietario._id.toString() === userId.toString();
        const puedeVerSaldo = esPropietario || (participante.permisos && participante.permisos.puedeVerSaldo);

        const cuentaData = cuenta.toObject();
        
        // Si no tiene permiso para ver saldo, eliminar campos sensibles
        if (!puedeVerSaldo) {
            delete cuentaData.saldoActual;
            delete cuentaData.saldoInicial;
        }

        res.status(200).json({
            success: true,
            data: {
                ...cuentaData,
                participantes,
                miRol: participante.rol,
                puedeVerSaldo
            }
        });
    } catch (error) {
        console.error('Error al obtener cuenta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la cuenta',
            error: error.message
        });
    }
};

/**
 * Actualizar una cuenta (solo propietario)
 */
const updateCuenta = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { id } = req.params;
        const { nombre, descripcion, activa, datosBancarios } = req.body;

        const cuenta = await SWCuenta.findById(id);

        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        if (nombre !== undefined) cuenta.nombre = nombre;
        if (descripcion !== undefined) cuenta.descripcion = descripcion;
        if (activa !== undefined) cuenta.activa = activa;

        // Actualizar datos bancarios si se proporcionan
        if (datosBancarios !== undefined) {
            cuenta.datosBancarios = {
                beneficiario: datosBancarios.beneficiario || cuenta.datosBancarios?.beneficiario || '',
                banco: datosBancarios.banco || cuenta.datosBancarios?.banco || '',
                clabe: datosBancarios.clabe || cuenta.datosBancarios?.clabe || '',
                numeroCuenta: datosBancarios.numeroCuenta || cuenta.datosBancarios?.numeroCuenta || '',
                referencia: datosBancarios.referencia || cuenta.datosBancarios?.referencia || ''
            };
        }

        // NOTA: saldoInicial NO se puede actualizar después de la creación
        // El saldoActual se calcula automáticamente con transacciones

        await cuenta.save();

        res.status(200).json({
            success: true,
            message: 'Cuenta actualizada exitosamente',
            data: cuenta
        });
    } catch (error) {
        console.error('Error al actualizar cuenta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar la cuenta',
            error: error.message
        });
    }
};

/**
 * Agregar participante a una cuenta (solo propietario)
 */
const addParticipante = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { id } = req.params;
        const { usuarioId, rol, permisos } = req.body;
        const propietarioId = req.session.userId;

        // Verificar que la cuenta existe
        const cuenta = await SWCuenta.findById(id);

        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        // Verificar que el usuario que hace la petición es el propietario
        if (cuenta.propietario.toString() !== propietarioId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el propietario puede agregar participantes'
            });
        }

        // Verificar que el usuario a agregar existe
        const usuario = await Usuario.findById(usuarioId);
        if (!usuario) {
            return res.status(400).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Verificar que no sea el mismo propietario
        if (usuarioId === propietarioId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'El propietario ya tiene acceso a la cuenta'
            });
        }

        // Verificar si ya es participante
        const yaParticipa = await SWParticipante.findOne({
            cuenta: id,
            usuario: usuarioId
        });

        if (yaParticipa) {
            if (yaParticipa.activo) {
                return res.status(400).json({
                    success: false,
                    message: 'El usuario ya es participante de esta cuenta'
                });
            } else {
                // Reactivar participante
                yaParticipa.activo = true;
                yaParticipa.agregadoPor = propietarioId;
                if (permisos) yaParticipa.permisos = { ...yaParticipa.permisos, ...permisos };
                await yaParticipa.save();

                return res.status(200).json({
                    success: true,
                    message: 'Participante reactivado exitosamente',
                    data: yaParticipa
                });
            }
        }

        // Crear nuevo participante
        const participante = new SWParticipante({
            cuenta: id,
            usuario: usuarioId,
            rol: rol || 'Participante',
            permisos: permisos || {
                puedeVerTransacciones: true,
                puedeCrearSolicitudes: true,
                puedeVerSaldo: true
            },
            agregadoPor: propietarioId
        });

        await participante.save();

        const participantePopulado = await SWParticipante.findById(participante._id)
            .populate('usuario', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'Participante agregado exitosamente',
            data: participantePopulado
        });
    } catch (error) {
        console.error('Error al agregar participante:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar el participante',
            error: error.message
        });
    }
};

/**
 * Remover participante de una cuenta (solo propietario)
 */
const removeParticipante = async (req, res) => {
    try {
        const { id, usuarioId } = req.params;
        const propietarioId = req.session.userId;

        // Verificar que la cuenta existe
        const cuenta = await SWCuenta.findById(id);

        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        // Verificar que el usuario que hace la petición es el propietario
        if (cuenta.propietario.toString() !== propietarioId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el propietario puede remover participantes'
            });
        }

        // Buscar y eliminar participante
        const participante = await SWParticipante.findOneAndDelete({
            cuenta: id,
            usuario: usuarioId,
            rol: 'Participante' // No permitir remover al propietario
        });

        if (!participante) {
            return res.status(404).json({
                success: false,
                message: 'Participante no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Participante removido exitosamente'
        });
    } catch (error) {
        console.error('Error al remover participante:', error);
        res.status(500).json({
            success: false,
            message: 'Error al remover el participante',
            error: error.message
        });
    }
};

/**
 * Actualizar permisos de un participante (solo propietario)
 */
const updateParticipantePermisos = async (req, res) => {
    try {
        const { id, participanteId } = req.params;
        const { permisos } = req.body;

        if (!permisos || typeof permisos !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Permisos inválidos'
            });
        }

        const participante = await SWParticipante.findById(participanteId);

        if (!participante || participante.cuenta.toString() !== id) {
            return res.status(404).json({
                success: false,
                message: 'Participante no encontrado'
            });
        }

        // No permitir modificar permisos del propietario
        if (participante.rol === 'Propietario') {
            return res.status(400).json({
                success: false,
                message: 'No se pueden modificar los permisos del propietario'
            });
        }

        participante.permisos = { ...participante.permisos, ...permisos };
        await participante.save();

        res.status(200).json({
            success: true,
            message: 'Permisos actualizados exitosamente',
            data: participante
        });
    } catch (error) {
        console.error('Error al actualizar permisos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar los permisos',
            error: error.message
        });
    }
};

/**
 * Obtener participantes de una cuenta
 */
const getParticipantes = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.query;

        const filter = { cuenta: id };
        if (activo !== undefined) {
            filter.activo = activo === 'true';
        }

        const participantes = await SWParticipante.find(filter)
            .populate('usuario', 'firstName lastName email')
            .populate('agregadoPor', 'firstName lastName')
            .sort({ fechaIngreso: -1 });

        res.status(200).json({
            success: true,
            data: participantes
        });
    } catch (error) {
        console.error('Error al obtener participantes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los participantes',
            error: error.message
        });
    }
};

/**
 * Recalcular saldo de una cuenta
 */
const recalcularSaldo = async (req, res) => {
    try {
        const { id } = req.params;

        const cuenta = await SWCuenta.findById(id);

        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        const saldoActualizado = await cuenta.calcularSaldo();
        await cuenta.save();

        res.status(200).json({
            success: true,
            message: 'Saldo recalculado exitosamente',
            data: {
                saldoAnterior: cuenta.saldoActual,
                saldoNuevo: saldoActualizado
            }
        });
    } catch (error) {
        console.error('Error al recalcular saldo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al recalcular el saldo',
            error: error.message
        });
    }
};

/**
 * Obtener cuentas válidas para ligar a habitaciones
 * Solo cuentas con datos bancarios completos (CLABE/No. Cuenta, Beneficiario y Banco)
 */
const getCuentasValidasParaHabitacion = async (req, res) => {
    try {
        const cuentas = await SWCuenta.find({
            activa: true,
            'datosBancarios.beneficiario': { $exists: true, $ne: '' },
            'datosBancarios.banco': { $exists: true, $ne: '' },
            $or: [
                { 'datosBancarios.clabe': { $exists: true, $ne: '' } },
                { 'datosBancarios.numeroCuenta': { $exists: true, $ne: '' } }
            ]
        })
        .select('nombre datosBancarios.clabe datosBancarios.numeroCuenta')
        .sort({ nombre: 1 })
        .lean();

        res.status(200).json({
            success: true,
            data: cuentas
        });
    } catch (error) {
        console.error('Error al obtener cuentas válidas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener cuentas válidas',
            error: error.message
        });
    }
};

module.exports = {
    createCuentaValidators,
    updateCuentaValidators,
    addParticipanteValidators,
    createCuenta,
    getMisCuentas,
    getCuentaById,
    updateCuenta,
    addParticipante,
    removeParticipante,
    updateParticipantePermisos,
    getParticipantes,
    recalcularSaldo,
    getCuentasValidasParaHabitacion
};
