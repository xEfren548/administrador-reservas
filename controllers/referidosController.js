const { check } = require('express-validator');
const { Parser } = require('json2csv');
const CuentaReferido = require('../models/CuentaReferido');
const Cupon = require('../models/Cupon');
const CuponUsage = require('../models/CuponUsage');
const Roles = require('../models/Roles');

// ============= VALIDADORES =============

const crearCuentaReferidoValidators = [
    check('nombre')
        .notEmpty().withMessage('El nombre es requerido')
        .isLength({ max: 100 }).withMessage('El nombre no puede exceder 100 caracteres')
        .trim(),
    check('celular')
        .optional({ checkFalsy: true })
        .isLength({ max: 20 }).withMessage('El celular no puede exceder 20 caracteres')
        .trim(),
    check('tipo')
        .notEmpty().withMessage('El tipo es requerido')
        .isIn(['influencer', 'marca', 'afiliado', 'otro'])
        .withMessage('El tipo debe ser influencer, marca, afiliado u otro'),
    check('comisionReferidor.tipo')
        .notEmpty().withMessage('El tipo de comisión es requerido')
        .isIn(['percentage', 'fixed_amount'])
        .withMessage('El tipo de comisión debe ser percentage o fixed_amount'),
    check('comisionReferidor.valor')
        .notEmpty().withMessage('El valor de la comisión es requerido')
        .isFloat({ min: 0 }).withMessage('El valor no puede ser negativo'),
    check('notas')
        .optional({ checkFalsy: true })
        .isLength({ max: 500 }).withMessage('Las notas no pueden exceder 500 caracteres')
];

// ============= CONTROLADORES =============

/**
 * Crear cuenta de referido con su cupón asociado
 */
const crearCuentaReferido = async (req, res) => {
    try {
        const userRole = req.session.role;
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
                message: 'No tiene permiso para crear cuentas de referidos'
            });
        }

        const {
            nombre,
            celular,
            tipo,
            comisionReferidor,
            notas,
            // Datos del cupón
            nombreCupon,
            codigoCupon,
            tipoCupon,
            valorCupon,
            aplicableA,
            fechaInicio,
            fechaFin,
            usosLimitados,
            montoMinimoCompra,
            descuentoMaximo,
            todasCabanas,
            habitaciones,
            restricciones,
            descripcionCupon,
            nochesRecibidas,
            nochesPagadas
        } = req.body;

        // Validar campos específicos para nights_free
        if (tipoCupon === 'nights_free') {
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

        // Crear cuenta de referido
        const nuevaCuenta = new CuentaReferido({
            nombre,
            celular,
            tipo,
            comisionReferidor,
            notas,
            activo: true,
            creadoPor: req.session.userId
        });

        await nuevaCuenta.save();

        // Crear cupón asociado
        const nuevoCupon = new Cupon({
            nombre: nombreCupon || `Referido: ${nombre}`,
            codigo: codigoCupon.toUpperCase(),
            tipo: tipoCupon,
            valor: tipoCupon === 'nights_free' ? 0 : valorCupon,
            aplicableA: aplicableA || 'all',
            fechaInicio,
            fechaFin,
            usosLimitados: usosLimitados || null,
            usosActuales: 0,
            montoMinimoCompra: montoMinimoCompra || 0,
            descuentoMaximo: descuentoMaximo || null,
            todasCabanas: todasCabanas !== false,
            habitaciones: todasCabanas ? [] : (habitaciones || []),
            restricciones: restricciones || {},
            descripcion: descripcionCupon || '',
            nochesRecibidas: tipoCupon === 'nights_free' ? nochesRecibidas : null,
            nochesPagadas: tipoCupon === 'nights_free' ? nochesPagadas : null,
            activo: true,
            esReferido: true,
            cuentaReferido: nuevaCuenta._id,
            creadoPor: req.session.userId
        });

        await nuevoCupon.save();

        // Actualizar cuenta con el cupón
        nuevaCuenta.cupon = nuevoCupon._id;
        await nuevaCuenta.save();

        res.status(201).json({
            success: true,
            message: 'Cuenta de referido creada exitosamente',
            data: {
                cuenta: nuevaCuenta,
                cupon: nuevoCupon
            }
        });

    } catch (error) {
        console.error('Error al crear cuenta de referido:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'El código de cupón ya existe'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error al crear cuenta de referido',
            error: error.message
        });
    }
};

/**
 * Listar todas las cuentas de referidos con estadísticas
 */
const listarCuentasReferidos = async (req, res) => {
    try {
        const userRole = req.session.role;
        const userPermissions = await Roles.findById(userRole);
        
        if (!userPermissions || !userPermissions.permissions.includes('VIEW_REFERIDOS')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para ver cuentas de referidos'
            });
        }

        const { tipo, activo } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const filtro = {};
        if (tipo) filtro.tipo = tipo;
        if (activo !== undefined) filtro.activo = activo === 'true';

        const [cuentas, total] = await Promise.all([
            CuentaReferido.find(filtro)
                .populate('cupon', 'codigo tipo valor activo usosActuales usosLimitados')
                .populate('creadoPor', 'firstName lastName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CuentaReferido.countDocuments(filtro)
        ]);

        // Calcular estadísticas para cada cuenta
        const cuentasConEstadisticas = await Promise.all(cuentas.map(async (cuenta) => {
            if (!cuenta.cupon) {
                return {
                    ...cuenta,
                    estadisticas: {
                        totalUsos: 0,
                        totalDescuentos: 0,
                        comisionTotal: 0
                    }
                };
            }

            const usos = await CuponUsage.find({ cupon: cuenta.cupon._id }).lean();
            
            const totalUsos = usos.length;
            const totalDescuentos = usos.reduce((sum, uso) => sum + uso.montoDescuento, 0);
            
            let comisionTotal = 0;
            usos.forEach(uso => {
                if (cuenta.comisionReferidor.tipo === 'percentage') {
                    comisionTotal += (uso.montoOriginal * cuenta.comisionReferidor.valor) / 100;
                } else {
                    comisionTotal += cuenta.comisionReferidor.valor;
                }
            });

            return {
                ...cuenta,
                estadisticas: {
                    totalUsos,
                    totalDescuentos,
                    comisionTotal
                }
            };
        }));

        res.json({
            success: true,
            data: cuentasConEstadisticas,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error al listar cuentas de referidos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar cuentas de referidos',
            error: error.message
        });
    }
};

/**
 * Obtener detalle de una cuenta de referido
 */
const obtenerCuentaReferido = async (req, res) => {
    try {
        const userRole = req.session.role;
        const userPermissions = await Roles.findById(userRole);
        
        if (!userPermissions || !userPermissions.permissions.includes('VIEW_REFERIDOS')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para ver cuentas de referidos'
            });
        }

        const { id } = req.params;

        const cuenta = await CuentaReferido.findById(id)
            .populate('cupon')
            .populate('creadoPor', 'firstName lastName')
            .populate('modificadoPor', 'firstName lastName')
            .lean();

        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta de referido no encontrada'
            });
        }

        // Obtener usos del cupón
        const usos = await CuponUsage.find({ cupon: cuenta.cupon._id })
            .populate('cliente', 'firstName lastName email')
            .populate('clienteWeb', 'firstName lastName email')
            .populate('habitacion', 'propertyDetails.name')
            .sort({ fechaUso: -1 })
            .limit(100)
            .lean();

        // Calcular estadísticas
        const totalDescuentos = usos.reduce((sum, uso) => sum + uso.montoDescuento, 0);
        
        let comisionTotal = 0;
        usos.forEach(uso => {
            if (cuenta.comisionReferidor.tipo === 'percentage') {
                comisionTotal += (uso.montoOriginal * cuenta.comisionReferidor.valor) / 100;
            } else {
                comisionTotal += cuenta.comisionReferidor.valor;
            }
        });

        res.json({
            success: true,
            data: {
                cuenta,
                usos,
                estadisticas: {
                    totalUsos: usos.length,
                    totalDescuentos,
                    comisionTotal
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener cuenta de referido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener cuenta de referido',
            error: error.message
        });
    }
};

/**
 * Actualizar cuenta de referido
 */
const actualizarCuentaReferido = async (req, res) => {
    try {
        const userRole = req.session.role;
        const userPermissions = await Roles.findById(userRole);
        
        if (!userPermissions || !userPermissions.permissions.includes('EDIT_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para editar cuentas de referidos'
            });
        }

        const { id } = req.body;
        const { nombre, celular, tipo, comisionReferidor, notas, activo } = req.body;

        const cuenta = await CuentaReferido.findById(id);

        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta de referido no encontrada'
            });
        }

        cuenta.nombre = nombre || cuenta.nombre;
        cuenta.celular = celular !== undefined ? celular : cuenta.celular;
        cuenta.tipo = tipo || cuenta.tipo;
        cuenta.comisionReferidor = comisionReferidor || cuenta.comisionReferidor;
        cuenta.notas = notas !== undefined ? notas : cuenta.notas;
        cuenta.activo = activo !== undefined ? activo : cuenta.activo;
        cuenta.modificadoPor = req.session.userId;

        await cuenta.save();

        res.json({
            success: true,
            message: 'Cuenta de referido actualizada exitosamente',
            data: cuenta
        });

    } catch (error) {
        console.error('Error al actualizar cuenta de referido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar cuenta de referido',
            error: error.message
        });
    }
};

/**
 * Toggle activo/inactivo de cuenta de referido
 */
const toggleActivoCuentaReferido = async (req, res) => {
    try {
        const userRole = req.session.role;
        const userPermissions = await Roles.findById(userRole);
        
        if (!userPermissions || !userPermissions.permissions.includes('EDIT_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para modificar cuentas de referidos'
            });
        }

        const { id } = req.params;

        const cuenta = await CuentaReferido.findById(id);

        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta de referido no encontrada'
            });
        }

        cuenta.activo = !cuenta.activo;
        cuenta.modificadoPor = req.session.userId;
        await cuenta.save();

        // También actualizar el cupón asociado
        if (cuenta.cupon) {
            await Cupon.findByIdAndUpdate(cuenta.cupon, {
                activo: cuenta.activo
            });
        }

        res.json({
            success: true,
            message: `Cuenta de referido ${cuenta.activo ? 'activada' : 'desactivada'} exitosamente`,
            data: cuenta
        });

    } catch (error) {
        console.error('Error al cambiar estado de cuenta de referido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado de cuenta de referido',
            error: error.message
        });
    }
};

/**
 * Exportar cuentas de referidos a CSV
 */
const exportarCuentasReferidosCSV = async (req, res) => {
    try {
        const userRole = req.session.role;
        const userPermissions = await Roles.findById(userRole);
        
        if (!userPermissions || !userPermissions.permissions.includes('EXPORT_CUPONES')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para exportar datos'
            });
        }

        const { tipo, activo } = req.query;
        const filtro = {};
        if (tipo) filtro.tipo = tipo;
        if (activo !== undefined) filtro.activo = activo === 'true';

        const cuentas = await CuentaReferido.find(filtro)
            .populate('cupon', 'codigo tipo valor usosActuales')
            .lean();

        // Calcular estadísticas para cada cuenta
        const datosExport = await Promise.all(cuentas.map(async (cuenta) => {
            let totalUsos = 0;
            let totalDescuentos = 0;
            let comisionTotal = 0;

            if (cuenta.cupon) {
                const usos = await CuponUsage.find({ cupon: cuenta.cupon._id }).lean();
                totalUsos = usos.length;
                totalDescuentos = usos.reduce((sum, uso) => sum + uso.montoDescuento, 0);
                
                usos.forEach(uso => {
                    if (cuenta.comisionReferidor.tipo === 'percentage') {
                        comisionTotal += (uso.montoOriginal * cuenta.comisionReferidor.valor) / 100;
                    } else {
                        comisionTotal += cuenta.comisionReferidor.valor;
                    }
                });
            }

            return {
                Nombre: cuenta.nombre,
                Celular: cuenta.celular || '',
                Tipo: cuenta.tipo,
                'Código Cupón': cuenta.cupon ? cuenta.cupon.codigo : '',
                'Tipo Comisión': cuenta.comisionReferidor.tipo === 'percentage' ? 'Porcentaje' : 'Monto Fijo',
                'Valor Comisión': cuenta.comisionReferidor.valor,
                'Total Usos': totalUsos,
                'Total Descuentos': totalDescuentos.toFixed(2),
                'Comisión Total': comisionTotal.toFixed(2),
                Estado: cuenta.activo ? 'Activo' : 'Inactivo',
                'Fecha Creación': new Date(cuenta.createdAt).toLocaleDateString('es-MX')
            };
        }));

        const parser = new Parser({
            delimiter: ',',
            withBOM: true
        });

        const csv = parser.parse(datosExport);

        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.header('Content-Disposition', `attachment; filename=cuentas-referidos-${Date.now()}.csv`);
        res.send('\uFEFF' + csv);

    } catch (error) {
        console.error('Error al exportar cuentas de referidos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al exportar cuentas de referidos',
            error: error.message
        });
    }
};

/**
 * Obtener estadísticas generales de referidos
 */
const obtenerEstadisticasReferidos = async (req, res) => {
    try {
        const userRole = req.session.role;
        const userPermissions = await Roles.findById(userRole);
        
        if (!userPermissions || !userPermissions.permissions.includes('VIEW_REFERIDOS')) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para ver estadísticas'
            });
        }

        const totalCuentas = await CuentaReferido.countDocuments();
        const cuentasActivas = await CuentaReferido.countDocuments({ activo: true });

        // Obtener todos los cupones de referidos
        const cuponesReferidos = await Cupon.find({ esReferido: true }).lean();
        const idsCupones = cuponesReferidos.map(c => c._id);

        const usosTotales = await CuponUsage.countDocuments({ cupon: { $in: idsCupones } });
        
        const usosAgregados = await CuponUsage.aggregate([
            { $match: { cupon: { $in: idsCupones } } },
            {
                $group: {
                    _id: null,
                    totalDescuentos: { $sum: '$montoDescuento' }
                }
            }
        ]);

        const totalDescuentos = usosAgregados.length > 0 ? usosAgregados[0].totalDescuentos : 0;

        // Calcular comisión total (necesitamos iterar por cada cuenta)
        const cuentas = await CuentaReferido.find().lean();
        let comisionTotalGeneral = 0;
        
        for (const cuenta of cuentas) {
            if (cuenta.cupon) {
                const usos = await CuponUsage.find({ cupon: cuenta.cupon }).lean();
                usos.forEach(uso => {
                    if (cuenta.comisionReferidor.tipo === 'percentage') {
                        comisionTotalGeneral += (uso.montoOriginal * cuenta.comisionReferidor.valor) / 100;
                    } else {
                        comisionTotalGeneral += cuenta.comisionReferidor.valor;
                    }
                });
            }
        }

        res.json({
            success: true,
            data: {
                totalCuentas,
                cuentasActivas,
                usosTotales,
                totalDescuentos,
                comisionTotalGeneral
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

module.exports = {
    crearCuentaReferidoValidators,
    crearCuentaReferido,
    listarCuentasReferidos,
    obtenerCuentaReferido,
    actualizarCuentaReferido,
    toggleActivoCuentaReferido,
    exportarCuentasReferidosCSV,
    obtenerEstadisticasReferidos
};
