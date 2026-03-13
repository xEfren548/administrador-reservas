const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const Usuario = require('../models/Usuario');

/**
 * @route   GET /inventario
 * @desc    Renderizar vista de inventario/BOM
 * @access  Authenticated
 */
router.get('/inventario', ensureAuthenticated, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.userId).populate('role');

        let isMasterAdmin = false;
        if (usuario && usuario.privilege === 'Administrador' && usuario.role) {
            isMasterAdmin = usuario.role.name === 'MASTER ADMIN';
        }

        res.render('vistaInventario', {
            layout: 'tailwindMain',
            title: 'Inventario - BOM',
            user: req.session.user,
            userId: req.session.userId,
            isMasterAdmin
        });
    } catch (error) {
        console.error('Error al cargar vista de inventario:', error);
        res.status(500).send('Error al cargar la vista de inventario');
    }
});

module.exports = router;
