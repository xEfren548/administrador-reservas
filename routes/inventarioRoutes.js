const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const Usuario = require('../models/Usuario');
const PERMISSIONS = require('../models/permissions');
const { requirePermissionOrMasterAdmin } = require('../common/middlewares/authPrivileges/authSW');

const hasPermission = (usuario, permissionKey) => {
    if (!usuario?.role?.permissions?.length) return false;
    return usuario.role.permissions.includes(permissionKey) || usuario.role.permissions.includes(PERMISSIONS[permissionKey]);
};

/**
 * @route   GET /inventario
 * @desc    Renderizar vista de inventario/BOM
 * @access  Authenticated
 */
router.get('/inventario', ensureAuthenticated, requirePermissionOrMasterAdmin('VIEW_INVENTORY'), async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.userId).populate('role');

        let isMasterAdmin = false;
        if (usuario && usuario.privilege === 'Administrador' && usuario.role) {
            isMasterAdmin = usuario.role.name === 'MASTER ADMIN';
        }

        const canManageInventory = isMasterAdmin || hasPermission(usuario, 'MANAGE_INVENTORY');
        const canAdjustInventory = isMasterAdmin || hasPermission(usuario, 'ADJUST_INVENTORY');
        const canViewInventoryDashboard = isMasterAdmin || hasPermission(usuario, 'VIEW_INVENTORY_DASHBOARD');

        res.render('vistaInventario', {
            layout: 'tailwindMain',
            title: 'Inventario - BOM',
            user: req.session.user,
            userId: req.session.userId,
            isMasterAdmin,
            canManageInventory,
            canAdjustInventory,
            canViewInventoryDashboard
        });
    } catch (error) {
        console.error('Error al cargar vista de inventario:', error);
        res.status(500).send('Error al cargar la vista de inventario');
    }
});

module.exports = router;
