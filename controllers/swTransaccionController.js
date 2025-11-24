const SWTransaccion = require('../models/SWTransaccion');
const SWCuenta = require('../models/SWCuenta');
const SWParticipante = require('../models/SWParticipante');
const { check, validationResult } = require('express-validator');
const { Parser } = require('json2csv');
const ftp = require('basic-ftp');
const fs = require('fs');

// Validadores
const createTransaccionValidators = [
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

/**
 * Crear transacción directa (solo propietario puede aprobar directamente)
 */
const createTransaccion = async (req, res) => {
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

        // Solo el propietario puede crear transacciones directamente aprobadas
        if (cuenta.propietario.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el propietario puede crear transacciones directamente'
            });
        }

        const transaccion = new SWTransaccion({
            cuenta: cuentaId,
            tipo,
            monto,
            concepto,
            descripcion,
            categoria,
            fecha: fecha || new Date(),
            creadoPor: userId,
            aprobada: true,
            aprobadaPor: userId,
            fechaAprobacion: new Date(),
            etiquetas,
            notas,
            imagenes: imagenes || [],
            reservaAsociada
        });

        await transaccion.save();

        // Actualizar saldo de la cuenta
        await cuenta.calcularSaldo();
        await cuenta.save();

        res.status(201).json({
            success: true,
            message: 'Transacción creada exitosamente',
            data: transaccion
        });
    } catch (error) {
        console.error('Error al crear transacción:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la transacción',
            error: error.message
        });
    }
};

/**
 * Obtener transacciones de una cuenta con filtros
 */
const getTransacciones = async (req, res) => {
    try {
        const { cuentaId } = req.params;
        const { 
            tipo, 
            categoria, 
            fechaInicio, 
            fechaFin, 
            page = 1, 
            limit = 20,
            aprobada = 'true'
        } = req.query;

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

        // Verificar permisos
        if (!participante.permisos.puedeVerTransacciones && participante.rol !== 'Propietario') {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para ver las transacciones'
            });
        }

        const filter = { cuenta: cuentaId };
        
        if (aprobada !== undefined) {
            filter.aprobada = aprobada === 'true';
        }
        
        if (tipo) filter.tipo = tipo;
        if (categoria) filter.categoria = categoria;
        
        if (fechaInicio || fechaFin) {
            filter.fecha = {};
            if (fechaInicio) filter.fecha.$gte = new Date(fechaInicio);
            if (fechaFin) filter.fecha.$lte = new Date(fechaFin);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const transacciones = await SWTransaccion.find(filter)
            .populate('creadoPor', 'firstName lastName email')
            .populate('aprobadaPor', 'firstName lastName')
            .sort({ fecha: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await SWTransaccion.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: transacciones,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error al obtener transacciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las transacciones',
            error: error.message
        });
    }
};

/**
 * Obtener una transacción por ID
 */
const getTransaccionById = async (req, res) => {
    try {
        const { id } = req.params;

        const transaccion = await SWTransaccion.findById(id)
            .populate('cuenta', 'nombre')
            .populate('creadoPor', 'firstName lastName email')
            .populate('aprobadaPor', 'firstName lastName email')
            .populate('solicitudOriginal');

        if (!transaccion) {
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada'
            });
        }

        // Verificar acceso
        const userId = req.session.userId;
        const participante = await SWParticipante.findOne({
            cuenta: transaccion.cuenta,
            usuario: userId,
            activo: true
        });

        if (!participante) {
            return res.status(403).json({
                success: false,
                message: 'No tiene acceso a esta transacción'
            });
        }

        res.status(200).json({
            success: true,
            data: transaccion
        });
    } catch (error) {
        console.error('Error al obtener transacción:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la transacción',
            error: error.message
        });
    }
};

/**
 * Actualizar notas/etiquetas de una transacción aprobada
 */
const updateTransaccionNotas = async (req, res) => {
    try {
        const { id } = req.params;
        const { notas, etiquetas } = req.body;

        const transaccion = await SWTransaccion.findById(id);

        if (!transaccion) {
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada'
            });
        }

        // Solo el propietario puede editar
        const userId = req.session.userId;
        const cuenta = await SWCuenta.findById(transaccion.cuenta);
        
        if (cuenta.propietario.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el propietario puede editar transacciones'
            });
        }

        if (notas !== undefined) transaccion.notas = notas;
        if (etiquetas !== undefined) transaccion.etiquetas = etiquetas;

        await transaccion.save();

        res.status(200).json({
            success: true,
            message: 'Transacción actualizada exitosamente',
            data: transaccion
        });
    } catch (error) {
        console.error('Error al actualizar transacción:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al actualizar la transacción',
            error: error.message
        });
    }
};

/**
 * Obtener resumen/estadísticas de una cuenta
 */
const getResumen = async (req, res) => {
    try {
        const { cuentaId } = req.params;
        const { fechaInicio, fechaFin } = req.query;

        const userId = req.session.userId;

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

        if (!participante.permisos.puedeVerSaldo && participante.rol !== 'Propietario') {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para ver el saldo'
            });
        }

        const resumen = await SWTransaccion.obtenerResumen(
            cuentaId,
            fechaInicio ? new Date(fechaInicio) : null,
            fechaFin ? new Date(fechaFin) : null
        );

        const cuenta = await SWCuenta.findById(cuentaId);

        res.status(200).json({
            success: true,
            data: {
                cuenta: {
                    nombre: cuenta.nombre,
                    saldoInicial: cuenta.saldoInicial,
                    saldoActual: cuenta.saldoActual,
                    moneda: cuenta.moneda
                },
                resumen: resumen[0] || {
                    totalIngresos: 0,
                    totalGastos: 0,
                    balance: 0,
                    cantidadTransacciones: 0
                }
            }
        });
    } catch (error) {
        console.error('Error al obtener resumen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el resumen',
            error: error.message
        });
    }
};

/**
 * Obtener transacciones agrupadas por categoría
 */
const getPorCategoria = async (req, res) => {
    try {
        const { cuentaId } = req.params;
        const { fechaInicio, fechaFin } = req.query;

        const userId = req.session.userId;

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

        const porCategoria = await SWTransaccion.obtenerPorCategoria(
            cuentaId,
            fechaInicio ? new Date(fechaInicio) : null,
            fechaFin ? new Date(fechaFin) : null
        );

        res.status(200).json({
            success: true,
            data: porCategoria
        });
    } catch (error) {
        console.error('Error al obtener por categoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener transacciones por categoría',
            error: error.message
        });
    }
};

/**
 * Exportar transacciones a CSV
 */
const exportarCSV = async (req, res) => {
    try {
        const { cuentaId } = req.params;
        const { tipo, categoria, fechaInicio, fechaFin } = req.query;

        const userId = req.session.userId;

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

        const filter = { cuenta: cuentaId, aprobada: true };
        
        if (tipo) filter.tipo = tipo;
        if (categoria) filter.categoria = categoria;
        
        if (fechaInicio || fechaFin) {
            filter.fecha = {};
            if (fechaInicio) filter.fecha.$gte = new Date(fechaInicio);
            if (fechaFin) filter.fecha.$lte = new Date(fechaFin);
        }

        const transacciones = await SWTransaccion.find(filter)
            .populate('creadoPor', 'firstName lastName')
            .sort({ fecha: -1 });

        // Preparar datos para CSV
        const datos = transacciones.map(t => ({
            Fecha: new Date(t.fecha).toLocaleDateString('es-MX'),
            Tipo: t.tipo,
            Categoria: t.categoria,
            Concepto: t.concepto,
            Descripcion: t.descripcion || '',
            Monto: t.monto,
            'Creado Por': `${t.creadoPor.firstName} ${t.creadoPor.lastName}`,
            Notas: t.notas || '',
            Etiquetas: t.etiquetas?.join(', ') || ''
        }));

        const parser = new Parser({
            fields: ['Fecha', 'Tipo', 'Categoria', 'Concepto', 'Descripcion', 'Monto', 'Creado Por', 'Notas', 'Etiquetas']
        });

        const csv = parser.parse(datos);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=transacciones-${cuentaId}-${Date.now()}.csv`);
        res.status(200).send('\uFEFF' + csv); // BOM para UTF-8
    } catch (error) {
        console.error('Error al exportar CSV:', error);
        res.status(500).json({
            success: false,
            message: 'Error al exportar transacciones',
            error: error.message
        });
    }
};

/**
 * Eliminar transacción (solo si no está aprobada y es el creador o propietario)
 */
const deleteTransaccion = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const transaccion = await SWTransaccion.findById(id);

        if (!transaccion) {
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada'
            });
        }

        if (transaccion.aprobada) {
            return res.status(400).json({
                success: false,
                message: 'No se pueden eliminar transacciones aprobadas'
            });
        }

        const cuenta = await SWCuenta.findById(transaccion.cuenta);

        // Solo el creador o el propietario pueden eliminar
        if (transaccion.creadoPor.toString() !== userId.toString() &&
            cuenta.propietario.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para eliminar esta transacción'
            });
        }

        await SWTransaccion.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Transacción eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar transacción:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar la transacción',
            error: error.message
        });
    }
};

/**
 * Subir imágenes de comprobantes para una transacción (máximo 3)
 */
const uploadTransaccionImages = async (req, res) => {
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
            // Eliminar archivos temporales
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            });
            
            return res.status(400).json({
                success: false,
                message: 'Solo se permiten máximo 3 imágenes por transacción'
            });
        }

        // Verificar que la transacción existe
        const transaccion = await SWTransaccion.findById(id);
        if (!transaccion) {
            // Eliminar archivos temporales
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            });
            
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada'
            });
        }

        // Verificar que el usuario tiene permiso (propietario de la cuenta)
        const cuenta = await SWCuenta.findById(transaccion.cuenta);
        if (!cuenta || cuenta.propietario.toString() !== userId.toString()) {
            // Eliminar archivos temporales
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            });
            
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para agregar imágenes a esta transacción'
            });
        }

        // Verificar que no exceda el límite total de 3 imágenes
        const imagenesActuales = transaccion.imagenes?.length || 0;
        if (imagenesActuales + req.files.length > 3) {
            // Eliminar archivos temporales
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            });
            
            return res.status(400).json({
                success: false,
                message: `Esta transacción ya tiene ${imagenesActuales} imagen(es). Solo puede tener máximo 3 imágenes en total`
            });
        }

        // Conectar al servidor FTP
        await client.access({
            host: 'integradev.site',
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        });

        // Cambiar al directorio splitwise
        await client.ensureDir('splitwise');

        const uploadedImages = [];

        // Subir cada archivo
        for (let i = 0; i < req.files.length; i++) {
            const localFilePath = req.files[i].path;
            const timestamp = Date.now();
            const remoteFileName = `transaccion_${id}_${timestamp}_${i}.${req.files[i].originalname.split('.').pop()}`;
            
            await client.uploadFrom(localFilePath, remoteFileName);
            console.log(`Archivo '${remoteFileName}' subido con éxito`);

            // Guardar la ruta relativa
            uploadedImages.push(remoteFileName);

            // Eliminar archivo temporal local
            fs.unlink(localFilePath, (err) => {
                if (err) {
                    console.error('Error al eliminar el archivo local:', err);
                } else {
                    console.log('Archivo local eliminado con éxito');
                }
            });
        }

        // Actualizar la transacción con las nuevas imágenes
        await SWTransaccion.updateOne(
            { _id: id },
            { $push: { imagenes: { $each: uploadedImages } } }
        );

        console.log("Imágenes de transacción subidas con éxito");
        
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
        
        // Limpiar archivos temporales en caso de error
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
 * Eliminar una imagen específica de una transacción
 */
const deleteTransaccionImage = async (req, res) => {
    const client = new ftp.Client();
    
    try {
        const { id, imagenNombre } = req.params;
        const userId = req.session.userId;

        // Verificar que la transacción existe
        const transaccion = await SWTransaccion.findById(id);
        if (!transaccion) {
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada'
            });
        }

        // Verificar que el usuario tiene permiso
        const cuenta = await SWCuenta.findById(transaccion.cuenta);
        if (!cuenta || cuenta.propietario.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para eliminar imágenes de esta transacción'
            });
        }

        // Verificar que la imagen existe en la transacción
        if (!transaccion.imagenes || !transaccion.imagenes.includes(imagenNombre)) {
            return res.status(404).json({
                success: false,
                message: 'La imagen no existe en esta transacción'
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
            // Continuar con la eliminación del registro aunque falle el FTP
        }

        // Eliminar la referencia de la base de datos
        await SWTransaccion.updateOne(
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
    createTransaccionValidators,
    createTransaccion,
    getTransacciones,
    getTransaccionById,
    updateTransaccionNotas,
    getResumen,
    getPorCategoria,
    exportarCSV,
    deleteTransaccion,
    uploadTransaccionImages,
    deleteTransaccionImage
};
