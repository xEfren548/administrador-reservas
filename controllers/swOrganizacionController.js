const SWOrganizacion = require('../models/SWOrganizacion');
const SWCuenta = require('../models/SWCuenta');
const { check, validationResult } = require('express-validator');

// Validadores
const createOrganizacionValidators = [
    check('nombre')
        .notEmpty().withMessage('El nombre es requerido')
        .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
        .trim(),
    check('descripcion')
        .optional()
        .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres')
        .trim()
];

const updateOrganizacionValidators = [
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
        .isBoolean().withMessage('El campo activa debe ser booleano')
];

/**
 * Crear una nueva organización
 * Solo MASTER ADMIN puede crear organizaciones
 */
const createOrganizacion = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { nombre, descripcion } = req.body;
        const userId = req.session.userId;

        const organizacion = new SWOrganizacion({
            nombre,
            descripcion,
            createdBy: userId
        });

        await organizacion.save();

        res.status(201).json({
            success: true,
            message: 'Organización creada exitosamente',
            data: organizacion
        });
    } catch (error) {
        console.error('Error al crear organización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la organización',
            error: error.message
        });
    }
};

/**
 * Obtener todas las organizaciones
 */
const getAllOrganizaciones = async (req, res) => {
    try {
        const { activa, page = 1, limit = 10 } = req.query;

        const filter = {};
        if (activa !== undefined) {
            filter.activa = activa === 'true';
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const organizaciones = await SWOrganizacion.find(filter)
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await SWOrganizacion.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: organizaciones,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error al obtener organizaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las organizaciones',
            error: error.message
        });
    }
};

/**
 * Obtener una organización por ID
 */
const getOrganizacionById = async (req, res) => {
    try {
        const { id } = req.params;

        const organizacion = await SWOrganizacion.findById(id)
            .populate('createdBy', 'firstName lastName email');

        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        // Obtener estadísticas de la organización
        const cuentasCount = await SWCuenta.countDocuments({ organizacion: id });
        const cuentasActivas = await SWCuenta.countDocuments({ organizacion: id, activa: true });

        res.status(200).json({
            success: true,
            data: {
                ...organizacion.toObject(),
                stats: {
                    totalCuentas: cuentasCount,
                    cuentasActivas
                }
            }
        });
    } catch (error) {
        console.error('Error al obtener organización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la organización',
            error: error.message
        });
    }
};

/**
 * Actualizar una organización
 */
const updateOrganizacion = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { id } = req.params;
        const { nombre, descripcion, activa } = req.body;

        const organizacion = await SWOrganizacion.findById(id);

        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        if (nombre !== undefined) organizacion.nombre = nombre;
        if (descripcion !== undefined) organizacion.descripcion = descripcion;
        if (activa !== undefined) organizacion.activa = activa;

        await organizacion.save();

        res.status(200).json({
            success: true,
            message: 'Organización actualizada exitosamente',
            data: organizacion
        });
    } catch (error) {
        console.error('Error al actualizar organización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar la organización',
            error: error.message
        });
    }
};

/**
 * Desactivar una organización (soft delete)
 */
const deleteOrganizacion = async (req, res) => {
    try {
        const { id } = req.params;

        const organizacion = await SWOrganizacion.findById(id);

        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        // Verificar si tiene cuentas activas
        const cuentasActivas = await SWCuenta.countDocuments({ 
            organizacion: id, 
            activa: true 
        });

        if (cuentasActivas > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede desactivar la organización porque tiene ${cuentasActivas} cuenta(s) activa(s)`
            });
        }

        organizacion.activa = false;
        await organizacion.save();

        res.status(200).json({
            success: true,
            message: 'Organización desactivada exitosamente',
            data: organizacion
        });
    } catch (error) {
        console.error('Error al desactivar organización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al desactivar la organización',
            error: error.message
        });
    }
};

/**
 * Obtener cuentas de una organización
 */
const getOrganizacionCuentas = async (req, res) => {
    try {
        const { id } = req.params;
        const { activa } = req.query;

        const organizacion = await SWOrganizacion.findById(id);

        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        const filter = { organizacion: id };
        if (activa !== undefined) {
            filter.activa = activa === 'true';
        }

        const cuentas = await SWCuenta.find(filter)
            .populate('propietario', 'firstName lastName email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: cuentas
        });
    } catch (error) {
        console.error('Error al obtener cuentas de organización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las cuentas',
            error: error.message
        });
    }
};

module.exports = {
    createOrganizacionValidators,
    updateOrganizacionValidators,
    createOrganizacion,
    getAllOrganizaciones,
    getOrganizacionById,
    updateOrganizacion,
    deleteOrganizacion,
    getOrganizacionCuentas
};
