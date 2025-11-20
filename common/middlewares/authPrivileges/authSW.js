const Usuario = require('../../../models/Usuario');
const SWCuenta = require('../../../models/SWCuenta');
const SWParticipante = require('../../../models/SWParticipante');
const Roles = require('../../../models/Roles');
const PERMISSIONS = require('../../../models/permissions');

/**
 * Middleware para verificar permisos específicos O rol de MASTER ADMIN
 * Primero verifica si tiene el permiso específico, si no, verifica si es MASTER ADMIN
 */
const requirePermissionOrMasterAdmin = (permissionKey) => {
    return async (req, res, next) => {
        try {
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'No autenticado' 
                });
            }

            const usuario = await Usuario.findById(userId).populate('role');
            
            if (!usuario) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuario no encontrado' 
                });
            }

            // Primera validación: Verificar si tiene el permiso específico
            // Buscar tanto por la clave como por el valor de descripción (para compatibilidad)
            let tienePermiso = false;
            if (usuario.role && usuario.role.permissions && usuario.role.permissions.length > 0) {
                tienePermiso = usuario.role.permissions.includes(permissionKey) || 
                               usuario.role.permissions.includes(PERMISSIONS[permissionKey]);
            }

            // Segunda validación: Verificar si es MASTER ADMIN
            const esMasterAdmin = usuario.privilege === 'Administrador' && 
                                  usuario.role && 
                                  usuario.role.name === 'MASTER ADMIN';

            if (!tienePermiso && !esMasterAdmin) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'No tiene permisos para realizar esta operación' 
                });
            }

            req.usuario = usuario;
            next();
        } catch (error) {
            console.error('Error en requirePermissionOrMasterAdmin:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error al verificar permisos' 
            });
        }
    };
};

/**
 * Middleware para verificar que el usuario tenga un rol específico
 */
const requireRole = (rolesPermitidos) => {
    return async (req, res, next) => {
        try {
            const userId = req.session.userId;
            
            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'No autenticado' 
                });
            }

            const usuario = await Usuario.findById(userId);
            
            if (!usuario) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuario no encontrado' 
                });
            }

            // Verificar si el usuario tiene el privilegio requerido
            if (Array.isArray(rolesPermitidos)) {
                if (!rolesPermitidos.includes(usuario.privilege)) {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'No tiene permisos para realizar esta operación' 
                    });
                }
            } else {
                if (usuario.privilege !== rolesPermitidos) {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'No tiene permisos para realizar esta operación' 
                    });
                }
            }

            req.usuario = usuario;
            next();
        } catch (error) {
            console.error('Error en requireRole:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error al verificar permisos' 
            });
        }
    };
};

/**
 * Middleware para verificar que el usuario sea MASTER ADMIN (Administrador)
 */
const requireMasterAdmin = requireRole('Administrador');

/**
 * Middleware para verificar que el usuario sea propietario de una cuenta
 */
const requireCuentaPropietario = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const cuentaId = req.params.id || req.params.cuentaId || req.body.cuentaId || req.query.cuentaId;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'No autenticado' 
            });
        }

        if (!cuentaId) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID de cuenta requerido' 
            });
        }

        const cuenta = await SWCuenta.findById(cuentaId);

        if (!cuenta) {
            return res.status(404).json({ 
                success: false, 
                message: 'Cuenta no encontrada' 
            });
        }

        // Verificar si es propietario
        if (cuenta.propietario.toString() !== userId.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Solo el propietario puede realizar esta operación' 
            });
        }

        req.cuenta = cuenta;
        req.usuario = await Usuario.findById(userId);
        next();
    } catch (error) {
        console.error('Error en requireCuentaPropietario:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar permisos' 
        });
    }
};

/**
 * Middleware para verificar que el usuario sea participante de una cuenta
 */
const requireCuentaParticipante = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const cuentaId = req.params.id || req.params.cuentaId || req.body.cuentaId || req.query.cuentaId;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'No autenticado' 
            });
        }

        if (!cuentaId) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID de cuenta requerido' 
            });
        }

        // Verificar si es participante activo
        const participante = await SWParticipante.findOne({
            cuenta: cuentaId,
            usuario: userId,
            activo: true
        });

        if (!participante) {
            return res.status(403).json({ 
                success: false, 
                message: 'No es participante de esta cuenta' 
            });
        }

        req.participante = participante;
        req.usuario = await Usuario.findById(userId);
        req.cuenta = await SWCuenta.findById(cuentaId);
        next();
    } catch (error) {
        console.error('Error en requireCuentaParticipante:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar permisos' 
        });
    }
};

/**
 * Middleware para verificar que el usuario sea propietario O participante de una cuenta
 */
const requireCuentaAcceso = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const cuentaId = req.params.id || req.params.cuentaId || req.body.cuentaId || req.query.cuentaId;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'No autenticado' 
            });
        }

        if (!cuentaId) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID de cuenta requerido' 
            });
        }

        const cuenta = await SWCuenta.findById(cuentaId);

        if (!cuenta) {
            return res.status(404).json({ 
                success: false, 
                message: 'Cuenta no encontrada' 
            });
        }

        // Verificar si es propietario
        const esPropietario = cuenta.propietario.toString() === userId.toString();
        
        // Verificar si es participante
        const participante = await SWParticipante.findOne({
            cuenta: cuentaId,
            usuario: userId,
            activo: true
        });

        if (!esPropietario && !participante) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tiene acceso a esta cuenta' 
            });
        }

        req.cuenta = cuenta;
        req.usuario = await Usuario.findById(userId);
        req.participante = participante;
        req.esPropietario = esPropietario;
        next();
    } catch (error) {
        console.error('Error en requireCuentaAcceso:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar permisos' 
        });
    }
};

// ===== MIDDLEWARES ESPECÍFICOS PARA MÓDULO DE FINANZAS =====

/**
 * Middleware: Gestionar organizaciones (crear, editar, activar/desactivar)
 */
const requireManageOrganizations = requirePermissionOrMasterAdmin('MANAGE_ORGANIZATIONS');

/**
 * Middleware: Ver organizaciones
 */
const requireViewOrganizations = requirePermissionOrMasterAdmin('VIEW_ORGANIZATIONS');

/**
 * Middleware: Crear cuentas
 */
const requireCreateAccounts = requirePermissionOrMasterAdmin('CREATE_ACCOUNTS');

/**
 * Middleware: Editar cuentas
 */
const requireEditAccounts = requirePermissionOrMasterAdmin('EDIT_ACCOUNTS');

/**
 * Middleware: Ver cuentas
 */
const requireViewAccounts = requirePermissionOrMasterAdmin('VIEW_ACCOUNTS');

/**
 * Middleware: Agregar participantes a cuentas
 */
const requireAddParticipants = requirePermissionOrMasterAdmin('ADD_ACCOUNT_PARTICIPANTS');

/**
 * Middleware: Eliminar participantes de cuentas
 */
const requireRemoveParticipants = requirePermissionOrMasterAdmin('REMOVE_ACCOUNT_PARTICIPANTS');

/**
 * Middleware: Ver transacciones
 */
const requireViewTransactions = requirePermissionOrMasterAdmin('VIEW_TRANSACTIONS');

/**
 * Middleware: Exportar transacciones
 */
const requireExportTransactions = requirePermissionOrMasterAdmin('EXPORT_TRANSACTIONS');

module.exports = {
    requireRole,
    requireMasterAdmin,
    requireCuentaPropietario,
    requireCuentaParticipante,
    requireCuentaAcceso,
    requirePermissionOrMasterAdmin,
    // Permisos específicos de Finanzas
    requireManageOrganizations,
    requireViewOrganizations,
    requireCreateAccounts,
    requireEditAccounts,
    requireViewAccounts,
    requireAddParticipants,
    requireRemoveParticipants,
    requireViewTransactions,
    requireExportTransactions
};
