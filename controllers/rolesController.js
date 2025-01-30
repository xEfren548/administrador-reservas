const Role = require('../models/Roles');
const permissions = require('../models/permissions');

const showCreateRoleForm = (req, res) => {
    res.render('createRole', { permissions });
  };

// Crear un nuevo rol
const createRole = async (req, res) => {
    try {
        const { name, description, permissions: rolePermissions } = req.body;

        // Validar que los permisos proporcionados existan en la lista fija
        const invalidPermissions = rolePermissions.filter(
            (perm) => !Object.values(permissions).includes(perm)
        );

        if (invalidPermissions.length > 0) {
            return res.status(400).json({
                message: `Permisos no válidos: ${invalidPermissions.join(', ')}`,
            });
        }

        const role = new Role({ name, description, permissions: rolePermissions });
        await role.save();
        res.status(201).json(role);
    } catch (error) {
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
        const { name, description, permissions: rolePermissions } = req.body;

        // Validar que los permisos proporcionados existan en la lista fija
        const invalidPermissions = rolePermissions.filter(
            (perm) => !Object.values(permissions).includes(perm)
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