const { check } = require('express-validator');
const { Parser } = require('json2csv');
const moment = require('moment');
const Cupon = require('../models/Cupon');
const CuponUsage = require('../models/CuponUsage');
const CuentaReferido = require('../models/CuentaReferido');
const Habitacion = require('../models/Habitacion');
const Roles = require('../models/Roles');

// ============= VALIDADORES =============

const crearCuponValidators = [
    check('nombre')
        .notEmpty().withMessage('El nombre del cupón es requerido')
        .isLength({ max: 100 }).withMessage('El nombre no puede exceder 100 caracteres')
        .trim(),
    check('codigo')
        .notEmpty().withMessage('El código del cupón es requerido')
        .isLength({ max: 50 }).withMessage('El código no puede exceder 50 caracteres')
        .trim()
        .custom(async (value) => {
            const codigoUpper = value.toUpperCase();
            const cuponExistente = await Cupon.findOne({ codigo: codigoUpper });
            if (cuponExistente) {
                throw new Error('El código de cupón ya existe');
            }
            return true;
        }),
    check('tipo')
        .notEmpty().withMessage('El tipo de cupón es requerido')
        .isIn(['percentage', 'fixed_amount', 'nights_free'])
        .withMessage('El tipo debe ser percentage, fixed_amount o nights_free'),
    check('valor')
        .notEmpty().withMessage('El valor del cupón es requerido')
        .isFloat({ min: 0 }).withMessage('El valor no puede ser negativo'),
    check('aplicableA')
        .notEmpty().withMessage('Debe especificar a quién aplica')
        .isIn(['all', 'owner_only', 'except_owner', 'virtual_seller'])
        .withMessage('aplicableA debe ser all, owner_only, except_owner o virtual_seller'),
    check('fechaInicio')
        .notEmpty().withMessage('La fecha de inicio es requerida')
        .isISO8601().withMessage('Fecha de inicio inválida'),
    check('fechaFin')
        .notEmpty().withMessage('La fecha de fin es requerida')
        .isISO8601().withMessage('Fecha de fin inválida'),
    check('usosLimitados')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 }).withMessage('Los usos limitados deben ser al menos 1'),
    check('montoMinimoCompra')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 }).withMessage('El monto mínimo no puede ser negativo'),
    check('descuentoMaximo')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 }).withMessage('El descuento máximo no puede ser negativo'),
    check('todasCabanas')
        .optional()
        .isBoolean().withMessage('todasCabanas debe ser booleano'),
    check('esCuponWeb')
        .optional()
        .isBoolean().withMessage('esCuponWeb debe ser booleano'),
    check('habitaciones')
        .optional()
        .isArray().withMessage('habitaciones debe ser un array'),
    check('habitaciones.*')
        .optional()
        .isMongoId().withMessage('ID de habitación inválido'),
    check('restricciones.nochesMinimas')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 }).withMessage('Las noches mínimas deben ser al menos 1'),
    check('restricciones.nochesMaximas')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 }).withMessage('Las noches máximas deben ser al menos 1'),
    check('descripcion')
        .optional({ checkFalsy: true })
        .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres')
        .trim()
];

const editarCuponValidators = [
    check('id')
        .notEmpty().withMessage('El ID del cupón es requerido')
        .isMongoId().withMessage('ID de cupón inválido'),
    check('nombre')
        .optional()
        .isLength({ max: 100 }).withMessage('El nombre no puede exceder 100 caracteres')
        .trim(),
    check('tipo')
        .optional()
        .isIn(['percentage', 'fixed_amount', 'nights_free'])
        .withMessage('El tipo debe ser percentage, fixed_amount o nights_free'),
    check('valor')
        .optional()
        .isFloat({ min: 0 }).withMessage('El valor no puede ser negativo'),
    check('aplicableA')
        .optional()
        .isIn(['all', 'owner_only', 'except_owner', 'virtual_seller'])
        .withMessage('aplicableA debe ser all, owner_only, except_owner o virtual_seller'),
    check('fechaInicio')
        .optional()
        .isISO8601().withMessage('Fecha de inicio inválida'),
    check('fechaFin')
        .optional()
        .isISO8601().withMessage('Fecha de fin inválida'),
    check('usosLimitados')
        .optional({ checkFalsy: true })
        .isInt({ min: 1 }).withMessage('Los usos limitados deben ser al menos 1'),
    check('montoMinimoCompra')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 }).withMessage('El monto mínimo no puede ser negativo'),
    check('descuentoMaximo')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 }).withMessage('El descuento máximo no puede ser negativo'),
    check('todasCabanas')
        .optional()
        .isBoolean().withMessage('todasCabanas debe ser booleano'),
    check('esCuponWeb')
        .optional()
        .isBoolean().withMessage('esCuponWeb debe ser booleano'),
    check('habitaciones')
        .optional()
        .isArray().withMessage('habitaciones debe ser un array'),
    check('habitaciones.*')
        .optional()
        .isMongoId().withMessage('ID de habitación inválido'),
    check('descripcion')
        .optional({ checkFalsy: true })
        .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres')
        .trim()
];

const eliminarCuponValidators = [
    check('id')
        .notEmpty().withMessage('El ID del cupón es requerido')
        .isMongoId().withMessage('ID de cupón inválido')
];

const validarCuponValidators = [
    check('codigo')
        .notEmpty().withMessage('El código del cupón es requerido')
        .trim(),
    check('source')
        .notEmpty().withMessage('El origen de validación es requerido (source)')
        .isIn(['web', 'internal']).withMessage('source debe ser web o internal'),
    check('montoReserva')
        .optional()
        .isFloat({ min: 0 }).withMessage('El monto de reserva debe ser mayor a 0'),
    check('habitacionId')
        .optional()
        .isMongoId().withMessage('ID de habitación inválido'),
    check('noches')
        .optional()
        .isInt({ min: 1 }).withMessage('Las noches deben ser al menos 1')
];

// ============= CONTROLADORES =============

/**
 * Crear un nuevo cupón
 */
const crearCupon = async (req, res) => {
    try {
        const userRole = req.session.role;
        const userId = req.session.userId;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('CREATE_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para crear cupones'
            });
        }

        const {
            nombre,
            codigo,
            tipo,
            valor,
            aplicableA,
            montoMinimoCompra,
            descuentoMaximo,
            usosLimitados,
            fechaInicio,
            fechaFin,
            todasCabanas,
            habitaciones,
            restricciones,
            descripcion,
            nochesRecibidas,
            nochesPagadas,
            esCuponWeb
        } = req.body;

        const esCuponWebFinal = esCuponWeb === true || esCuponWeb === 'true';
        const aplicableAFinal = esCuponWebFinal ? 'virtual_seller' : aplicableA;

        // Validar que si no son todas las cabañas, se especifiquen habitaciones
        if (!todasCabanas && (!habitaciones || habitaciones.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Debe especificar al menos una habitación si no aplica a todas las cabañas'
            });
        }

        // Validar campos específicos para nights_free
        if (tipo === 'nights_free') {
            if (!nochesRecibidas || !nochesPagadas) {
                return res.status(400).json({
                    success: false,
                    message: 'Para cupones de noches gratis debe especificar noches recibidas y noches pagadas'
                });
            }
            if (nochesPagadas >= nochesRecibidas) {
                return res.status(400).json({
                    success: false,
                    message: 'Las noches pagadas deben ser menores a las noches recibidas'
                });
            }
        }

        // Crear cupón
        const nuevoCupon = new Cupon({
            nombre,
            codigo: codigo.toUpperCase(),
            tipo,
            valor: tipo === 'nights_free' ? 0 : valor,
            aplicableA: aplicableAFinal,
            montoMinimoCompra,
            descuentoMaximo,
            usosLimitados,
            fechaInicio: moment.utc(fechaInicio).startOf('day').toDate(),
            fechaFin: moment.utc(fechaFin).endOf('day').toDate(),
            todasCabanas: todasCabanas !== false,
            habitaciones: todasCabanas ? [] : habitaciones,
            restricciones: restricciones || {},
            descripcion,
            nochesRecibidas: tipo === 'nights_free' ? nochesRecibidas : null,
            nochesPagadas: tipo === 'nights_free' ? nochesPagadas : null,
            esCuponWeb: esCuponWebFinal,
            creadoPor: userId
        });

        await nuevoCupon.save();

        res.status(201).json({
            success: true,
            message: 'Cupón creado exitosamente',
            data: nuevoCupon
        });

    } catch (error) {
        console.error('Error al crear cupón:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear cupón',
            error: error.message
        });
    }
};

/**
 * Listar cupones con filtros y paginación
 */
const listarCupones = async (req, res) => {
    try {
        const userRole = req.session.role;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('VIEW_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para ver cupones'
            });
        }

        const {
            page = 1,
            limit = 20,
            activo,
            tipo,
            buscar,
            fechaInicio,
            fechaFin,
            vigente
        } = req.query;

        // Construir filtro
        const filtro = {};

        if (activo !== undefined) {
            filtro.activo = activo === 'true';
        }

        if (tipo) {
            filtro.tipo = tipo;
        }

        if (buscar) {
            filtro.$or = [
                { nombre: { $regex: buscar, $options: 'i' } },
                { codigo: { $regex: buscar.toUpperCase(), $options: 'i' } }
            ];
        }

        if (fechaInicio || fechaFin) {
            filtro.fechaInicio = {};
            if (fechaInicio) filtro.fechaInicio.$gte = new Date(fechaInicio);
            if (fechaFin) filtro.fechaInicio.$lte = new Date(fechaFin);
        }

        if (vigente === 'true') {
            const ahora = new Date();
            filtro.activo = true;
            filtro.fechaInicio = { $lte: ahora };
            filtro.fechaFin = { $gte: ahora };
        }

        // Ejecutar consulta con paginación
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [cupones, total] = await Promise.all([
            Cupon.find(filtro)
                .populate('habitaciones', 'name')
                .populate('creadoPor', 'firstName lastName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Cupon.countDocuments(filtro)
        ]);

        res.json({
            success: true,
            data: cupones,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error al listar cupones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar cupones',
            error: error.message
        });
    }
};

/**
 * Obtener un cupón por ID
 */
const obtenerCupon = async (req, res) => {
    try {
        const userRole = req.session.role;
        const { id } = req.params;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('VIEW_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para ver cupones'
            });
        }

        const cupon = await Cupon.findById(id)
            .populate('habitaciones', 'name images')
            .populate('creadoPor', 'firstName lastName');

        if (!cupon) {
            return res.status(404).json({
                success: false,
                message: 'Cupón no encontrado'
            });
        }

        // Obtener estadísticas de uso
        const usos = await CuponUsage.find({ cupon: id })
            .populate('cliente', 'firstName lastName')
            .populate('clienteWeb', 'firstName lastName email')
            .sort({ fechaUso: -1 });

        const totalDescuentos = usos.reduce((sum, uso) => sum + uso.montoDescuento, 0);

        res.json({
            success: true,
            data: {
                cupon,
                estadisticas: {
                    usosActuales: cupon.usosActuales,
                    usosLimitados: cupon.usosLimitados,
                    totalDescuentos,
                    ultimosUsos: usos.slice(0, 10)
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener cupón:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener cupón',
            error: error.message
        });
    }
};

/**
 * Editar un cupón existente
 */
const editarCupon = async (req, res) => {
    try {
        const userRole = req.session.role;
        const { id } = req.body;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('EDIT_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para editar cupones'
            });
        }

        const cupon = await Cupon.findById(id);
        
        if (!cupon) {
            return res.status(404).json({
                success: false,
                message: 'Cupón no encontrado'
            });
        }

        // Campos permitidos para editar
        const camposPermitidos = [
            'nombre',
            'tipo',
            'valor',
            'aplicableA',
            'montoMinimoCompra',
            'descuentoMaximo',
            'usosLimitados',
            'fechaInicio',
            'fechaFin',
            'todasCabanas',
            'habitaciones',
            'restricciones',
            'descripcion',
            'nochesRecibidas',
            'nochesPagadas',
            'esCuponWeb'
        ];

        // Actualizar solo los campos enviados
        camposPermitidos.forEach(campo => {
            if (req.body[campo] !== undefined) {
                if (campo === 'fechaInicio') {
                    cupon[campo] = moment.utc(req.body[campo]).startOf('day').toDate();
                } else if (campo === 'fechaFin') {
                    cupon[campo] = moment.utc(req.body[campo]).endOf('day').toDate();
                } else {
                    cupon[campo] = req.body[campo];
                }
            }
        });

        if (cupon.esCuponWeb) {
            cupon.aplicableA = 'virtual_seller';
        } else if (cupon.aplicableA === 'virtual_seller') {
            cupon.aplicableA = 'all';
        }

        // Validar campos específicos para nights_free
        if (cupon.tipo === 'nights_free') {
            if (!cupon.nochesRecibidas || !cupon.nochesPagadas) {
                return res.status(400).json({
                    success: false,
                    message: 'Para cupones de noches gratis debe especificar noches recibidas y noches pagadas'
                });
            }
            if (cupon.nochesPagadas >= cupon.nochesRecibidas) {
                return res.status(400).json({
                    success: false,
                    message: 'Las noches pagadas deben ser menores a las noches recibidas'
                });
            }
        }

        // Validar que si no son todas las cabañas, se especifiquen habitaciones
        if (!cupon.todasCabanas && (!cupon.habitaciones || cupon.habitaciones.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Debe especificar al menos una habitación si no aplica a todas las cabañas'
            });
        }

        await cupon.save();

        res.json({
            success: true,
            message: 'Cupón actualizado exitosamente',
            data: cupon
        });

    } catch (error) {
        console.error('Error al editar cupón:', error);
        res.status(500).json({
            success: false,
            message: 'Error al editar cupón',
            error: error.message
        });
    }
};

/**
 * Activar o desactivar un cupón
 */
const toggleActivoCupon = async (req, res) => {
    try {
        const userRole = req.session.role;
        const { id } = req.params;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('EDIT_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para modificar cupones'
            });
        }

        const cupon = await Cupon.findById(id);
        
        if (!cupon) {
            return res.status(404).json({
                success: false,
                message: 'Cupón no encontrado'
            });
        }

        cupon.activo = !cupon.activo;
        await cupon.save();

        res.json({
            success: true,
            message: `Cupón ${cupon.activo ? 'activado' : 'desactivado'} exitosamente`,
            data: { activo: cupon.activo }
        });

    } catch (error) {
        console.error('Error al cambiar estado del cupón:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado del cupón',
            error: error.message
        });
    }
};

/**
 * Eliminar un cupón (soft delete)
 */
const eliminarCupon = async (req, res) => {
    try {
        const userRole = req.session.role;
        const { id } = req.body;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('DELETE_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para eliminar cupones'
            });
        }

        const cupon = await Cupon.findById(id);
        
        if (!cupon) {
            return res.status(404).json({
                success: false,
                message: 'Cupón no encontrado'
            });
        }

        // Solo desactivar en lugar de eliminar
        cupon.activo = false;
        await cupon.save();

        res.json({
            success: true,
            message: 'Cupón desactivado exitosamente',
            data: cupon
        });

    } catch (error) {
        console.error('Error al eliminar cupón:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar cupón',
            error: error.message
        });
    }
};

/**
 * Validar un cupón para aplicarlo a una reserva
 */
const validarCupon = async (req, res) => {
    try {
        const { codigo, source, montoReserva, habitacionId, noches, clienteId, clienteWebId, totalSinComisiones, costoBase } = req.body;

        const cupon = await Cupon.findOne({ codigo: codigo.toUpperCase() });

        if (!cupon) {
            return res.status(404).json({
                success: false,
                message: 'Cupón no encontrado'
            });
        }

        // Validar canal de uso (web vs interno)
        if (cupon.esCuponWeb && source !== 'web') {
            return res.status(400).json({
                success: false,
                message: 'Este cupón solo es válido para reservas web'
            });
        }

        if (!cupon.esCuponWeb && source !== 'internal') {
            return res.status(400).json({
                success: false,
                message: 'Este cupón solo es válido para reservas internas'
            });
        }

        // Verificar si está activo
        if (!cupon.activo) {
            return res.status(400).json({
                success: false,
                message: 'Este cupón está desactivado'
            });
        }

        // Verificar vigencia
        const ahora = new Date();
        if (ahora < cupon.fechaInicio || ahora > cupon.fechaFin) {
            return res.status(400).json({
                success: false,
                message: 'Este cupón no está vigente'
            });
        }

        // Verificar usos disponibles
        if (!cupon.tieneUsosDisponibles()) {
            return res.status(400).json({
                success: false,
                message: 'Este cupón ya no tiene usos disponibles'
            });
        }

        // Verificar monto mínimo
        if (montoReserva && cupon.montoMinimoCompra > 0 && montoReserva < cupon.montoMinimoCompra) {
            return res.status(400).json({
                success: false,
                message: `El monto mínimo de compra es $${cupon.montoMinimoCompra}`
            });
        }

        // Verificar habitación aplicable
        if (!cupon.todasCabanas && habitacionId) {
            if (!cupon.habitaciones.includes(habitacionId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Este cupón no aplica para la habitación seleccionada'
                });
            }
        }

        // Verificar noches mínimas/máximas
        if (noches && cupon.restricciones.nochesMinimas && noches < cupon.restricciones.nochesMinimas) {
            return res.status(400).json({
                success: false,
                message: `Este cupón requiere al menos ${cupon.restricciones.nochesMinimas} noches`
            });
        }

        if (noches && cupon.restricciones.nochesMaximas && noches > cupon.restricciones.nochesMaximas) {
            return res.status(400).json({
                success: false,
                message: `Este cupón aplica máximo para ${cupon.restricciones.nochesMaximas} noches`
            });
        }

        // Verificar solo nuevos clientes
        if (cupon.restricciones.soloNuevosClientes) {
            if (clienteId || clienteWebId) {
                const usoPrevio = await CuponUsage.findOne({
                    $or: [
                        { cliente: clienteId },
                        { clienteWeb: clienteWebId }
                    ]
                });

                if (usoPrevio) {
                    return res.status(400).json({
                        success: false,
                        message: 'Este cupón solo aplica para clientes nuevos'
                    });
                }
            }
        }

        // Calcular descuento total
        let descuentoCalculado = 0;
        
        if (montoReserva) {
            if (cupon.tipo === 'percentage') {
                descuentoCalculado = (montoReserva * cupon.valor) / 100;
            } else if (cupon.tipo === 'fixed_amount') {
                descuentoCalculado = cupon.valor;
            } else if (cupon.tipo === 'nights_free') {
                // Para cupones de noches gratis (ej: 3x2)
                // nochesRecibidas = 3 (noches que recibe el cliente)
                // nochesPagadas = 2 (noches que paga)
                // Noches gratis = 1 (3 - 2)
                
                if (noches && cupon.nochesRecibidas && cupon.nochesPagadas) {
                    const nochesGratis = cupon.nochesRecibidas - cupon.nochesPagadas;
                    
                    // Verificar que la reserva tenga al menos las noches requeridas
                    if (noches >= cupon.nochesRecibidas) {
                        // Para calcular correctamente el descuento de noches gratis,
                        // necesitamos trabajar con el precio base (totalSinComisiones)
                        const baseParaCalculo = totalSinComisiones || montoReserva;
                        const precioPorNoche = baseParaCalculo / noches;
                        
                        // El descuento es el precio de las noches gratis
                        // Esto se aplicará sobre el TOTAL (incluidas comisiones)
                        // La distribución según aplicableA determinará cómo se reparte
                        const descuentoBase = precioPorNoche * nochesGratis;
                        
                        // Si tenemos las comisiones, calcular el descuento proporcional total
                        if (totalSinComisiones && montoReserva) {
                            const proporcionTotal = montoReserva / totalSinComisiones;
                            descuentoCalculado = descuentoBase * proporcionTotal;
                        } else {
                            descuentoCalculado = descuentoBase;
                        }
                        
                        console.log("========== CÁLCULO NOCHES GRATIS ==========");
                        console.log("Noches reservadas:", noches);
                        console.log("Noches recibidas:", cupon.nochesRecibidas);
                        console.log("Noches pagadas:", cupon.nochesPagadas);
                        console.log("Noches gratis:", nochesGratis);
                        console.log("Precio por noche (base):", precioPorNoche.toFixed(2));
                        console.log("Total sin comisiones:", totalSinComisiones);
                        console.log("Monto total reserva:", montoReserva);
                        console.log("Descuento calculado:", descuentoCalculado.toFixed(2));
                        console.log("===========================================");
                    } else {
                        // No cumple con las noches mínimas para el cupón
                        return res.status(400).json({
                            success: false,
                            message: `Este cupón requiere al menos ${cupon.nochesRecibidas} noches (promoción ${cupon.nochesRecibidas}x${cupon.nochesPagadas})`
                        });
                    }
                }
            }

            // Aplicar descuento máximo si existe
            if (cupon.descuentoMaximo && descuentoCalculado > cupon.descuentoMaximo) {
                descuentoCalculado = cupon.descuentoMaximo;
            }

            // No puede ser mayor al monto
            if (descuentoCalculado > montoReserva) {
                descuentoCalculado = montoReserva;
            }
        }

        // Calcular distribución del descuento según aplicableA
        // NOTA: La distribución real se hará en el backend al crear utilidades
        // Aquí solo marcamos cómo se debe aplicar
        let descuentoOwner = 0;
        let descuentoUsuarios = 0;
        let referido = null;

        if (descuentoCalculado > 0) {
            if (cupon.aplicableA === 'owner_only') {
                // Todo el descuento lo absorbe el owner (costo base)
                descuentoOwner = descuentoCalculado;
                descuentoUsuarios = 0;
            } else if (cupon.aplicableA === 'except_owner') {
                // Todo el descuento lo absorben los usuarios (comisiones)
                descuentoOwner = 0;
                descuentoUsuarios = descuentoCalculado;
            } else if (cupon.aplicableA === 'virtual_seller') {
                // Cupón web: el descuento lo absorbe el vendedor virtual
                descuentoOwner = 0;
                descuentoUsuarios = descuentoCalculado;
            } else if (cupon.aplicableA === 'all') {
                // El descuento se distribuye proporcionalmente
                // La proporción exacta se calculará en el backend con los datos reales
                // Aquí marcamos que se distribuye entre ambos
                descuentoOwner = descuentoCalculado * 0.5; // Placeholder
                descuentoUsuarios = descuentoCalculado * 0.5; // Placeholder
            }
        }

        if (cupon.esReferido && cupon.cuentaReferido) {
            const cuentaReferido = await CuentaReferido.findById(cupon.cuentaReferido)
                .select('nombre comisionReferidor')
                .lean();

            if (cuentaReferido?.comisionReferidor) {
                const baseComision = Number(montoReserva) || 0;
                let comisionEstimada = 0;

                if (cuentaReferido.comisionReferidor.tipo === 'percentage') {
                    comisionEstimada = (baseComision * (Number(cuentaReferido.comisionReferidor.valor) || 0)) / 100;
                } else {
                    comisionEstimada = Number(cuentaReferido.comisionReferidor.valor) || 0;
                }

                referido = {
                    esReferido: true,
                    cuentaReferidoId: cuentaReferido._id,
                    cuentaReferidoNombre: cuentaReferido.nombre,
                    tipoComision: cuentaReferido.comisionReferidor.tipo,
                    valorComision: cuentaReferido.comisionReferidor.valor,
                    comisionEstimada
                };
            }
        }

        res.json({
            success: true,
            message: 'Cupón válido',
            data: {
                cupon: {
                    id: cupon._id,
                    codigo: cupon.codigo,
                    nombre: cupon.nombre,
                    tipo: cupon.tipo,
                    valor: cupon.valor,
                    nochesRecibidas: cupon.nochesRecibidas,
                    nochesPagadas: cupon.nochesPagadas,
                    aplicableA: cupon.aplicableA,
                    descripcion: cupon.descripcion,
                    esCuponWeb: !!cupon.esCuponWeb
                },
                descuento: descuentoCalculado,
                descuentoOwner: descuentoOwner,
                descuentoUsuarios: descuentoUsuarios,
                montoFinal: montoReserva ? montoReserva - descuentoCalculado : null,
                referido
            }
        });

    } catch (error) {
        console.error('Error al validar cupón:', error);
        res.status(500).json({
            success: false,
            message: 'Error al validar cupón',
            error: error.message
        });
    }
};

/**
 * Obtener estadísticas de un cupón específico
 */
const obtenerEstadisticasCupon = async (req, res) => {
    try {
        const userRole = req.session.role;
        const { id } = req.params;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('VIEW_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para ver estadísticas de cupones'
            });
        }

        const cupon = await Cupon.findById(id);
        
        if (!cupon) {
            return res.status(404).json({
                success: false,
                message: 'Cupón no encontrado'
            });
        }

        // Obtener todos los usos
        const usos = await CuponUsage.find({ cupon: id })
            .populate('cliente', 'firstName lastName email')
            .populate('clienteWeb', 'firstName lastName email')
            .populate('reserva', 'checkIn checkOut')
            .populate('habitacion', 'name')
            .sort({ fechaUso: -1 });

        // Calcular estadísticas
        const totalDescuentos = usos.reduce((sum, uso) => sum + uso.montoDescuento, 0);
        const promedioDescuento = usos.length > 0 ? totalDescuentos / usos.length : 0;

        // Usos por mes
        const usosPorMes = {};
        usos.forEach(uso => {
            const mes = new Date(uso.fechaUso).toISOString().slice(0, 7); // YYYY-MM
            if (!usosPorMes[mes]) {
                usosPorMes[mes] = { count: 0, total: 0 };
            }
            usosPorMes[mes].count++;
            usosPorMes[mes].total += uso.montoDescuento;
        });

        res.json({
            success: true,
            data: {
                cupon: {
                    codigo: cupon.codigo,
                    nombre: cupon.nombre,
                    tipo: cupon.tipo,
                    valor: cupon.valor,
                    activo: cupon.activo
                },
                estadisticas: {
                    usosActuales: cupon.usosActuales,
                    usosLimitados: cupon.usosLimitados,
                    usosDisponibles: cupon.usosLimitados ? cupon.usosLimitados - cupon.usosActuales : 'Ilimitado',
                    totalDescuentos,
                    promedioDescuento: promedioDescuento.toFixed(2),
                    usosPorMes
                },
                usos
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
 * Exportar cupones a CSV
 */
const exportarCuponesCSV = async (req, res) => {
    try {
        const userRole = req.session.role;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('EXPORT_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para exportar cupones'
            });
        }

        const { activo, tipo, fechaInicio, fechaFin } = req.query;

        // Construir filtro
        const filtro = {};
        if (activo !== undefined) filtro.activo = activo === 'true';
        if (tipo) filtro.tipo = tipo;
        if (fechaInicio || fechaFin) {
            filtro.fechaInicio = {};
            if (fechaInicio) filtro.fechaInicio.$gte = new Date(fechaInicio);
            if (fechaFin) filtro.fechaInicio.$lte = new Date(fechaFin);
        }

        const cupones = await Cupon.find(filtro)
            .populate('creadoPor', 'firstName lastName')
            .sort({ createdAt: -1 });

        // Obtener estadísticas de uso para cada cupón
        const cuponesConStats = await Promise.all(
            cupones.map(async (cupon) => {
                const usos = await CuponUsage.find({ cupon: cupon._id });
                const totalDescuentos = usos.reduce((sum, uso) => sum + uso.montoDescuento, 0);

                return {
                    Código: cupon.codigo,
                    Nombre: cupon.nombre,
                    Tipo: cupon.tipo === 'percentage' ? 'Porcentaje' : cupon.tipo === 'fixed_amount' ? 'Monto Fijo' : 'Noches Gratis',
                    Valor: cupon.valor,
                    'Es Cupón Web': cupon.esCuponWeb ? 'Sí' : 'No',
                    'Aplica A': cupon.aplicableA === 'all'
                        ? 'Todos'
                        : cupon.aplicableA === 'owner_only'
                            ? 'Solo Dueño'
                            : cupon.aplicableA === 'except_owner'
                                ? 'Excepto Dueño'
                                : 'Vendedor Virtual',
                    'Usos Actuales': cupon.usosActuales,
                    'Usos Limitados': cupon.usosLimitados || 'Ilimitado',
                    'Total Descuentos': totalDescuentos.toFixed(2),
                    'Fecha Inicio': new Date(cupon.fechaInicio).toLocaleDateString('es-MX'),
                    'Fecha Fin': new Date(cupon.fechaFin).toLocaleDateString('es-MX'),
                    Activo: cupon.activo ? 'Sí' : 'No',
                    'Creado Por': cupon.creadoPor ? `${cupon.creadoPor.firstName} ${cupon.creadoPor.lastName}` : 'N/A',
                    'Fecha Creación': new Date(cupon.createdAt).toLocaleDateString('es-MX')
                };
            })
        );

        const parser = new Parser({
            fields: ['Código', 'Nombre', 'Tipo', 'Valor', 'Es Cupón Web', 'Aplica A', 'Usos Actuales', 'Usos Limitados', 'Total Descuentos', 'Fecha Inicio', 'Fecha Fin', 'Activo', 'Creado Por', 'Fecha Creación']
        });

        const csv = parser.parse(cuponesConStats);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=cupones-${Date.now()}.csv`);
        res.status(200).send('\uFEFF' + csv); // BOM para UTF-8

    } catch (error) {
        console.error('Error al exportar cupones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al exportar cupones',
            error: error.message
        });
    }
};

/**
 * Exportar usos de cupones a CSV
 */
const exportarUsosCuponesCSV = async (req, res) => {
    try {
        const userRole = req.session.role;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('EXPORT_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para exportar usos de cupones'
            });
        }

        const { cuponId, fechaInicio, fechaFin } = req.query;

        // Construir filtro
        const filtro = {};
        if (cuponId) filtro.cupon = cuponId;
        if (fechaInicio || fechaFin) {
            filtro.fechaUso = {};
            if (fechaInicio) filtro.fechaUso.$gte = new Date(fechaInicio);
            if (fechaFin) filtro.fechaUso.$lte = new Date(fechaFin);
        }

        const usos = await CuponUsage.find(filtro)
            .populate('cupon', 'codigo nombre')
            .populate('cliente', 'firstName lastName email')
            .populate('clienteWeb', 'firstName lastName email')
            .populate('reserva', 'checkIn checkOut')
            .populate('habitacion', 'name')
            .sort({ fechaUso: -1 });

        const usosFormateados = usos.map(uso => ({
            'Código Cupón': uso.cupon.codigo,
            'Nombre Cupón': uso.cupon.nombre,
            'Cliente': uso.clienteWeb 
                ? `${uso.clienteWeb.firstName} ${uso.clienteWeb.lastName}` 
                : uso.cliente 
                    ? `${uso.cliente.firstName} ${uso.cliente.lastName}` 
                    : 'N/A',
            'Email': uso.clienteWeb?.email || uso.cliente?.email || 'N/A',
            'Habitación': uso.habitacion?.name || 'N/A',
            'Check-in': uso.reserva?.checkIn ? new Date(uso.reserva.checkIn).toLocaleDateString('es-MX') : 'N/A',
            'Check-out': uso.reserva?.checkOut ? new Date(uso.reserva.checkOut).toLocaleDateString('es-MX') : 'N/A',
            'Noches': uso.noches || 'N/A',
            'Tipo Cupón': uso.tipoCupon === 'percentage' ? 'Porcentaje' : uso.tipoCupon === 'fixed_amount' ? 'Monto Fijo' : 'Noches Gratis',
            'Valor Aplicado': uso.valorAplicado,
            'Monto Original': uso.montoOriginal.toFixed(2),
            'Descuento': uso.montoDescuento.toFixed(2),
            'Monto Final': uso.montoFinal.toFixed(2),
            'Fecha Uso': new Date(uso.fechaUso).toLocaleDateString('es-MX')
        }));

        const parser = new Parser({
            fields: ['Código Cupón', 'Nombre Cupón', 'Cliente', 'Email', 'Habitación', 'Check-in', 'Check-out', 'Noches', 'Tipo Cupón', 'Valor Aplicado', 'Monto Original', 'Descuento', 'Monto Final', 'Fecha Uso']
        });

        const csv = parser.parse(usosFormateados);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=usos-cupones-${Date.now()}.csv`);
        res.status(200).send('\uFEFF' + csv);

    } catch (error) {
        console.error('Error al exportar usos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al exportar usos de cupones',
            error: error.message
        });
    }
};

/**
 * Dashboard de cupones
 */
const mostrarDashboardCupones = async (req, res) => {
    try {
        const userRole = req.session.role;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('VIEW_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para ver el dashboard de cupones'
            });
        }

        // Renderizar vista unificada de cupones y referidos
        res.render('vistaCupones', {
            layout: 'tailwindMain',
            title: 'Cupones y Referidos',
            user: req.session.user
        });

    } catch (error) {
        console.error('Error al mostrar dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error al mostrar dashboard',
            error: error.message
        });
    }
};

/**
 * Obtener datos del dashboard (para API)
 */
const obtenerDatosDashboard = async (req, res) => {
    try {
        const userRole = req.session.role;

        // Verificar permisos
        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return res.status(403).json({
                success: false,
                message: 'El usuario no tiene un rol definido'
            });
        }

        if (!userPermissions.permissions.includes('VIEW_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para ver estadísticas'
            });
        }

        const { fechaInicio, fechaFin } = req.query;

        // Filtro de fechas
        let filtroFecha = {};
        if (fechaInicio || fechaFin) {
            filtroFecha.fechaUso = {};
            if (fechaInicio) filtroFecha.fechaUso.$gte = new Date(fechaInicio);
            if (fechaFin) filtroFecha.fechaUso.$lte = new Date(fechaFin);
        } else {
            // Por defecto últimos 12 meses
            const hace12Meses = new Date();
            hace12Meses.setMonth(hace12Meses.getMonth() - 12);
            filtroFecha.fechaUso = { $gte: hace12Meses };
        }

        // Estadísticas generales
        const [
            totalCupones,
            cuponesActivos,
            totalUsos,
            usosCupones
        ] = await Promise.all([
            Cupon.countDocuments(),
            Cupon.countDocuments({ activo: true }),
            CuponUsage.countDocuments(filtroFecha),
            CuponUsage.find(filtroFecha)
        ]);

        const totalDescuentos = usosCupones.reduce((sum, uso) => sum + uso.montoDescuento, 0);

        // Cupones más usados
        const cuponesPopulares = await CuponUsage.aggregate([
            { $match: filtroFecha },
            {
                $group: {
                    _id: '$cupon',
                    usos: { $sum: 1 },
                    totalDescuentos: { $sum: '$montoDescuento' }
                }
            },
            { $sort: { usos: -1 } },
            { $limit: 10 }
        ]);

        // Poblar datos de cupones
        const cuponesPopularesConDatos = await Promise.all(
            cuponesPopulares.map(async (item) => {
                const cupon = await Cupon.findById(item._id);
                return {
                    codigo: cupon?.codigo || 'N/A',
                    nombre: cupon?.nombre || 'N/A',
                    usos: item.usos,
                    totalDescuentos: item.totalDescuentos
                };
            })
        );

        // Usos por mes
        const usosPorMes = await CuponUsage.aggregate([
            { $match: filtroFecha },
            {
                $group: {
                    _id: {
                        year: { $year: '$fechaUso' },
                        month: { $month: '$fechaUso' }
                    },
                    count: { $sum: 1 },
                    totalDescuentos: { $sum: '$montoDescuento' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        const mesesFormateados = usosPorMes.map(mes => ({
            mes: `${mes._id.year}-${String(mes._id.month).padStart(2, '0')}`,
            usos: mes.count,
            descuentos: mes.totalDescuentos
        }));

        res.json({
            success: true,
            data: {
                resumen: {
                    totalCupones,
                    cuponesActivos,
                    totalUsos,
                    totalDescuentos: totalDescuentos.toFixed(2)
                },
                cuponesPopulares: cuponesPopularesConDatos,
                usosPorMes: mesesFormateados
            }
        });

    } catch (error) {
        console.error('Error al obtener datos del dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener datos del dashboard',
            error: error.message
        });
    }
};

/**
 * Listar usos de cupones con filtros
 */
const listarUsosCupones = async (req, res) => {
    try {
        const userRole = req.session.role;
        const userPermissions = await Roles.findById(userRole);
        
        if (!userPermissions || !userPermissions.permissions.includes('VIEW_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para ver usos de cupones'
            });
        }

        const { esReferido, limit = 100 } = req.query;
        const filtro = {};

        // Si se pide solo cupones de referidos
        if (esReferido === 'true') {
            const cuponesReferidos = await Cupon.find({ esReferido: true }).select('_id').lean();
            const idsCupones = cuponesReferidos.map(c => c._id);
            filtro.cupon = { $in: idsCupones };
        }

        const usos = await CuponUsage.find(filtro)
            .populate({
                path: 'cupon',
                populate: {
                    path: 'cuentaReferido',
                    select: 'nombre tipo'
                }
            })
            .populate('cliente', 'firstName lastName email')
            .populate('clienteWeb', 'firstName lastName email')
            .populate('habitacion', 'propertyDetails.name')
            .sort({ fechaUso: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({
            success: true,
            data: usos
        });

    } catch (error) {
        console.error('Error al listar usos de cupones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar usos de cupones',
            error: error.message
        });
    }
};

module.exports = {
    // Validadores
    crearCuponValidators,
    editarCuponValidators,
    eliminarCuponValidators,
    validarCuponValidators,
    
    // Controladores
    crearCupon,
    listarCupones,
    listarUsosCupones,
    obtenerCupon,
    editarCupon,
    toggleActivoCupon,
    eliminarCupon,
    validarCupon,
    obtenerEstadisticasCupon,
    exportarCuponesCSV,
    exportarUsosCuponesCSV,
    mostrarDashboardCupones,
    obtenerDatosDashboard
};
