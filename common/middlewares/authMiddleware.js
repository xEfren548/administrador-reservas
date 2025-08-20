const RequestValidationError = require("../error/request-validation-error");
const jwt = require("jsonwebtoken");
const Usuario = require('./../../models/Usuario.js'); 

async function ensureAuthenticated(req, res, next) {
    console.log(req.path);
    const whitelistExact = [
        "/api/eventos/cotizaciones"
    ];
    const whitelistPrefix = [

    ];

    const JWT_SECRET = process.env.JWT_SECRET;

    const authHeader = req.headers.authorization || req.headers.Authorization;
    console.log(authHeader || 'No auth header');
    if (authHeader?.startsWith('Bearer ')) {
        console.log("Autorizando con token desde authMiddleware...");
        const token = authHeader.slice(7).trim();
        try {
            const payload = jwt.verify(token, JWT_SECRET, {
                algorithms: ['HS256'],
                clockTolerance: 5
            });

            const user = await Usuario.findById(payload.id).lean();
            if (!user) {
                req.session = null;
                return res.status(401).json({ message: 'Invalid user' });
            }

            req.session = {
                token, // útil si en algún sitio lo reenvías
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                privilege: user.privilege,
                id: user._id,
                userId: user._id.toString(),
                profileImageUrl: user.profileImageUrl ?? null,
                role: user.role,
                assignedChalets: user.assignedChalets ?? [],
            };

            // (Opcional) alias común:
            req.user = req.session;
            req.auth = payload;
            return next();
        } catch (err) {
            console.log(err);
            const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
            return res.status(401).json({ message: msg });

        }
    }

    if (process.argv[2] === '--api' || req.userIp === '178.128.141.2' || req.userIp === '::ffff:178.128.141.2' || req.headers['api-key'] === 'channex') {
        console.log("Autorizando a channex...");
        whitelistPrefix.push('/api/channex');
    }
    // 1) Si es ruta exacta permitida
    if (whitelistExact.includes(req.path)) {
        return next();
    }
    // 2) Si coincide con algún prefijo permitido (/api/channex/*)
    if (whitelistPrefix.some(prefix => req.path.startsWith(prefix))) {
        return next();
    }
    // 3) Si hay sesión válida
    if (req.session && req.session.userId) {
        console.log("Autorizando con session desde authMiddleware...");
        console.log(req.session);
        return next();
    }

    res.redirect('/login');

}

module.exports = ensureAuthenticated;