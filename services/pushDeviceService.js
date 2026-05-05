const PushDevice = require('../models/PushDevice');

function normalizeToken(token) {
    return typeof token === 'string' ? token.trim() : '';
}

function normalizeString(value) {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
}

async function upsertPushDevice({
    userId,
    token,
    platform,
    app,
    deviceId,
    deviceName,
    appVersion,
    appBuild
}) {
    const normalizedToken = normalizeToken(token);

    const update = {
        user: userId,
        token: normalizedToken,
        platform: normalizeString(platform) || 'unknown',
        app: normalizeString(app) || 'flutter-finanzas',
        deviceId: normalizeString(deviceId),
        deviceName: normalizeString(deviceName),
        appVersion: normalizeString(appVersion),
        appBuild: normalizeString(appBuild),
        active: true,
        lastSeenAt: new Date(),
        unregisteredAt: null,
        invalidatedAt: null,
        lastErrorCode: null
    };

    return PushDevice.findOneAndUpdate(
        { token: normalizedToken },
        {
            $set: update,
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );
}

async function unregisterPushDevice({ userId, token }) {
    const normalizedToken = normalizeToken(token);

    return PushDevice.findOneAndUpdate(
        {
            user: userId,
            token: normalizedToken,
            active: true
        },
        {
            $set: {
                active: false,
                unregisteredAt: new Date(),
                lastSeenAt: new Date()
            }
        },
        {
            new: true
        }
    );
}

async function getActiveTokensByUserIds(userIds = []) {
    const normalizedUserIds = [...new Set(
        userIds
            .filter(Boolean)
            .map((userId) => userId.toString())
    )];

    if (!normalizedUserIds.length) {
        return [];
    }

    const devices = await PushDevice.find({
        user: { $in: normalizedUserIds },
        active: true
    }).select('token');

    return [...new Set(devices.map((device) => normalizeToken(device.token)).filter(Boolean))];
}

async function deactivateInvalidTokens(tokens = [], errorCode = 'messaging/registration-token-not-registered') {
    const normalizedTokens = [...new Set(tokens.map(normalizeToken).filter(Boolean))];

    if (!normalizedTokens.length) {
        return;
    }

    await PushDevice.updateMany(
        { token: { $in: normalizedTokens } },
        {
            $set: {
                active: false,
                invalidatedAt: new Date(),
                lastErrorCode: errorCode
            }
        }
    );
}

module.exports = {
    upsertPushDevice,
    unregisterPushDevice,
    getActiveTokensByUserIds,
    deactivateInvalidTokens
};