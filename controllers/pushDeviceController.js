const { check } = require('express-validator');
const pushDeviceService = require('../services/pushDeviceService');
const { sendPushToTokens } = require('../services/fcmService');

const VALID_PLATFORMS = ['android', 'ios', 'web', 'unknown'];

const registerPushDeviceValidators = [
    check('token')
        .notEmpty().withMessage('El token push es requerido')
        .isString().withMessage('El token push debe ser texto')
        .isLength({ min: 20, max: 4096 }).withMessage('El token push no es valido')
        .trim(),
    check('platform')
        .optional()
        .isIn(VALID_PLATFORMS).withMessage('La plataforma no es valida'),
    check('app')
        .optional()
        .isString().withMessage('La app debe ser texto')
        .isLength({ max: 80 }).withMessage('La app no puede exceder 80 caracteres')
        .trim(),
    check('deviceId')
        .optional()
        .isString().withMessage('El identificador del dispositivo debe ser texto')
        .isLength({ max: 200 }).withMessage('El identificador del dispositivo no puede exceder 200 caracteres')
        .trim(),
    check('deviceName')
        .optional()
        .isString().withMessage('El nombre del dispositivo debe ser texto')
        .isLength({ max: 200 }).withMessage('El nombre del dispositivo no puede exceder 200 caracteres')
        .trim(),
    check('appVersion')
        .optional()
        .isString().withMessage('La version de la app debe ser texto')
        .isLength({ max: 50 }).withMessage('La version de la app no puede exceder 50 caracteres')
        .trim(),
    check('appBuild')
        .optional()
        .isString().withMessage('El build de la app debe ser texto')
        .isLength({ max: 50 }).withMessage('El build de la app no puede exceder 50 caracteres')
        .trim()
];

const unregisterPushDeviceValidators = [
    check('token')
        .notEmpty().withMessage('El token push es requerido')
        .isString().withMessage('El token push debe ser texto')
        .isLength({ min: 20, max: 4096 }).withMessage('El token push no es valido')
        .trim()
];

const sendTestPushValidators = [
    check('title')
        .optional()
        .isString().withMessage('El titulo debe ser texto')
        .isLength({ min: 1, max: 80 }).withMessage('El titulo no puede exceder 80 caracteres')
        .trim(),
    check('body')
        .optional()
        .isString().withMessage('El mensaje debe ser texto')
        .isLength({ min: 1, max: 180 }).withMessage('El mensaje no puede exceder 180 caracteres')
        .trim(),
    check('screen')
        .optional()
        .isString().withMessage('La pantalla destino debe ser texto')
        .isLength({ min: 1, max: 80 }).withMessage('La pantalla destino no puede exceder 80 caracteres')
        .trim()
];

async function registerPushDevice(req, res) {
    try {
        const userId = req.session.userId;
        const device = await pushDeviceService.upsertPushDevice({
            userId,
            token: req.body.token,
            platform: req.body.platform,
            app: req.body.app,
            deviceId: req.body.deviceId,
            deviceName: req.body.deviceName,
            appVersion: req.body.appVersion,
            appBuild: req.body.appBuild
        });

        return res.status(200).json({
            success: true,
            message: 'Dispositivo push registrado exitosamente',
            data: {
                id: device._id,
                active: device.active,
                lastSeenAt: device.lastSeenAt
            }
        });
    } catch (error) {
        console.error('Error al registrar dispositivo push:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al registrar el dispositivo push',
            error: error.message
        });
    }
}

async function unregisterPushDevice(req, res) {
    try {
        const userId = req.session.userId;
        const device = await pushDeviceService.unregisterPushDevice({
            userId,
            token: req.body.token
        });

        return res.status(200).json({
            success: true,
            message: device
                ? 'Dispositivo push desactivado exitosamente'
                : 'El token push ya estaba desactivado o no existe para este usuario',
            data: {
                found: Boolean(device)
            }
        });
    } catch (error) {
        console.error('Error al desactivar dispositivo push:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al desactivar el dispositivo push',
            error: error.message
        });
    }
}

async function sendTestPush(req, res) {
    try {
        const userId = req.session.userId;
        const title = req.body.title || 'Prueba de notificaciones';
        const body = req.body.body || 'Si ves esto, FCM y el backend ya quedaron conectados.';
        const screen = req.body.screen || 'finanzas';

        const tokens = await pushDeviceService.getActiveTokensByUserIds([userId]);

        if (!tokens.length) {
            return res.status(404).json({
                success: false,
                message: 'Este usuario no tiene dispositivos push activos registrados'
            });
        }

        const result = await sendPushToTokens({
            tokens,
            notification: {
                title,
                body
            },
            data: {
                module: 'push-test',
                eventType: 'push_test',
                navigationTarget: screen,
                screen,
                userId: String(userId)
            },
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
            await pushDeviceService.deactivateInvalidTokens(result.invalidTokens);
        }

        return res.status(200).json({
            success: true,
            message: 'Notificacion de prueba enviada',
            data: result
        });
    } catch (error) {
        console.error('Error al enviar notificacion push de prueba:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al enviar la notificacion push de prueba',
            error: error.message
        });
    }
}

module.exports = {
    registerPushDeviceValidators,
    unregisterPushDeviceValidators,
    sendTestPushValidators,
    registerPushDevice,
    unregisterPushDevice,
    sendTestPush
};