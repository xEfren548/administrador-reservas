let cachedFirebaseAdmin = null;
let cachedFirebaseApp = null;
let firebaseAdminLoadAttempted = false;
let loggedMissingFirebaseModule = false;
let loggedMissingFirebaseConfig = false;

function loadFirebaseAdmin() {
    if (cachedFirebaseAdmin) {
        return cachedFirebaseAdmin;
    }

    if (firebaseAdminLoadAttempted) {
        return null;
    }

    firebaseAdminLoadAttempted = true;

    try {
        cachedFirebaseAdmin = require('firebase-admin');
        return cachedFirebaseAdmin;
    } catch (error) {
        if (!loggedMissingFirebaseModule) {
            loggedMissingFirebaseModule = true;
            console.warn('firebase-admin no esta instalado; las notificaciones push quedaran deshabilitadas hasta agregar la dependencia.');
        }

        return null;
    }
}

function normalizePrivateKey(value) {
    if (typeof value !== 'string') {
        return undefined;
    }

    return value.replace(/\\n/g, '\n');
}

function normalizeServiceAccount(rawAccount) {
    if (!rawAccount || typeof rawAccount !== 'object') {
        return null;
    }

    const projectId = rawAccount.projectId || rawAccount.project_id;
    const clientEmail = rawAccount.clientEmail || rawAccount.client_email;
    const privateKey = normalizePrivateKey(rawAccount.privateKey || rawAccount.private_key);

    if (!projectId || !clientEmail || !privateKey) {
        return null;
    }

    return {
        projectId,
        clientEmail,
        privateKey
    };
}

function resolveServiceAccount() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            return normalizeServiceAccount(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
        } catch (error) {
            console.error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene un JSON valido:', error.message);
            return null;
        }
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        try {
            const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
            return normalizeServiceAccount(JSON.parse(decoded));
        } catch (error) {
            console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 no contiene un JSON valido:', error.message);
            return null;
        }
    }

    return normalizeServiceAccount({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
    });
}

function getFirebaseApp() {
    if (cachedFirebaseApp) {
        return cachedFirebaseApp;
    }

    const firebaseAdmin = loadFirebaseAdmin();
    if (!firebaseAdmin) {
        return null;
    }

    if (Array.isArray(firebaseAdmin.apps) && firebaseAdmin.apps.length > 0) {
        cachedFirebaseApp = firebaseAdmin.apps[0];
        return cachedFirebaseApp;
    }

    const serviceAccount = resolveServiceAccount();

    if (!serviceAccount) {
        if (!loggedMissingFirebaseConfig) {
            loggedMissingFirebaseConfig = true;
            console.warn('FCM no esta configurado; define credenciales Firebase para habilitar notificaciones push.');
        }

        return null;
    }

    try {
        cachedFirebaseApp = firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount),
            projectId: serviceAccount.projectId
        });

        return cachedFirebaseApp;
    } catch (error) {
        console.error('No se pudo inicializar Firebase Admin:', error.message);
        return null;
    }
}

function buildDataPayload(data = {}) {
    return Object.entries(data).reduce((payload, [key, value]) => {
        if (value === undefined || value === null) {
            return payload;
        }

        payload[key] = String(value);
        return payload;
    }, {});
}

function createEmptyResult(skippedReason = null) {
    return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        failures: [],
        skippedReason
    };
}

function isInvalidTokenCode(code) {
    return code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered';
}

function chunkArray(values, size) {
    const chunks = [];

    for (let index = 0; index < values.length; index += size) {
        chunks.push(values.slice(index, index + size));
    }

    return chunks;
}

async function sendPushToTokens({ tokens = [], notification, data, android, apns }) {
    const normalizedTokens = [...new Set(
        tokens
            .map((token) => (typeof token === 'string' ? token.trim() : ''))
            .filter(Boolean)
    )];

    if (!normalizedTokens.length) {
        return createEmptyResult('NO_TOKENS');
    }

    const firebaseAdmin = loadFirebaseAdmin();
    const firebaseApp = getFirebaseApp();

    if (!firebaseAdmin || !firebaseApp) {
        return createEmptyResult('FCM_NOT_CONFIGURED');
    }

    const messaging = firebaseAdmin.messaging(firebaseApp);
    const payload = {
        notification,
        data: buildDataPayload(data),
        android,
        apns
    };

    const batches = chunkArray(normalizedTokens, 500);
    const result = createEmptyResult();

    for (const batch of batches) {
        const response = await messaging.sendEachForMulticast({
            ...payload,
            tokens: batch
        });

        result.successCount += response.successCount;
        result.failureCount += response.failureCount;

        response.responses.forEach((item, index) => {
            if (item.success) {
                return;
            }

            const failedToken = batch[index];
            const code = item.error?.code || 'unknown';

            result.failures.push({
                token: failedToken,
                code,
                message: item.error?.message || 'Error desconocido al enviar push'
            });

            if (isInvalidTokenCode(code)) {
                result.invalidTokens.push(failedToken);
            }
        });
    }

    result.invalidTokens = [...new Set(result.invalidTokens)];
    return result;
}

module.exports = {
    sendPushToTokens
};