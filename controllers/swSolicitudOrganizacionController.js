const mongoose = require('mongoose');
const SWSolicitudOrganizacion = require('../models/SWSolicitudOrganizacion');
const SWCuenta = require('../models/SWCuenta');
const SWOrganizacion = require('../models/SWOrganizacion');
const SWTransaccion = require('../models/SWTransaccion');
const { check, validationResult } = require('express-validator');
const moment = require('moment-timezone');
const ftp = require('basic-ftp');
const fs = require('fs');
const { isCategoriaValida } = require('../services/swCategoriasService');

const MEXICO_CENTRO_TIMEZONE = 'America/Mexico_City';
const FECHA_SOLO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const WORKFLOW_VERSION_OWNER_CONFIRMATION = 2;
const ESTADO_PENDIENTE_CONFIRMACION_DUENO = 'PendienteConfirmacionDueno';

function crearErrorFechaInvalida() {
    const error = new Error('Fecha inválida');
    error.statusCode = 400;
    return error;
}

function obtenerStatusCodeErrorSolicitudOrganizacional(error) {
    if (error.statusCode) {
        return error.statusCode;
    }

    if (error.name === 'ValidationError' || error.name === 'CastError') {
        return 400;
    }

    const message = error.message || '';
    const businessErrorPatterns = [
        'Saldo insuficiente',
        'No tiene acceso',
        'Solo el propietario',
        'La cuenta destino es requerida',
        'No se puede transferir',
        'Debes validar la compra',
        'Debes subir un comprobante',
        'La solicitud no está pendiente',
        'Solo se pueden aprobar solicitudes pendientes',
        'Solo se pueden rechazar solicitudes pendientes'
    ];

    if (businessErrorPatterns.some((pattern) => message.includes(pattern))) {
        return 400;
    }

    return 500;
}

function normalizarFechaSolicitud(fecha) {
    if (!fecha) {
        return new Date();
    }

    if (typeof fecha === 'string' && FECHA_SOLO_REGEX.test(fecha)) {
        const fechaMexico = moment.tz(fecha, 'YYYY-MM-DD', true, MEXICO_CENTRO_TIMEZONE);

        if (!fechaMexico.isValid()) {
            throw crearErrorFechaInvalida();
        }

        return fechaMexico.startOf('day').toDate();
    }

    const fechaNormalizada = moment(fecha);

    if (!fechaNormalizada.isValid()) {
        throw crearErrorFechaInvalida();
    }

    return fechaNormalizada.toDate();
}

function esMismoId(valueA, valueB) {
    if (!valueA || !valueB) {
        return false;
    }

    return valueA.toString() === valueB.toString();
}

function esWorkflowOwnerConfirmation(solicitud) {
    return Number(solicitud.workflowVersion || 1) >= WORKFLOW_VERSION_OWNER_CONFIRMATION;
}

function puedeAccederComoPropietarioCuenta(solicitud, userId) {
    return esWorkflowOwnerConfirmation(solicitud) && esMismoId(solicitud.propietarioCuenta, userId);
}

function poblarSolicitudOrganizacion(query) {
    return query
        .populate('organizacion', 'nombre')
        .populate('cuenta', 'nombre moneda saldoActual propietario')
        .populate('cuentaDestino', 'nombre moneda saldoActual propietario')
        .populate('solicitadoPor', 'firstName lastName email')
        .populate('propietarioCuenta', 'firstName lastName email')
        .populate('aprobacionAdministrativa.procesadaPor', 'firstName lastName email')
        .populate('confirmacionDueno.confirmadoPor', 'firstName lastName email')
        .populate('respuesta.procesadaPor', 'firstName lastName email')
        .populate('transaccionCreada');
}

async function subirArchivoConfirmacion(file, solicitudId) {
    if (!file) {
        return null;
    }

    const client = new ftp.Client();

    try {
        await client.access({
            host: 'integradev.site',
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        });

        await client.ensureDir('splitwise');

        const extension = file.originalname.split('.').pop();
        const remoteFileName = `solicitud_org_confirmacion_${solicitudId}_${Date.now()}.${extension}`;
        await client.uploadFrom(file.path, remoteFileName);

        return {
            nombre: file.originalname,
            url: remoteFileName,
            tipo: file.mimetype,
            fechaSubida: new Date()
        };
    } finally {
        client.close();
        fs.unlink(file.path, () => {});
    }
}

const createSolicitudOrganizacionValidators = [
    check('organizacionId')
        .notEmpty().withMessage('El ID de la organización es requerido')
        .isMongoId().withMessage('ID de organización inválido'),
    check('cuentaId')
        .notEmpty().withMessage('El ID de la cuenta es requerido')
        .isMongoId().withMessage('ID de cuenta inválido'),
    check('tipo')
        .notEmpty().withMessage('El tipo es requerido')
        .isIn(['Ingreso', 'Gasto', 'Transferencia']).withMessage('Tipo inválido'),
    check('monto')
        .notEmpty().withMessage('El monto es requerido')
        .isFloat({ min: 0.01 }).withMessage('El monto debe ser mayor a 0'),
    check('concepto')
        .notEmpty().withMessage('El concepto es requerido')
        .isLength({ min: 3, max: 200 }).withMessage('El concepto debe tener entre 3 y 200 caracteres')
        .trim(),
    check('categoria')
        .optional()
        .custom((value) => {
            if (!isCategoriaValida(value)) {
                throw new Error('Categoría inválida');
            }
            return true;
        }),
    check('cuentaDestinoId')
        .if(check('tipo').equals('Transferencia'))
        .notEmpty().withMessage('La cuenta destino es requerida para transferencias')
        .isMongoId().withMessage('ID de cuenta destino inválido'),
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
        .isString().withMessage('Cada imagen debe ser una ruta de texto'),
    check('esProveedorExterno')
        .optional()
        .isBoolean().withMessage('El indicador de proveedor externo debe ser booleano'),
    check('proveedorNombre')
        .if((value, { req }) => req.body.esProveedorExterno === true || req.body.esProveedorExterno === 'true')
        .notEmpty().withMessage('El nombre del proveedor es requerido')
        .isLength({ min: 2, max: 150 }).withMessage('El nombre del proveedor debe tener entre 2 y 150 caracteres')
        .trim(),
    check('proveedorBeneficiario')
        .if((value, { req }) => req.body.esProveedorExterno === true || req.body.esProveedorExterno === 'true')
        .notEmpty().withMessage('El beneficiario es requerido')
        .isLength({ min: 2, max: 150 }).withMessage('El beneficiario debe tener entre 2 y 150 caracteres')
        .trim(),
    check('proveedorBanco')
        .if((value, { req }) => req.body.esProveedorExterno === true || req.body.esProveedorExterno === 'true')
        .notEmpty().withMessage('El banco es requerido')
        .isLength({ min: 2, max: 120 }).withMessage('El banco debe tener entre 2 y 120 caracteres')
        .trim(),
    check('proveedorCuentaClabe')
        .if((value, { req }) => req.body.esProveedorExterno === true || req.body.esProveedorExterno === 'true')
        .notEmpty().withMessage('La cuenta bancaria o CLABE es requerida')
        .isLength({ min: 6, max: 30 }).withMessage('La cuenta bancaria o CLABE debe tener entre 6 y 30 caracteres')
        .trim()
];

const procesarSolicitudOrganizacionValidators = [
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

const confirmarSolicitudOrganizacionDuenoValidators = [
    check('comentario')
        .optional()
        .isLength({ max: 500 }).withMessage('El comentario no puede exceder 500 caracteres')
        .trim(),
    check('validacionCompra')
        .optional()
        .customSanitizer((value) => value === true || value === 'true')
];

const rechazarSolicitudOrganizacionDuenoValidators = [
    check('motivoRechazo')
        .notEmpty().withMessage('El motivo de rechazo es requerido')
        .isLength({ max: 500 }).withMessage('El motivo no puede exceder 500 caracteres')
        .trim()
];

const getOrganizacionContext = async (organizacionId, userId) => {
    const organizacion = await SWOrganizacion.findById(organizacionId);
    if (!organizacion) {
        const error = new Error('Organización no encontrada');
        error.statusCode = 404;
        throw error;
    }

    const participanteActual = (organizacion.participantes || []).find(
        (participante) => participante.usuario.toString() === userId.toString()
    );

    if (!participanteActual) {
        const error = new Error('No pertenece a esta organización');
        error.statusCode = 403;
        throw error;
    }

    const adminCount = (organizacion.participantes || []).filter(
        (participante) => participante.rol === 'Administrador'
    ).length;

    return {
        organizacion,
        participanteActual,
        adminCount
    };
};

const createSolicitudOrganizacion = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const {
            organizacionId,
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
            cuentaDestinoId,
            esProveedorExterno,
            proveedorNombre,
            proveedorBeneficiario,
            proveedorBanco,
            proveedorCuentaClabe
        } = req.body;

        const esPagoProveedorExterno = esProveedorExterno === true || esProveedorExterno === 'true';

        const userId = req.session.userId;
        const fechaSolicitud = normalizarFechaSolicitud(fecha);

        const { participanteActual, adminCount } = await getOrganizacionContext(organizacionId, userId);

        const cuenta = await SWCuenta.findById(cuentaId);
        if (!cuenta || !cuenta.activa) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada o inactiva'
            });
        }

        if (cuenta.organizacion.toString() !== organizacionId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'La cuenta no pertenece a la organización seleccionada'
            });
        }

        let cuentaDestino = null;
        let propietarioCuentaId = cuenta.propietario;

        if (tipo === 'Transferencia') {
            cuentaDestino = await SWCuenta.findById(cuentaDestinoId);

            if (!cuentaDestino || !cuentaDestino.activa) {
                return res.status(404).json({
                    success: false,
                    message: 'Cuenta destino no encontrada o inactiva'
                });
            }

            if (cuenta._id.toString() === cuentaDestino._id.toString()) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede transferir a la misma cuenta'
                });
            }

            if (cuenta.moneda !== cuentaDestino.moneda) {
                return res.status(400).json({
                    success: false,
                    message: `No se puede transferir entre cuentas con diferentes monedas (${cuenta.moneda} → ${cuentaDestino.moneda})`
                });
            }

            if (cuentaDestino.organizacion.toString() !== organizacionId.toString()) {
                const organizacionDestino = await SWOrganizacion.findById(cuentaDestino.organizacion);
                const participaEnDestino = (organizacionDestino?.participantes || []).some(
                    (participante) => participante.usuario.toString() === userId.toString()
                );

                if (!participaEnDestino) {
                    return res.status(403).json({
                        success: false,
                        message: 'Solo puede transferir hacia organizaciones donde participa'
                    });
                }
            }

            propietarioCuentaId = cuentaDestino.propietario;
        }

        const esPropietarioConfirmador = esMismoId(propietarioCuentaId, userId);

        if (participanteActual.rol === 'Administrador' && adminCount <= 1 && esPropietarioConfirmador) {
            let resultadoDirecto;

            if (tipo === 'Transferencia') {
                resultadoDirecto = await SWTransaccion.crearTransferencia(
                    cuentaId,
                    cuentaDestinoId,
                    monto,
                    concepto,
                    descripcion,
                    userId,
                    false,
                    {
                        esProveedorExterno: esPagoProveedorExterno,
                        proveedor: esPagoProveedorExterno
                            ? {
                                nombre: proveedorNombre,
                                beneficiario: proveedorBeneficiario,
                                banco: proveedorBanco,
                                cuentaClabe: proveedorCuentaClabe
                            }
                            : undefined
                    }
                );

                return res.status(201).json({
                    success: true,
                    mode: 'directa',
                    message: 'Transacción creada directamente (organización con administrador único)',
                    data: {
                        transaccionOrigen: resultadoDirecto.origen,
                        transaccionDestino: resultadoDirecto.destino
                    }
                });
            }

            const transaccion = new SWTransaccion({
                cuenta: cuentaId,
                tipo,
                monto,
                concepto,
                descripcion,
                categoria,
                fecha: fechaSolicitud,
                creadoPor: userId,
                aprobada: true,
                aprobadaPor: userId,
                fechaAprobacion: new Date(),
                etiquetas,
                notas,
                imagenes: imagenes || [],
                esProveedorExterno: esPagoProveedorExterno,
                proveedor: esPagoProveedorExterno
                    ? {
                        nombre: proveedorNombre,
                        beneficiario: proveedorBeneficiario,
                        banco: proveedorBanco,
                        cuentaClabe: proveedorCuentaClabe
                    }
                    : undefined
            });

            await transaccion.save();
            await cuenta.calcularSaldo();
            await cuenta.save();

            return res.status(201).json({
                success: true,
                mode: 'directa',
                message: 'Transacción creada directamente (organización con administrador único)',
                data: transaccion
            });
        }

        const solicitud = new SWSolicitudOrganizacion({
            organizacion: organizacionId,
            cuenta: cuentaId,
            tipo,
            monto,
            concepto,
            descripcion,
            categoria,
            fecha: fechaSolicitud,
            solicitadoPor: userId,
            propietarioCuenta: propietarioCuentaId,
            rolSolicitante: participanteActual.rol,
            workflowVersion: WORKFLOW_VERSION_OWNER_CONFIRMATION,
            cuentaDestino: cuentaDestinoId || undefined,
            etiquetas,
            notas,
            imagenes: imagenes || [],
            esProveedorExterno: esPagoProveedorExterno,
            proveedorNombre: esPagoProveedorExterno ? proveedorNombre : undefined,
            proveedorBeneficiario: esPagoProveedorExterno ? proveedorBeneficiario : undefined,
            proveedorBanco: esPagoProveedorExterno ? proveedorBanco : undefined,
            proveedorCuentaClabe: esPagoProveedorExterno ? proveedorCuentaClabe : undefined,
            confirmacionDueno: {
                requerida: !esPropietarioConfirmador
            }
        });

        await solicitud.save();

        if (participanteActual.rol === 'Administrador' && adminCount <= 1 && !esPropietarioConfirmador) {
            await solicitud.aprobarAdministrativamente(
                userId,
                'Aprobación administrativa automática por administrador único'
            );

            const solicitudAutoAprobada = await poblarSolicitudOrganizacion(
                SWSolicitudOrganizacion.findById(solicitud._id)
            );

            return res.status(201).json({
                success: true,
                mode: 'solicitud',
                message: 'Solicitud organizacional creada y aprobada administrativamente de forma automática; pendiente de confirmación del dueño de la cuenta',
                data: {
                    solicitud: solicitudAutoAprobada,
                    requiereConfirmacionDueno: true,
                    aprobacionAdministrativaAutomatica: true
                }
            });
        }

        const solicitudPopulada = await poblarSolicitudOrganizacion(
            SWSolicitudOrganizacion.findById(solicitud._id)
        );

        return res.status(201).json({
            success: true,
            mode: 'solicitud',
            message: 'Solicitud organizacional creada exitosamente',
            data: solicitudPopulada
        });
    } catch (error) {
        console.error('Error al crear solicitud organizacional:', error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al crear la solicitud organizacional' : error.message,
            error: error.message
        });
    }
};

const getSolicitudesOrganizacion = async (req, res) => {
    try {
        const { organizacionId } = req.params;
        const { estado, page = 1, limit = 20 } = req.query;
        const userId = req.session.userId;

        await getOrganizacionContext(organizacionId, userId);

        const filter = { organizacion: organizacionId };
        if (estado) filter.estado = estado;

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        const solicitudes = await poblarSolicitudOrganizacion(
            SWSolicitudOrganizacion.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit, 10))
        );

        const total = await SWSolicitudOrganizacion.countDocuments(filter);

        return res.status(200).json({
            success: true,
            data: solicitudes,
            pagination: {
                total,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                pages: Math.ceil(total / parseInt(limit, 10))
            }
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al obtener solicitudes organizacionales' : error.message,
            error: error.message
        });
    }
};

const getSolicitudesPendientesOrganizacion = async (req, res) => {
    try {
        const { organizacionId } = req.params;
        const userId = req.session.userId;

        const { participanteActual } = await getOrganizacionContext(organizacionId, userId);

        if (participanteActual.rol !== 'Administrador') {
            return res.status(403).json({
                success: false,
                message: 'Solo administradores pueden ver solicitudes pendientes de organización'
            });
        }

        const solicitudes = await poblarSolicitudOrganizacion(SWSolicitudOrganizacion.find({
            organizacion: organizacionId,
            estado: 'Pendiente'
        })
            .sort({ createdAt: -1 }));

        return res.status(200).json({
            success: true,
            data: solicitudes
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al obtener solicitudes pendientes' : error.message,
            error: error.message
        });
    }
};

const getMisSolicitudesOrganizacion = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { estado, organizacionId } = req.query;

        const filter = { solicitadoPor: userId };
        if (estado) filter.estado = estado;

        if (organizacionId) {
            await getOrganizacionContext(organizacionId, userId);
            filter.organizacion = organizacionId;
        }

        const solicitudes = await poblarSolicitudOrganizacion(
            SWSolicitudOrganizacion.find(filter)
                .sort({ createdAt: -1 })
        );

        return res.status(200).json({
            success: true,
            data: solicitudes
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al obtener mis solicitudes organizacionales' : error.message,
            error: error.message
        });
    }
};

const getSolicitudOrganizacionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const solicitud = await poblarSolicitudOrganizacion(
            SWSolicitudOrganizacion.findById(id)
        );

        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud organizacional no encontrada'
            });
        }

        if (!puedeAccederComoPropietarioCuenta(solicitud, userId)) {
            await getOrganizacionContext(solicitud.organizacion._id, userId);
        }

        return res.status(200).json({
            success: true,
            data: solicitud
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al obtener la solicitud organizacional' : error.message,
            error: error.message
        });
    }
};

const procesarSolicitudOrganizacion = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { id } = req.params;
        const { accion, comentario, motivoRechazo } = req.body;
        const userId = req.session.userId;

        const solicitud = await SWSolicitudOrganizacion.findById(id);

        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud organizacional no encontrada'
            });
        }

        const { participanteActual, adminCount } = await getOrganizacionContext(
            solicitud.organizacion,
            userId
        );

        if (participanteActual.rol !== 'Administrador') {
            return res.status(403).json({
                success: false,
                message: 'Solo administradores pueden procesar solicitudes organizacionales'
            });
        }

        if (solicitud.estado !== 'Pendiente') {
            return res.status(400).json({
                success: false,
                message: 'La solicitud ya fue procesada'
            });
        }

        if (
            solicitud.rolSolicitante === 'Administrador' &&
            adminCount >= 2 &&
            solicitud.solicitadoPor.toString() === userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: 'La solicitud iniciada por administrador debe ser aprobada por otro administrador'
            });
        }

        if (accion === 'aprobar') {
            if (esWorkflowOwnerConfirmation(solicitud)) {
                solicitud.aprobacionAdministrativa = {
                    procesadaPor: userId,
                    fechaRespuesta: new Date(),
                    comentario: comentario || ''
                };

                if (esMismoId(solicitud.propietarioCuenta, userId)) {
                    const transaccion = await solicitud.aprobar(userId, comentario);
                    const solicitudActualizada = await poblarSolicitudOrganizacion(
                        SWSolicitudOrganizacion.findById(id)
                    );

                    return res.status(200).json({
                        success: true,
                        message: 'Solicitud organizacional aprobada y confirmada por el dueño de la cuenta',
                        data: {
                            solicitud: solicitudActualizada,
                            transaccion
                        }
                    });
                }

                await solicitud.aprobarAdministrativamente(userId, comentario);
                const solicitudActualizada = await poblarSolicitudOrganizacion(
                    SWSolicitudOrganizacion.findById(id)
                );

                return res.status(200).json({
                    success: true,
                    message: 'Solicitud organizacional aprobada administrativamente y pendiente de confirmación del dueño de la cuenta',
                    data: {
                        solicitud: solicitudActualizada,
                        requiereConfirmacionDueno: true
                    }
                });
            }

            const transaccion = await solicitud.aprobar(userId, comentario);

            const solicitudActualizada = await poblarSolicitudOrganizacion(
                SWSolicitudOrganizacion.findById(id)
            );

            return res.status(200).json({
                success: true,
                message: 'Solicitud organizacional aprobada exitosamente',
                data: {
                    solicitud: solicitudActualizada,
                    transaccion
                }
            });
        }

        const resultado = await solicitud.rechazar(userId, motivoRechazo || comentario);
        return res.status(200).json({
            success: true,
            message: 'Solicitud organizacional rechazada',
            data: resultado
        });
    } catch (error) {
        console.error('Error al procesar solicitud organizacional:', error);
        const statusCode = obtenerStatusCodeErrorSolicitudOrganizacional(error);
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al procesar solicitud organizacional' : error.message,
            error: error.message
        });
    }
};

const getSolicitudesPendientesConfirmacionDueno = async (req, res) => {
    try {
        const userId = req.session.userId;

        const solicitudes = await poblarSolicitudOrganizacion(
            SWSolicitudOrganizacion.find({
                workflowVersion: { $gte: WORKFLOW_VERSION_OWNER_CONFIRMATION },
                propietarioCuenta: userId,
                estado: ESTADO_PENDIENTE_CONFIRMACION_DUENO
            }).sort({ createdAt: -1 })
        );

        return res.status(200).json({
            success: true,
            data: solicitudes
        });
    } catch (error) {
        console.error('Error al obtener solicitudes pendientes de confirmación del dueño:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener solicitudes pendientes de confirmación del dueño',
            error: error.message
        });
    }
};

const confirmarSolicitudOrganizacionDueno = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;
        const comentario = req.body.comentario || '';
        const validacionCompra = req.body.validacionCompra === true || req.body.validacionCompra === 'true';

        const solicitud = await SWSolicitudOrganizacion.findById(id);

        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud organizacional no encontrada'
            });
        }

        if (!puedeAccederComoPropietarioCuenta(solicitud, userId)) {
            return res.status(403).json({
                success: false,
                message: 'Solo el dueño de la cuenta puede confirmar esta solicitud'
            });
        }

        const comprobanteConfirmacion = await subirArchivoConfirmacion(req.file, id);
        const transaccion = await solicitud.confirmarPorDueno(userId, {
            comentario,
            validacionCompra,
            comprobanteConfirmacion
        });

        const solicitudActualizada = await poblarSolicitudOrganizacion(
            SWSolicitudOrganizacion.findById(id)
        );

        return res.status(200).json({
            success: true,
            message: 'Solicitud confirmada por el dueño de la cuenta',
            data: {
                solicitud: solicitudActualizada,
                transaccion
            }
        });
    } catch (error) {
        console.error('Error al confirmar solicitud organizacional por dueño:', error);

        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al confirmar la solicitud organizacional' : error.message,
            error: error.message
        });
    }
};

const rechazarSolicitudOrganizacionDueno = async (req, res) => {
    try {
        const { id } = req.params;
        const { motivoRechazo } = req.body;
        const userId = req.session.userId;

        const solicitud = await SWSolicitudOrganizacion.findById(id);

        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud organizacional no encontrada'
            });
        }

        if (!puedeAccederComoPropietarioCuenta(solicitud, userId)) {
            return res.status(403).json({
                success: false,
                message: 'Solo el dueño de la cuenta puede rechazar esta solicitud'
            });
        }

        await solicitud.rechazarPorDueno(userId, motivoRechazo);

        return res.status(200).json({
            success: true,
            message: 'Solicitud rechazada por el dueño de la cuenta',
            data: solicitud
        });
    } catch (error) {
        console.error('Error al rechazar solicitud organizacional por dueño:', error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al rechazar la solicitud organizacional' : error.message,
            error: error.message
        });
    }
};

const cancelarSolicitudOrganizacion = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;

        const solicitud = await SWSolicitudOrganizacion.findById(id);

        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud organizacional no encontrada'
            });
        }

        await getOrganizacionContext(solicitud.organizacion, userId);

        if (solicitud.solicitadoPor.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el solicitante puede cancelar la solicitud'
            });
        }

        await solicitud.cancelar(userId);

        return res.status(200).json({
            success: true,
            message: 'Solicitud organizacional cancelada exitosamente',
            data: solicitud
        });
    } catch (error) {
        console.error('Error al cancelar solicitud organizacional:', error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al cancelar solicitud organizacional' : error.message,
            error: error.message
        });
    }
};

const getEstadisticasSolicitudesOrganizacion = async (req, res) => {
    try {
        const { organizacionId } = req.params;
        const userId = req.session.userId;

        const { participanteActual } = await getOrganizacionContext(organizacionId, userId);

        if (participanteActual.rol !== 'Administrador') {
            return res.status(403).json({
                success: false,
                message: 'Solo administradores pueden ver estadísticas organizacionales'
            });
        }

        const estadisticas = await SWSolicitudOrganizacion.aggregate([
            { $match: { organizacion: new mongoose.Types.ObjectId(organizacionId) } },
            {
                $group: {
                    _id: '$estado',
                    cantidad: { $sum: 1 },
                    montoTotal: { $sum: '$monto' }
                }
            }
        ]);

        const pendientes = await SWSolicitudOrganizacion.countDocuments({
            organizacion: organizacionId,
            estado: 'Pendiente'
        });

        return res.status(200).json({
            success: true,
            data: {
                estadisticas,
                pendientes
            }
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al obtener estadísticas organizacionales' : error.message,
            error: error.message
        });
    }
};

const uploadSolicitudOrganizacionImages = async (req, res) => {
    const client = new ftp.Client();

    try {
        const { id } = req.params;
        const userId = req.session.userId;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron archivos'
            });
        }

        if (req.files.length > 3) {
            req.files.forEach(file => {
                fs.unlink(file.path, () => {});
            });

            return res.status(400).json({
                success: false,
                message: 'Solo se permiten máximo 3 imágenes por solicitud'
            });
        }

        const solicitud = await SWSolicitudOrganizacion.findById(id);
        if (!solicitud) {
            req.files.forEach(file => {
                fs.unlink(file.path, () => {});
            });

            return res.status(404).json({
                success: false,
                message: 'Solicitud organizacional no encontrada'
            });
        }

        await getOrganizacionContext(solicitud.organizacion, userId);

        if (solicitud.solicitadoPor.toString() !== userId.toString()) {
            req.files.forEach(file => {
                fs.unlink(file.path, () => {});
            });

            return res.status(403).json({
                success: false,
                message: 'Solo el solicitante puede agregar imágenes'
            });
        }

        const imagenesActuales = solicitud.imagenes?.length || 0;
        if (imagenesActuales + req.files.length > 3) {
            req.files.forEach(file => {
                fs.unlink(file.path, () => {});
            });

            return res.status(400).json({
                success: false,
                message: `Esta solicitud ya tiene ${imagenesActuales} imagen(es). Solo puede tener máximo 3 imágenes en total`
            });
        }

        await client.access({
            host: 'integradev.site',
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        });

        await client.ensureDir('splitwise');

        const uploadedImages = [];

        for (let i = 0; i < req.files.length; i++) {
            const localFilePath = req.files[i].path;
            const timestamp = Date.now();
            const remoteFileName = `solicitud_org_${id}_${timestamp}_${i}.${req.files[i].originalname.split('.').pop()}`;

            await client.uploadFrom(localFilePath, remoteFileName);
            uploadedImages.push(remoteFileName);

            fs.unlink(localFilePath, () => {});
        }

        await SWSolicitudOrganizacion.updateOne(
            { _id: id },
            { $push: { imagenes: { $each: uploadedImages } } }
        );

        return res.status(200).json({
            success: true,
            message: 'Imágenes subidas con éxito',
            data: {
                imagenesSubidas: uploadedImages.length,
                rutas: uploadedImages
            }
        });
    } catch (error) {
        console.error('Error al subir imágenes de solicitud organizacional:', error);

        if (req.files) {
            req.files.forEach(file => {
                fs.unlink(file.path, () => {});
            });
        }

        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al subir las imágenes' : error.message,
            error: error.message
        });
    } finally {
        client.close();
    }
};

const deleteSolicitudOrganizacionImage = async (req, res) => {
    const client = new ftp.Client();

    try {
        const { id, imagenNombre } = req.params;
        const userId = req.session.userId;

        const solicitud = await SWSolicitudOrganizacion.findById(id);
        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud organizacional no encontrada'
            });
        }

        await getOrganizacionContext(solicitud.organizacion, userId);

        if (solicitud.solicitadoPor.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Solo el solicitante puede eliminar imágenes'
            });
        }

        if (!solicitud.imagenes || !solicitud.imagenes.includes(imagenNombre)) {
            return res.status(404).json({
                success: false,
                message: 'La imagen no existe en esta solicitud'
            });
        }

        await client.access({
            host: 'integradev.site',
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        });

        await client.ensureDir('splitwise');

        try {
            await client.remove(imagenNombre);
        } catch (ftpError) {
            console.warn('No se pudo eliminar el archivo del servidor FTP:', ftpError.message);
        }

        await SWSolicitudOrganizacion.updateOne(
            { _id: id },
            { $pull: { imagenes: imagenNombre } }
        );

        return res.status(200).json({
            success: true,
            message: 'Imagen eliminada con éxito'
        });
    } catch (error) {
        console.error('Error al eliminar imagen de solicitud organizacional:', error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Error al eliminar la imagen' : error.message,
            error: error.message
        });
    } finally {
        client.close();
    }
};

module.exports = {
    createSolicitudOrganizacionValidators,
    procesarSolicitudOrganizacionValidators,
    confirmarSolicitudOrganizacionDuenoValidators,
    rechazarSolicitudOrganizacionDuenoValidators,
    createSolicitudOrganizacion,
    getSolicitudesOrganizacion,
    getSolicitudesPendientesOrganizacion,
    getSolicitudesPendientesConfirmacionDueno,
    getMisSolicitudesOrganizacion,
    getSolicitudOrganizacionById,
    procesarSolicitudOrganizacion,
    confirmarSolicitudOrganizacionDueno,
    rechazarSolicitudOrganizacionDueno,
    cancelarSolicitudOrganizacion,
    getEstadisticasSolicitudesOrganizacion,
    uploadSolicitudOrganizacionImages,
    deleteSolicitudOrganizacionImage
};
