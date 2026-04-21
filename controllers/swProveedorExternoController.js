const { check, validationResult } = require('express-validator');
const SWOrganizacion = require('../models/SWOrganizacion');
const SWProveedorExterno = require('../models/SWProveedorExterno');

function obtenerParticipanteOrganizacion(organizacion, userId) {
    return (organizacion.participantes || []).find(
        (participante) => participante.usuario.toString() === userId.toString()
    );
}

async function validarAccesoOrganizacion(organizacionId, userId) {
    const organizacion = await SWOrganizacion.findById(organizacionId);
    if (!organizacion || !organizacion.activa) {
        const error = new Error('Organización no encontrada');
        error.statusCode = 404;
        throw error;
    }

    const participante = obtenerParticipanteOrganizacion(organizacion, userId);
    if (!participante) {
        const error = new Error('No pertenece a esta organización');
        error.statusCode = 403;
        throw error;
    }

    return { organizacion, participante };
}

const createProveedorExternoValidators = [
    check('organizacionId')
        .notEmpty().withMessage('El ID de la organización es requerido')
        .isMongoId().withMessage('ID de organización inválido'),
    check('nombre')
        .notEmpty().withMessage('El nombre del proveedor es requerido')
        .isLength({ min: 2, max: 150 }).withMessage('El nombre del proveedor debe tener entre 2 y 150 caracteres')
        .trim(),
    check('beneficiario')
        .notEmpty().withMessage('El beneficiario es requerido')
        .isLength({ min: 2, max: 150 }).withMessage('El beneficiario debe tener entre 2 y 150 caracteres')
        .trim(),
    check('banco')
        .notEmpty().withMessage('El banco es requerido')
        .isLength({ min: 2, max: 120 }).withMessage('El banco debe tener entre 2 y 120 caracteres')
        .trim(),
    check('cuentaClabe')
        .notEmpty().withMessage('La cuenta bancaria o CLABE es requerida')
        .isLength({ min: 6, max: 30 }).withMessage('La cuenta bancaria o CLABE debe tener entre 6 y 30 caracteres')
        .trim()
];

const updateProveedorExternoValidators = [
    check('organizacionId')
        .notEmpty().withMessage('El ID de la organización es requerido')
        .isMongoId().withMessage('ID de organización inválido'),
    check('nombre')
        .notEmpty().withMessage('El nombre del proveedor es requerido')
        .isLength({ min: 2, max: 150 }).withMessage('El nombre del proveedor debe tener entre 2 y 150 caracteres')
        .trim(),
    check('beneficiario')
        .notEmpty().withMessage('El beneficiario es requerido')
        .isLength({ min: 2, max: 150 }).withMessage('El beneficiario debe tener entre 2 y 150 caracteres')
        .trim(),
    check('banco')
        .notEmpty().withMessage('El banco es requerido')
        .isLength({ min: 2, max: 120 }).withMessage('El banco debe tener entre 2 y 120 caracteres')
        .trim(),
    check('cuentaClabe')
        .notEmpty().withMessage('La cuenta bancaria o CLABE es requerida')
        .isLength({ min: 6, max: 30 }).withMessage('La cuenta bancaria o CLABE debe tener entre 6 y 30 caracteres')
        .trim()
];

async function obtenerProveedorActivoPorOrganizacion(proveedorId, organizacionId) {
    const proveedor = await SWProveedorExterno.findOne({
        _id: proveedorId,
        organizacion: organizacionId,
        activa: true
    });

    if (!proveedor) {
        const error = new Error('Proveedor externo no encontrado');
        error.statusCode = 404;
        throw error;
    }

    return proveedor;
}

const listProveedoresExternos = async (req, res) => {
    try {
        const { organizacionId } = req.params;
        const userId = req.session.userId;

        await validarAccesoOrganizacion(organizacionId, userId);

        const proveedores = await SWProveedorExterno.find({
            organizacion: organizacionId,
            activa: true
        }).sort({ nombre: 1, beneficiario: 1, createdAt: -1 });

        return res.json({
            success: true,
            data: proveedores
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al obtener proveedores externos' : error.message,
            error: error.message
        });
    }
};

const createProveedorExterno = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { organizacionId, nombre, beneficiario, banco, cuentaClabe } = req.body;
        const userId = req.session.userId;

        await validarAccesoOrganizacion(organizacionId, userId);

        const proveedorExistente = await SWProveedorExterno.findOne({
            organizacion: organizacionId,
            activa: true,
            cuentaClabe: cuentaClabe.trim(),
            beneficiario: beneficiario.trim()
        });

        if (proveedorExistente) {
            return res.status(200).json({
                success: true,
                reused: true,
                message: 'Proveedor externo ya existente',
                data: proveedorExistente
            });
        }

        const proveedor = new SWProveedorExterno({
            organizacion: organizacionId,
            nombre,
            beneficiario,
            banco,
            cuentaClabe,
            createdBy: userId
        });

        await proveedor.save();

        return res.status(201).json({
            success: true,
            message: 'Proveedor externo guardado exitosamente',
            data: proveedor
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al guardar proveedor externo' : error.message,
            error: error.message
        });
    }
};

const updateProveedorExterno = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { id } = req.params;
        const { organizacionId, nombre, beneficiario, banco, cuentaClabe } = req.body;
        const userId = req.session.userId;

        await validarAccesoOrganizacion(organizacionId, userId);

        const proveedor = await obtenerProveedorActivoPorOrganizacion(id, organizacionId);

        const proveedorDuplicado = await SWProveedorExterno.findOne({
            _id: { $ne: id },
            organizacion: organizacionId,
            activa: true,
            cuentaClabe: cuentaClabe.trim(),
            beneficiario: beneficiario.trim()
        });

        if (proveedorDuplicado) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe otro proveedor con el mismo beneficiario y cuenta/CLABE en esta organización'
            });
        }

        proveedor.nombre = nombre;
        proveedor.beneficiario = beneficiario;
        proveedor.banco = banco;
        proveedor.cuentaClabe = cuentaClabe;

        await proveedor.save();

        return res.json({
            success: true,
            message: 'Proveedor externo actualizado exitosamente',
            data: proveedor
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al actualizar proveedor externo' : error.message,
            error: error.message
        });
    }
};

const deleteProveedorExterno = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizacionId } = req.body;
        const userId = req.session.userId;

        if (!organizacionId) {
            return res.status(400).json({
                success: false,
                message: 'El ID de la organización es requerido'
            });
        }

        await validarAccesoOrganizacion(organizacionId, userId);

        const proveedor = await obtenerProveedorActivoPorOrganizacion(id, organizacionId);
        proveedor.activa = false;
        await proveedor.save();

        return res.json({
            success: true,
            message: 'Proveedor externo eliminado exitosamente'
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al eliminar proveedor externo' : error.message,
            error: error.message
        });
    }
};

module.exports = {
    createProveedorExternoValidators,
    updateProveedorExternoValidators,
    listProveedoresExternos,
    createProveedorExterno,
    updateProveedorExterno,
    deleteProveedorExterno,
    validarAccesoOrganizacion
};