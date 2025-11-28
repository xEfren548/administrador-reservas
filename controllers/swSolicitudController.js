const SWSolicitudTransaccion = require('../models/SWSolicitudTransaccion');
const SWCuenta = require('../models/SWCuenta');
const SWParticipante = require('../models/SWParticipante');
const { check, validationResult } = require('express-validator');
const ftp = require('basic-ftp');
const fs = require('fs');

// Validadores
const createSolicitudValidators = [
    check('cuentaId')
        .notEmpty().withMessage('El ID de la cuenta es requerido')
        .isMongoId().withMessage('ID de cuenta inválido'),
    check('tipo')
        .notEmpty().withMessage('El tipo es requerido')
        .isIn(['Ingreso', 'Gasto']).withMessage('Tipo inválido'),
    check('monto')
        .notEmpty().withMessage('El monto es requerido')
        .isFloat({ min: 0.01 }).withMessage('El monto debe ser mayor a 0'),
    check('concepto')
        .notEmpty().withMessage('El concepto es requerido')
        .isLength({ min: 3, max: 200 }).withMessage('El concepto debe tener entre 3 y 200 caracteres')
        .trim(),
    check('categoria')
        .notEmpty().withMessage('La categoría es requerida')
        .isIn([
            'Alimentación', 'Transporte', 'Servicios', 'Mantenimiento',
            'Compras', 'Salud', 'Entretenimiento', 'Educación', 'Hogar',
            'Salario', 'Venta', 'Inversión', 'Préstamo', 'Reembolso', 'Otro'
        ]).withMessage('Categoría inválida'),
    check('fecha')
        .optional()
        .isISO8601().withMessage('Fecha inválida'),
    check('descripcion')
        .optional()
        .isLength({ max: 1000 }).withMessage('La descripción no puede exceder 1000 caracteres')
        .trim(),
    check('imagenes')
        .optional()
        .isArray().withMessage('Las imágenes deben ser un array'),
    check('imagenes.*')
        .optional()
        .isString().withMessage('Cada imagen debe ser una ruta de texto')
];

const procesarSolicitudValidators = [
    check('accion')
        .notEmpty().withMessage('La acción es requerida')
        .isIn(['aprobar', 'rechazar']).withMessage('Acción inválida'),
    check('comentario')
        .optional()
        .isLength({ max: 500 }).withMessage('El comentario no puede exceder 500 caracteres')
        .trim(),
    check('motivoRechazo')
        .optional()
        .isLength({ max: 500 }).withMessage('El motivo no puede exceder 500 caracteres')
        .trim()
];

/**
 * Crear solicitud de transacción (participantes no propietarios)
 */
const createSolicitud = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { 
            cuentaId, 
            tipo, 
            monto, 
            concepto, 
            descripcion, 
            categoria,
            fecha,
            etiquetas,
            notas,
            imagenes,
            reservaAsociada
        } = req.body;

        const userId = req.session.userId;

        // Verificar que la cuenta existe
        const cuenta = await SWCuenta.findById(cuentaId);
        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        // Verificar que es participante activo de la cuenta
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

        // Si es propietario, debe crear transacciones directamente, no solicitudes
        if (participante.rol === 'Propietario') {
            return res.status(400).json({
                success: false,
                message: 'Los propietarios deben crear transacciones directamente, no solicitudes'
            });
        }

        const solicitud = new SWSolicitudTransaccion({
            cuenta: cuentaId,
            tipo,
            monto,
            concepto,
            descripcion,
            categoria,
            fecha: fecha || new Date(),
            solicitadoPor: userId,
            propietarioCuenta: cuenta.propietario,
            etiquetas,
            notas,
            imagenes: imagenes || [],
            reservaAsociada
        });

        await solicitud.save();

        const solicitudPopulada = await SWSolicitudTransaccion.findById(solicitud._id)
            .populate('solicitadoPor', 'firstName lastName email')
            .populate('propietarioCuenta', 'firstName lastName email')
            .populate('cuenta', 'nombre');

        res.status(201).json({
            success: true,
            message: 'Solicitud creada exitosamente',
            data: solicitudPopulada
        });
    } catch (error) {
        console.error('Error al crear solicitud:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la solicitud',
            error: error.message
        });
    }
};

/**
 * Obtener solicitudes pendientes de una cuenta (propietario)
 */
const getSolicitudesPendientes = async (req, res) => {
    try {
        const { cuentaId } = req.params;
        const userId = req.session.userId;

        const cuenta = await SWCuenta.findById(cuentaId);
        
        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        // Solo el propietario puede ver las solicitudes pendientes
        if (cuenta.propietario.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el propietario puede ver las solicitudes pendientes'
            });
        }

        const solicitudes = await SWSolicitudTransaccion.obtenerPendientesPorCuenta(cuentaId);

        res.status(200).json({
            success: true,
            data: solicitudes
        });
    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las solicitudes',
            error: error.message
        });
    }
};

/**
 * Obtener todas las solicitudes de una cuenta con filtros
 */
const getSolicitudes = async (req, res) => {
    try {
        const { cuentaId } = req.params;
        const { estado, page = 1, limit = 20 } = req.query;
        const userId = req.session.userId;

        // Verificar acceso a la cuenta
        const participante = await SWParticipante.findOne({
            cuenta: cuentaId,
            usuario: userId,
            activo: true
        });

        if (!participante) {
            return res.status(403).json({
                success: false,
                message: 'No tiene acceso a esta cuenta'
            });
        }

        const filter = { cuenta: cuentaId };
        
        if (estado) {
            filter.estado = estado;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const solicitudes = await SWSolicitudTransaccion.find(filter)
            .populate('solicitadoPor', 'firstName lastName email')
            .populate('propietarioCuenta', 'firstName lastName')
            .populate('respuesta.procesadaPor', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await SWSolicitudTransaccion.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: solicitudes,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las solicitudes',
            error: error.message
        });
    }
};

/**
 * Obtener mis solicitudes (del usuario autenticado)
 */
const getMisSolicitudes = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { estado, cuentaId } = req.query;

        let solicitudes;

        if (cuentaId) {
            // Verificar acceso
            const participante = await SWParticipante.findOne({
                cuenta: cuentaId,
                usuario: userId,
                activo: true
            });

            if (!participante) {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene acceso a esta cuenta'
                });
            }

            const filter = {
                cuenta: cuentaId,
                solicitadoPor: userId
            };

            if (estado) filter.estado = estado;

            solicitudes = await SWSolicitudTransaccion.find(filter)
                .populate('cuenta', 'nombre')
                .populate('propietarioCuenta', 'firstName lastName')
                .sort({ createdAt: -1 });
        } else {
            solicitudes = await SWSolicitudTransaccion.obtenerPorUsuario(userId, estado);
        }

        res.status(200).json({
            success: true,
            data: solicitudes
        });
    } catch (error) {
        console.error('Error al obtener mis solicitudes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las solicitudes',
            error: error.message
        });
    }
};

/**
 * Obtener una solicitud por ID
 */
const getSolicitudById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const solicitud = await SWSolicitudTransaccion.findById(id)
            .populate('cuenta', 'nombre')
            .populate('solicitadoPor', 'firstName lastName email')
            .populate('propietarioCuenta', 'firstName lastName email')
            .populate('respuesta.procesadaPor', 'firstName lastName')
            .populate('transaccionCreada');

        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada'
            });
        }

        // Verificar acceso
        const participante = await SWParticipante.findOne({
            cuenta: solicitud.cuenta,
            usuario: userId,
            activo: true
        });

        if (!participante) {
            return res.status(403).json({
                success: false,
                message: 'No tiene acceso a esta solicitud'
            });
        }

        res.status(200).json({
            success: true,
            data: solicitud
        });
    } catch (error) {
        console.error('Error al obtener solicitud:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la solicitud',
            error: error.message
        });
    }
};

/**
 * Procesar solicitud: aprobar o rechazar (solo propietario)
 */
const procesarSolicitud = async (req, res) => {
    const client = new ftp.Client();
    
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Limpiar archivo temporal si existe
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            }
            
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { id } = req.params;
        const { accion, comentario, motivoRechazo } = req.body;
        const userId = req.session.userId;

        const solicitud = await SWSolicitudTransaccion.findById(id);

        if (!solicitud) {
            // Limpiar archivo temporal si existe
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            }
            
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada'
            });
        }

        if (solicitud.estado !== 'Pendiente') {
            // Limpiar archivo temporal si existe
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            }
            
            return res.status(400).json({
                success: false,
                message: 'La solicitud ya fue procesada'
            });
        }

        // Verificar que es el propietario
        const cuenta = await SWCuenta.findById(solicitud.cuenta);
        if (cuenta.propietario.toString() !== userId.toString()) {
            // Limpiar archivo temporal si existe
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            }
            
            return res.status(403).json({
                success: false,
                message: 'Solo el propietario puede procesar solicitudes'
            });
        }

        let resultado;

        if (accion === 'aprobar') {
            // Procesar comprobante de confirmación si se subió
            let comprobanteConfirmacion = null;
            
            if (req.file) {
                try {
                    // Conectar al servidor FTP
                    await client.access({
                        host: 'integradev.site',
                        user: process.env.FTP_USER,
                        password: process.env.FTP_PASSWORD,
                        secure: false
                    });

                    await client.ensureDir('splitwise');

                    // Subir archivo al FTP
                    const localFilePath = req.file.path;
                    const timestamp = Date.now();
                    const remoteFileName = `comprobante_confirmacion_${id}_${timestamp}.${req.file.originalname.split('.').pop()}`;
                    
                    await client.uploadFrom(localFilePath, remoteFileName);
                    console.log(`Comprobante de confirmación '${remoteFileName}' subido con éxito al FTP`);

                    comprobanteConfirmacion = {
                        nombre: req.file.originalname,
                        url: remoteFileName,
                        tipo: req.file.mimetype,
                        fechaSubida: new Date()
                    };

                    // Eliminar archivo local temporal
                    fs.unlink(localFilePath, (err) => {
                        if (err) {
                            console.error('Error al eliminar el archivo local:', err);
                        } else {
                            console.log('Archivo local eliminado con éxito');
                        }
                    });
                } catch (ftpError) {
                    console.error('Error al subir comprobante al FTP:', ftpError);
                    // Limpiar archivo local
                    if (req.file && req.file.path) {
                        fs.unlink(req.file.path, (err) => {
                            if (err) console.error('Error al eliminar archivo temporal:', err);
                        });
                    }
                    
                    return res.status(500).json({
                        success: false,
                        message: 'Error al subir el comprobante de confirmación'
                    });
                } finally {
                    client.close();
                }
            }
            
            resultado = await solicitud.aprobar(userId, comentario, comprobanteConfirmacion);
            
            res.status(200).json({
                success: true,
                message: 'Solicitud aprobada exitosamente',
                data: {
                    solicitud: await SWSolicitudTransaccion.findById(id)
                        .populate('solicitadoPor', 'firstName lastName')
                        .populate('transaccionCreada'),
                    transaccion: resultado
                }
            });
        } else if (accion === 'rechazar') {
            resultado = await solicitud.rechazar(userId, motivoRechazo || comentario);
            
            res.status(200).json({
                success: true,
                message: 'Solicitud rechazada',
                data: resultado
            });
        }
    } catch (error) {
        console.error('Error al procesar solicitud:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al procesar la solicitud',
            error: error.message
        });
    }
};

/**
 * Cancelar solicitud (solo el solicitante si está pendiente)
 */
const cancelarSolicitud = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const solicitud = await SWSolicitudTransaccion.findById(id);

        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada'
            });
        }

        if (solicitud.estado !== 'Pendiente') {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden cancelar solicitudes pendientes'
            });
        }

        if (solicitud.solicitadoPor.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el solicitante puede cancelar la solicitud'
            });
        }

        await solicitud.cancelar(userId);

        res.status(200).json({
            success: true,
            message: 'Solicitud cancelada exitosamente',
            data: solicitud
        });
    } catch (error) {
        console.error('Error al cancelar solicitud:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al cancelar la solicitud',
            error: error.message
        });
    }
};

/**
 * Actualizar solicitud pendiente (solo el solicitante)
 */
const updateSolicitud = async (req, res) => {
    try {
        const { id } = req.params;
        const { monto, concepto, descripcion, categoria, fecha, notas, etiquetas } = req.body;
        const userId = req.session.userId;

        const solicitud = await SWSolicitudTransaccion.findById(id);

        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada'
            });
        }

        if (solicitud.estado !== 'Pendiente') {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden editar solicitudes pendientes'
            });
        }

        if (solicitud.solicitadoPor.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el solicitante puede editar la solicitud'
            });
        }

        if (monto !== undefined) solicitud.monto = monto;
        if (concepto !== undefined) solicitud.concepto = concepto;
        if (descripcion !== undefined) solicitud.descripcion = descripcion;
        if (categoria !== undefined) solicitud.categoria = categoria;
        if (fecha !== undefined) solicitud.fecha = fecha;
        if (notas !== undefined) solicitud.notas = notas;
        if (etiquetas !== undefined) solicitud.etiquetas = etiquetas;

        await solicitud.save();

        res.status(200).json({
            success: true,
            message: 'Solicitud actualizada exitosamente',
            data: solicitud
        });
    } catch (error) {
        console.error('Error al actualizar solicitud:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar la solicitud',
            error: error.message
        });
    }
};

/**
 * Obtener estadísticas de solicitudes de una cuenta
 */
const getEstadisticasSolicitudes = async (req, res) => {
    try {
        const { cuentaId } = req.params;
        const userId = req.session.userId;

        // Verificar acceso
        const cuenta = await SWCuenta.findById(cuentaId);
        
        if (!cuenta) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        if (cuenta.propietario.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el propietario puede ver estas estadísticas'
            });
        }

        const estadisticas = await SWSolicitudTransaccion.aggregate([
            { $match: { cuenta: cuenta._id } },
            {
                $group: {
                    _id: '$estado',
                    cantidad: { $sum: 1 },
                    montoTotal: { $sum: '$monto' }
                }
            }
        ]);

        const pendientes = await SWSolicitudTransaccion.countDocuments({
            cuenta: cuentaId,
            estado: 'Pendiente'
        });

        res.status(200).json({
            success: true,
            data: {
                estadisticas,
                pendientes
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

/**
 * Subir imágenes de comprobantes para una solicitud (máximo 3)
 */
const uploadSolicitudImages = async (req, res) => {
    const client = new ftp.Client();
    
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        // Validar que hay archivos
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron archivos'
            });
        }

        // Limitar a 3 imágenes
        if (req.files.length > 3) {
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            });
            
            return res.status(400).json({
                success: false,
                message: 'Solo se permiten máximo 3 imágenes por solicitud'
            });
        }

        // Verificar que la solicitud existe
        const solicitud = await SWSolicitudTransaccion.findById(id);
        if (!solicitud) {
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            });
            
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada'
            });
        }

        // Verificar que el usuario tiene permiso (creador de la solicitud)
        if (solicitud.solicitadoPor.toString() !== userId.toString()) {
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            });
            
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para agregar imágenes a esta solicitud'
            });
        }

        // Verificar que no exceda el límite total de 3 imágenes
        const imagenesActuales = solicitud.imagenes?.length || 0;
        if (imagenesActuales + req.files.length > 3) {
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            });
            
            return res.status(400).json({
                success: false,
                message: `Esta solicitud ya tiene ${imagenesActuales} imagen(es). Solo puede tener máximo 3 imágenes en total`
            });
        }

        // Conectar al servidor FTP
        await client.access({
            host: 'integradev.site',
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        });

        await client.ensureDir('splitwise');

        const uploadedImages = [];

        // Subir cada archivo
        for (let i = 0; i < req.files.length; i++) {
            const localFilePath = req.files[i].path;
            const timestamp = Date.now();
            const remoteFileName = `solicitud_${id}_${timestamp}_${i}.${req.files[i].originalname.split('.').pop()}`;
            
            await client.uploadFrom(localFilePath, remoteFileName);
            console.log(`Archivo '${remoteFileName}' subido con éxito`);

            uploadedImages.push(remoteFileName);

            fs.unlink(localFilePath, (err) => {
                if (err) {
                    console.error('Error al eliminar el archivo local:', err);
                } else {
                    console.log('Archivo local eliminado con éxito');
                }
            });
        }

        // Actualizar la solicitud con las nuevas imágenes
        await SWSolicitudTransaccion.updateOne(
            { _id: id },
            { $push: { imagenes: { $each: uploadedImages } } }
        );

        console.log("Imágenes de solicitud subidas con éxito");
        
        res.status(200).json({
            success: true,
            message: 'Imágenes subidas con éxito',
            data: {
                imagenesSubidas: uploadedImages.length,
                rutas: uploadedImages
            }
        });

    } catch (error) {
        console.error("Error al subir imágenes:", error);
        
        if (req.files) {
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error al subir las imágenes',
            error: error.message
        });
    } finally {
        client.close();
    }
};

/**
 * Eliminar una imagen específica de una solicitud
 */
const deleteSolicitudImage = async (req, res) => {
    const client = new ftp.Client();
    
    try {
        const { id, imagenNombre } = req.params;
        const userId = req.session.userId;

        const solicitud = await SWSolicitudTransaccion.findById(id);
        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada'
            });
        }

        // Verificar que el usuario tiene permiso
        if (solicitud.solicitadoPor.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para eliminar imágenes de esta solicitud'
            });
        }

        // Verificar que la imagen existe
        if (!solicitud.imagenes || !solicitud.imagenes.includes(imagenNombre)) {
            return res.status(404).json({
                success: false,
                message: 'La imagen no existe en esta solicitud'
            });
        }

        // Conectar al servidor FTP y eliminar el archivo
        await client.access({
            host: 'integradev.site',
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        });

        await client.ensureDir('splitwise');
        
        try {
            await client.remove(imagenNombre);
            console.log(`Archivo '${imagenNombre}' eliminado del servidor FTP`);
        } catch (ftpError) {
            console.warn('No se pudo eliminar el archivo del servidor FTP:', ftpError.message);
        }

        // Eliminar la referencia de la base de datos
        await SWSolicitudTransaccion.updateOne(
            { _id: id },
            { $pull: { imagenes: imagenNombre } }
        );

        res.status(200).json({
            success: true,
            message: 'Imagen eliminada con éxito'
        });

    } catch (error) {
        console.error("Error al eliminar imagen:", error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar la imagen',
            error: error.message
        });
    } finally {
        client.close();
    }
};

module.exports = {
    createSolicitudValidators,
    procesarSolicitudValidators,
    createSolicitud,
    getSolicitudesPendientes,
    getSolicitudes,
    getMisSolicitudes,
    getSolicitudById,
    procesarSolicitud,
    cancelarSolicitud,
    updateSolicitud,
    getEstadisticasSolicitudes,
    uploadSolicitudImages,
    deleteSolicitudImage
};
