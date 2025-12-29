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

        const { nombre, descripcion, participantes = [] } = req.body;
        const userId = req.session.userId;

        // Crear la organización
        const organizacion = new SWOrganizacion({
            nombre,
            descripcion,
            createdBy: userId,
            participantes: [
                // El creador siempre es Administrador
                {
                    usuario: userId,
                    rol: 'Administrador',
                    agregadoPor: userId
                }
            ]
        });

        // Agregar participantes adicionales si se proporcionaron
        if (participantes && participantes.length > 0) {
            participantes.forEach(participante => {
                // Evitar duplicados con el creador
                if (participante.usuario && participante.usuario !== userId) {
                    organizacion.participantes.push({
                        usuario: participante.usuario,
                        rol: participante.rol || 'Miembro',
                        agregadoPor: userId
                    });
                }
            });
        }

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
 * Filtra solo las organizaciones donde el usuario es participante o creador
 */
const getAllOrganizaciones = async (req, res) => {
    try {
        const { activa, page = 1, limit = 10 } = req.query;
        const userId = req.session.userId;

        // Filtro: organizaciones donde el usuario es participante O es el creador
        const filter = {
            $or: [
                { 'participantes.usuario': userId },
                { createdBy: userId, participantes: { $exists: false } }, // Organizaciones antiguas sin participantes
                { createdBy: userId, participantes: { $size: 0 } } // Organizaciones con array vacío
            ]
        };
        
        if (activa !== undefined) {
            filter.activa = activa === 'true';
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        let organizaciones = await SWOrganizacion.find(filter)
            .populate('createdBy', 'firstName lastName email')
            .populate('participantes.usuario', 'firstName lastName email')
            .populate('participantes.agregadoPor', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Migrar organizaciones antiguas: agregar creador como participante si no tiene participantes
        for (let org of organizaciones) {
            if (!org.participantes || org.participantes.length === 0) {
                org.participantes = [{
                    usuario: org.createdBy._id,
                    rol: 'Administrador',
                    agregadoPor: org.createdBy._id,
                    fechaIngreso: org.createdAt || new Date()
                }];
                await org.save();
                // Re-popular después de guardar
                await org.populate('participantes.usuario', 'firstName lastName email');
                await org.populate('participantes.agregadoPor', 'firstName lastName email');
            }
        }

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
 * Verifica que el usuario sea participante o creador
 */
const getOrganizacionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const organizacion = await SWOrganizacion.findById(id)
            .populate('createdBy', 'firstName lastName email')
            .populate('participantes.usuario', 'firstName lastName email')
            .populate('participantes.agregadoPor', 'firstName lastName email');

        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        // Migrar organización antigua si no tiene participantes
        if (!organizacion.participantes || organizacion.participantes.length === 0) {
            organizacion.participantes = [{
                usuario: organizacion.createdBy._id,
                rol: 'Administrador',
                agregadoPor: organizacion.createdBy._id,
                fechaIngreso: organizacion.createdAt || new Date()
            }];
            await organizacion.save();
            await organizacion.populate('participantes.usuario', 'firstName lastName email');
            await organizacion.populate('participantes.agregadoPor', 'firstName lastName email');
        }

        // Verificar que el usuario sea participante o creador
        const esParticipante = organizacion.participantes.some(
            p => p.usuario._id.toString() === userId
        );
        const esCreador = organizacion.createdBy._id.toString() === userId;

        if (!esParticipante && !esCreador) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a esta organización'
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
        const userId = req.session.userId;

        const organizacion = await SWOrganizacion.findById(id);

        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        // Verificar que el usuario sea participante
        const esParticipante = organizacion.participantes.some(
            p => p.usuario.toString() === userId
        );

        if (!esParticipante) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a esta organización'
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

/**
 * Agregar participante a una organización
 */
const addParticipante = async (req, res) => {
    try {
        const { id } = req.params;
        const { usuarioId, rol = 'Miembro' } = req.body;
        const userId = req.session.userId;

        if (!usuarioId) {
            return res.status(400).json({
                success: false,
                message: 'El ID del usuario es requerido'
            });
        }

        const organizacion = await SWOrganizacion.findById(id);

        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        // Verificar que el usuario actual sea administrador de la organización
        const participanteActual = organizacion.participantes.find(
            p => p.usuario.toString() === userId
        );

        if (!participanteActual || participanteActual.rol !== 'Administrador') {
            return res.status(403).json({
                success: false,
                message: 'Solo los administradores pueden agregar participantes'
            });
        }

        // Verificar que el usuario no sea ya participante
        const yaEsParticipante = organizacion.participantes.some(
            p => p.usuario.toString() === usuarioId
        );

        if (yaEsParticipante) {
            return res.status(400).json({
                success: false,
                message: 'El usuario ya es participante de esta organización'
            });
        }

        // Agregar el participante
        organizacion.participantes.push({
            usuario: usuarioId,
            rol,
            agregadoPor: userId
        });

        await organizacion.save();

        // Poblar los datos del nuevo participante
        await organizacion.populate('participantes.usuario', 'firstName lastName email');
        await organizacion.populate('participantes.agregadoPor', 'firstName lastName email');

        res.status(200).json({
            success: true,
            message: 'Participante agregado exitosamente',
            data: organizacion
        });
    } catch (error) {
        console.error('Error al agregar participante:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar participante',
            error: error.message
        });
    }
};

/**
 * Eliminar participante de una organización
 */
const removeParticipante = async (req, res) => {
    try {
        const { id, participanteId } = req.params;
        const userId = req.session.userId;

        const organizacion = await SWOrganizacion.findById(id);

        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        // Verificar que el usuario actual sea administrador de la organización
        const participanteActual = organizacion.participantes.find(
            p => p.usuario.toString() === userId
        );

        if (!participanteActual || participanteActual.rol !== 'Administrador') {
            return res.status(403).json({
                success: false,
                message: 'Solo los administradores pueden eliminar participantes'
            });
        }

        // Verificar que no se elimine al creador
        if (participanteId === organizacion.createdBy.toString()) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar al creador de la organización'
            });
        }

        // Verificar que no sea el único administrador
        const administradores = organizacion.participantes.filter(p => p.rol === 'Administrador');
        const participanteAEliminar = organizacion.participantes.find(
            p => p.usuario.toString() === participanteId
        );

        if (participanteAEliminar?.rol === 'Administrador' && administradores.length <= 1) {
            return res.status(400).json({
                success: false,
                message: 'Debe haber al menos un administrador en la organización'
            });
        }

        // Eliminar el participante
        organizacion.participantes = organizacion.participantes.filter(
            p => p.usuario.toString() !== participanteId
        );

        await organizacion.save();

        res.status(200).json({
            success: true,
            message: 'Participante eliminado exitosamente',
            data: organizacion
        });
    } catch (error) {
        console.error('Error al eliminar participante:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar participante',
            error: error.message
        });
    }
};

/**
 * Actualizar rol de participante
 */
const updateParticipanteRole = async (req, res) => {
    try {
        const { id, participanteId } = req.params;
        const { rol } = req.body;
        const userId = req.session.userId;

        if (!rol || !['Administrador', 'Miembro'].includes(rol)) {
            return res.status(400).json({
                success: false,
                message: 'Rol inválido. Debe ser Administrador o Miembro'
            });
        }

        const organizacion = await SWOrganizacion.findById(id);

        if (!organizacion) {
            return res.status(404).json({
                success: false,
                message: 'Organización no encontrada'
            });
        }

        // Verificar que el usuario actual sea administrador
        const participanteActual = organizacion.participantes.find(
            p => p.usuario.toString() === userId
        );

        if (!participanteActual || participanteActual.rol !== 'Administrador') {
            return res.status(403).json({
                success: false,
                message: 'Solo los administradores pueden cambiar roles'
            });
        }

        // Verificar que no se cambie el rol del creador
        if (participanteId === organizacion.createdBy.toString()) {
            return res.status(400).json({
                success: false,
                message: 'No se puede cambiar el rol del creador de la organización'
            });
        }

        // Si se intenta cambiar un administrador a miembro, verificar que no sea el único
        const participanteAModificar = organizacion.participantes.find(
            p => p.usuario.toString() === participanteId
        );

        if (participanteAModificar?.rol === 'Administrador' && rol === 'Miembro') {
            const administradores = organizacion.participantes.filter(p => p.rol === 'Administrador');
            if (administradores.length <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe haber al menos un administrador en la organización'
                });
            }
        }

        // Actualizar el rol
        const participante = organizacion.participantes.find(
            p => p.usuario.toString() === participanteId
        );

        if (!participante) {
            return res.status(404).json({
                success: false,
                message: 'Participante no encontrado'
            });
        }

        participante.rol = rol;
        await organizacion.save();

        // Poblar los datos
        await organizacion.populate('participantes.usuario', 'firstName lastName email');
        await organizacion.populate('participantes.agregadoPor', 'firstName lastName email');

        res.status(200).json({
            success: true,
            message: 'Rol actualizado exitosamente',
            data: organizacion
        });
    } catch (error) {
        console.error('Error al actualizar rol de participante:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar rol de participante',
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
    getOrganizacionCuentas,
    addParticipante,
    removeParticipante,
    updateParticipanteRole
};
