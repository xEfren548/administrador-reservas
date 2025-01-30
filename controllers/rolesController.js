const Role = require('../models/Roles');
const permissions = require('../models/permissions');

const showCreateRoleForm = async (req, res) => {
    const roles = await Role.find().lean();
    console.log(roles)

    res.render('createRole', { roles, permissions });
};

// Crear un nuevo rol
const createRole = async (req, res) => {
    const { name, description, permissions: rolePermissions } = req.body;

    console.log('Permisos recibidos:', rolePermissions); // Depuración

    // Validar que los permisos proporcionados existan en el diccionario
    const invalidPermissions = rolePermissions.filter(
        (perm) => !permissions[perm] // Verifica si el permiso existe en el diccionario
    );

    if (invalidPermissions.length > 0) {
        return res.status(400).json({
            message: `Permisos no válidos: ${invalidPermissions.join(', ')}`,
        });
    }

    try {
        const role = new Role({ name, description, permissions: rolePermissions });
        await role.save();
        res.status(201).json(role);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};

// Obtener todos los roles
const getAllRoles = async (req, res) => {
    try {
        const roles = await Role.find();
        res.status(200).json(roles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Obtener un rol por ID
const getRoleById = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.status(404).json({ message: 'Rol no encontrado' });
        }
        res.status(200).json(role);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Actualizar un rol
const updateRole = async (req, res) => {
    try {
        const { id, name, description, permissions: rolePermissions } = req.body;

        const foundRole = await Role.findById(id);
        if (!foundRole) {
            return res.status(404).json({ message: 'Rol no encontrado' });
        }

        // Validar que los permisos proporcionados existan en la lista fija
        const invalidPermissions = rolePermissions.filter(
            (perm) => !permissions[perm] // Verifica si el permiso existe en el diccionario
        );

        if (invalidPermissions.length > 0) {
            return res.status(400).json({
                message: `Permisos no válidos: ${invalidPermissions.join(', ')}`,
            });
        }

        const role = await Role.findByIdAndUpdate(
            req.params.id,
            { name, description, permissions: rolePermissions },
            { new: true }
        );
        if (!role) {
            return res.status(404).json({ message: 'Rol no encontrado' });
        }
        res.status(200).json(role);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Eliminar un rol
const deleteRole = async (req, res) => {
    try {
        const role = await Role.findByIdAndDelete(req.params.id);
        if (!role) {
            return res.status(404).json({ message: 'Rol no encontrado' });
        }
        res.status(200).json({ message: 'Rol eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    showCreateRoleForm,
    createRole,
    getAllRoles,
    getRoleById,
    updateRole,
    deleteRole,
};