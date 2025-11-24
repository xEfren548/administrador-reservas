const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const Usuario = require('../models/Usuario');
const Roles = require('../models/Roles');

/**
 * @route   GET /finanzas
 * @desc    Renderizar vista de finanzas
 * @access  Authenticated
 */
router.get('/finanzas', ensureAuthenticated, async (req, res) => {
    try {
        // Obtener usuario con información completa del rol
        const usuario = await Usuario.findById(req.session.userId).populate('role');
        
        // Verificar si es MASTER ADMIN
        // Solo usuarios con privilege 'Administrador' Y rol con nombre 'MASTER ADMIN'
        let isMasterAdmin = false;
        
        if (usuario && usuario.privilege === 'Administrador' && usuario.role) {
            // Verificar si el nombre del rol es 'MASTER ADMIN'
            isMasterAdmin = usuario.role.name === 'MASTER ADMIN';
        }
        
        res.render('vistaFinanzas', {
            layout: 'tailwindMain',
            title: 'Finanzas - Splitwise',
            user: req.session.user,
            userId: req.session.userId,
            isMasterAdmin: isMasterAdmin
        });
    } catch (error) {
        console.error('Error al cargar vista de finanzas:', error);
        res.status(500).send('Error al cargar la vista');
    }
});

module.exports = router;
