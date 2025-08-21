const RequestValidationError = require("../error/request-validation-error");
const jwt = require("jsonwebtoken");
const Usuario = require('./../../models/Usuario.js');

const WHITELIST_EXACT = new Set([
    '/api/auth/login',
    '/api/auth/login-token',
    '/api/eventos/cotizaciones',
]);

const WHITELIST_PREFIX = [
    // '/api/channex', // se activará dinámicamente si aplica
];

const CHANNEX_IPS = new Set(['178.128.141.2', '::ffff:178.128.141.2']);
const CHANNEX_API_KEY = 'channex';

function normalizePath(p = '') {
    // sin querystring y sin slash final
    try {
        const [pathOnly] = p.split('?');
        return pathOnly.replace(/\/+$/, '') || '/';
    } catch {
        return p || '/';
    }
}

function wantsJson(req) {
    const accept = String(req.headers.accept || '');
    return accept.includes('application/json') || isApiRequest(req);
}

function isApiRequest(req) {
    const path = normalizePath(req.path || req.originalUrl);
    return path.startsWith('/api');
}

function clientIp(req) {
    // Requiere: app.set('trust proxy', 1) si hay proxy
    return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
}

async function ensureAuthenticated(req, res, next) {
    console.log("req session inicial: ", req.session);
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        return res.status(500).json({ message: 'Server misconfigured (JWT_SECRET)' });
    }

    // Preflight: deja pasar OPTIONS
    if (req.method === 'OPTIONS') return res.sendStatus(204);

    const path = normalizePath(req.path || req.originalUrl);
    const ip = clientIp(req);

    // Whitelist dinámico para Channex
    const apiKey = req.headers['api-key'];
    const allowChannex = CHANNEX_IPS.has(ip) || apiKey === CHANNEX_API_KEY;
    const effectivePrefixes = allowChannex ? ['/api/channex', ...WHITELIST_PREFIX] : WHITELIST_PREFIX;

    // 1) Whitelist exacto
    if (WHITELIST_EXACT.has(path)) return next();

    console.log("req.session?.userId", req.session?.userId);
    if (req.session?.userId) return next();

    // 2) Whitelist por prefijo
    if (effectivePrefixes.some((prefix) => path.startsWith(prefix))) return next();

    // 3) Bearer token
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        try {
            const payload = jwt.verify(token, JWT_SECRET, {
                algorithms: ['HS256'],
                clockTolerance: 5,
            });

            // OJO: toma el id como sub || userId || id (según cómo lo firmaste en login)
            const userId = payload.sub || payload.userId || payload.id;
            if (!userId) {
                return res.status(401).json({ message: 'Invalid token payload' });
            }

            const user = await Usuario.findById(userId).lean();
            if (!user) {
                return res.status(401).json({ message: 'Invalid user' });
            }

            // Emula req.session para tu código legacy
            req.session = {
                token,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                privilege: user.privilege,
                id: user._id,
                userId: String(user._id),
                profileImageUrl: user.profileImageUrl ?? null,
                role: user.role,
                assignedChalets: user.assignedChalets ?? [],
            };
            req.user = req.session; // alias
            req.auth = payload;     // claims del JWT

            return next();
        } catch (err) {
            const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
            return res.status(401).json({ message: msg });
        }
    }

    // 4) Sin bearer y no whitelisted:
    if (isApiRequest(req) || wantsJson(req) || req.method !== 'GET') {
        // API/mobile: nunca redirijas, responde JSON
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // 5) Solo para páginas web (GET no-API)
    return res.redirect(303, '/login'); // 303 preserva mejor la semántica
}

module.exports = ensureAuthenticated;