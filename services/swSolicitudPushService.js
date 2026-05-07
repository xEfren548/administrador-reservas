const SWSolicitudTransaccion = require('../models/SWSolicitudTransaccion');
const SWSolicitudOrganizacion = require('../models/SWSolicitudOrganizacion');
const SWOrganizacion = require('../models/SWOrganizacion');
const { sendPushToTokens } = require('./fcmService');
const { getActiveTokensByUserIds, deactivateInvalidTokens } = require('./pushDeviceService');

function asId(value) {
    if (!value) {
        return '';
    }

    if (typeof value === 'object' && value._id) {
        return value._id.toString();
    }

    return value.toString();
}

function getDisplayName(user) {
    if (!user) {
        return 'Alguien';
    }

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.email || 'Alguien';
}

function getCuentaNombre(cuenta) {
    if (!cuenta) {
        return 'la cuenta';
    }

    return cuenta.nombre || 'la cuenta';
}

function formatMonto(monto, moneda = 'MXN') {
    const montoNumerico = Number(monto || 0);

    try {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: moneda,
            maximumFractionDigits: 2
        }).format(montoNumerico);
    } catch (error) {
        return montoNumerico.toFixed(2);
    }
}

function createBaseData({
    eventType,
    action,
    scope,
    solicitud,
    targetTab
}) {
    return {
        module: 'finanzas',
        screen: 'finanzas',
        entity: 'solicitud',
        eventType,
        action,
        scope,
        estado: solicitud.estado,
        solicitudId: asId(solicitud._id),
        cuentaId: asId(solicitud.cuenta),
        cuentaDestinoId: asId(solicitud.cuentaDestino),
        organizacionId: asId(solicitud.organizacion),
        solicitadoPorId: asId(solicitud.solicitadoPor),
        propietarioCuentaId: asId(solicitud.propietarioCuenta),
        tipo: solicitud.tipo,
        monto: solicitud.monto,
        navigationTarget: 'finanzasSolicitudes',
        targetTab
    };
}

async function dispatchPushToUsers(userIds, { notification, data }) {
    const recipientIds = [...new Set(userIds.filter(Boolean).map((userId) => userId.toString()))];

    if (!recipientIds.length) {
        return {
            successCount: 0,
            failureCount: 0,
            invalidTokens: [],
            skippedReason: 'NO_RECIPIENTS'
        };
    }

    const tokens = await getActiveTokensByUserIds(recipientIds);
    const result = await sendPushToTokens({
        tokens,
        notification,
        data,
        android: {
            priority: 'high'
        },
        apns: {
            headers: {
                'apns-priority': '10'
            }
        }
    });

    if (result.invalidTokens.length) {
        await deactivateInvalidTokens(result.invalidTokens);
    }

    return result;
}

function loadSolicitudCuenta(solicitudId) {
    return SWSolicitudTransaccion.findById(solicitudId)
        .populate('solicitadoPor', 'firstName lastName email')
        .populate('propietarioCuenta', 'firstName lastName email')
        .populate('cuenta', 'nombre moneda')
        .populate('cuentaDestino', 'nombre moneda');
}

function loadSolicitudOrganizacion(solicitudId) {
    return SWSolicitudOrganizacion.findById(solicitudId)
        .populate('solicitadoPor', 'firstName lastName email')
        .populate('propietarioCuenta', 'firstName lastName email')
        .populate('cuenta', 'nombre moneda')
        .populate('cuentaDestino', 'nombre moneda')
        .populate('organizacion', 'nombre');
}

async function resolveAdminRecipients(solicitud) {
    const organizacionId = asId(solicitud.organizacion);

    if (!organizacionId) {
        return {
            recipients: [],
            organizacion: null
        };
    }

    const organizacion = await SWOrganizacion.findById(organizacionId)
        .populate('participantes.usuario', 'firstName lastName email')
        .select('nombre participantes');

    if (!organizacion) {
        return {
            recipients: [],
            organizacion: null
        };
    }

    const adminRecipients = (organizacion.participantes || [])
        .filter((participante) => participante.rol === 'Administrador' && participante.usuario)
        .map((participante) => asId(participante.usuario));

    const requesterId = asId(solicitud.solicitadoPor);
    const filteredRecipients = solicitud.rolSolicitante === 'Administrador' && adminRecipients.length >= 2
        ? adminRecipients.filter((adminId) => adminId !== requesterId)
        : adminRecipients;

    return {
        recipients: [...new Set(filteredRecipients)],
        organizacion
    };
}

async function notifySolicitudCuentaCreada({ solicitudId }) {
    const solicitud = await loadSolicitudCuenta(solicitudId);

    if (!solicitud) {
        return { skippedReason: 'REQUEST_NOT_FOUND' };
    }

    const requesterId = asId(solicitud.solicitadoPor);
    const recipientId = asId(solicitud.propietarioCuenta);

    return dispatchPushToUsers(
        recipientId && recipientId !== requesterId ? [recipientId] : [],
        {
            notification: {
                title: 'Nueva solicitud pendiente',
                body: `${getDisplayName(solicitud.solicitadoPor)} creo una solicitud de ${solicitud.tipo.toLowerCase()} por ${formatMonto(solicitud.monto, solicitud.cuenta?.moneda)} en ${getCuentaNombre(solicitud.cuenta)}.`
            },
            data: createBaseData({
                eventType: 'sw_solicitud_cuenta_creada',
                action: 'created',
                scope: 'cuenta',
                solicitud,
                targetTab: 'aprobaciones'
            })
        }
    );
}

async function notifySolicitudCuentaResuelta({ solicitudId, resolution }) {
    const solicitud = await loadSolicitudCuenta(solicitudId);

    if (!solicitud) {
        return { skippedReason: 'REQUEST_NOT_FOUND' };
    }

    const requesterId = asId(solicitud.solicitadoPor);
    const processorId = asId(solicitud.respuesta?.procesadaPor);
    const approved = resolution === 'approved';

    return dispatchPushToUsers(
        requesterId && requesterId !== processorId ? [requesterId] : [],
        {
            notification: {
                title: approved ? 'Solicitud aprobada' : 'Solicitud rechazada',
                body: approved
                    ? `Tu solicitud de ${solicitud.tipo.toLowerCase()} por ${formatMonto(solicitud.monto, solicitud.cuenta?.moneda)} fue aprobada.`
                    : `Tu solicitud de ${solicitud.tipo.toLowerCase()} por ${formatMonto(solicitud.monto, solicitud.cuenta?.moneda)} fue rechazada.`
            },
            data: createBaseData({
                eventType: approved ? 'sw_solicitud_cuenta_aprobada' : 'sw_solicitud_cuenta_rechazada',
                action: approved ? 'approved' : 'rejected',
                scope: 'cuenta',
                solicitud,
                targetTab: 'misSolicitudes'
            })
        }
    );
}

async function notifySolicitudOrganizacionCreada({ solicitudId }) {
    const solicitud = await loadSolicitudOrganizacion(solicitudId);

    if (!solicitud) {
        return { skippedReason: 'REQUEST_NOT_FOUND' };
    }

    const { recipients, organizacion } = await resolveAdminRecipients(solicitud);

    return dispatchPushToUsers(recipients, {
        notification: {
            title: 'Nueva solicitud organizacional',
            body: `${getDisplayName(solicitud.solicitadoPor)} registro una solicitud de ${solicitud.tipo.toLowerCase()} por ${formatMonto(solicitud.monto, solicitud.cuenta?.moneda)} en ${organizacion?.nombre || 'la organizacion'}.`
        },
        data: createBaseData({
            eventType: 'sw_solicitud_organizacion_creada',
            action: 'created',
            scope: 'organizacion',
            solicitud,
            targetTab: 'aprobaciones'
        })
    });
}

async function notifySolicitudOrganizacionPendienteDueno({ solicitudId }) {
    const solicitud = await loadSolicitudOrganizacion(solicitudId);

    if (!solicitud) {
        return { skippedReason: 'REQUEST_NOT_FOUND' };
    }

    const requesterId = asId(solicitud.solicitadoPor);
    const ownerId = asId(solicitud.propietarioCuenta);

    return dispatchPushToUsers(
        ownerId && ownerId !== requesterId ? [ownerId] : [],
        {
            notification: {
                title: 'Solicitud pendiente de tu confirmacion',
                body: `${getDisplayName(solicitud.solicitadoPor)} necesita tu confirmacion final en ${getCuentaNombre(solicitud.cuenta)}.`
            },
            data: createBaseData({
                eventType: 'sw_solicitud_organizacion_pendiente_dueno',
                action: 'owner_confirmation_requested',
                scope: 'organizacion',
                solicitud,
                targetTab: 'confirmacionDueno'
            })
        }
    );
}

async function notifySolicitudOrganizacionResuelta({ solicitudId, resolution }) {
    const solicitud = await loadSolicitudOrganizacion(solicitudId);

    if (!solicitud) {
        return { skippedReason: 'REQUEST_NOT_FOUND' };
    }

    const requesterId = asId(solicitud.solicitadoPor);
    const approved = resolution === 'approved';

    return dispatchPushToUsers([requesterId], {
        notification: {
            title: approved ? 'Solicitud aprobada' : 'Solicitud rechazada',
            body: approved
                ? `Tu solicitud organizacional de ${solicitud.tipo.toLowerCase()} por ${formatMonto(solicitud.monto, solicitud.cuenta?.moneda)} fue aprobada.`
                : `Tu solicitud organizacional de ${solicitud.tipo.toLowerCase()} por ${formatMonto(solicitud.monto, solicitud.cuenta?.moneda)} fue rechazada.`
        },
        data: createBaseData({
            eventType: approved ? 'sw_solicitud_organizacion_aprobada' : 'sw_solicitud_organizacion_rechazada',
            action: approved ? 'approved' : 'rejected',
            scope: 'organizacion',
            solicitud,
            targetTab: 'misSolicitudes'
        })
    });
}

async function notifySolicitudOrganizacionRechazadaPorDueno({ solicitudId }) {
    const solicitud = await loadSolicitudOrganizacion(solicitudId);

    if (!solicitud) {
        return { skippedReason: 'REQUEST_NOT_FOUND' };
    }

    return dispatchPushToUsers([asId(solicitud.solicitadoPor)], {
        notification: {
            title: 'Solicitud rechazada por el dueno',
            body: `Tu solicitud organizacional de ${solicitud.tipo.toLowerCase()} por ${formatMonto(solicitud.monto, solicitud.cuenta?.moneda)} fue rechazada por el dueno de la cuenta.`
        },
        data: createBaseData({
            eventType: 'sw_solicitud_organizacion_rechazada_dueno',
            action: 'owner_rejected',
            scope: 'organizacion',
            solicitud,
            targetTab: 'misSolicitudes'
        })
    });
}

module.exports = {
    notifySolicitudCuentaCreada,
    notifySolicitudCuentaResuelta,
    notifySolicitudOrganizacionCreada,
    notifySolicitudOrganizacionPendienteDueno,
    notifySolicitudOrganizacionResuelta,
    notifySolicitudOrganizacionRechazadaPorDueno
};