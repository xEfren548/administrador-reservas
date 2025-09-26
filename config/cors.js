// cors.js

const cors = require('cors');

const ALLOWED_ORIGINS = new Set([
    'https://nynhoteles.com.mx',
    'http://localhost:51779',
]);

const options = {
    // Permite requests sin Origin (Postman/cURL) y los de la lista blanca
    origin(origin, callback) {
        if (!origin || ALLOWED_ORIGINS.has(origin)) {
            return callback(null, true);
        }
        // Rechaza silenciosamente: no agrega cabeceras CORS
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400, // 24h para preflight cache
};

module.exports = {
    corsMiddleware: cors(options),
    // Útil si quieres registrar app.options('*', preflight) explícitamente
    preflight: cors(options),
    ALLOWED_ORIGINS,
};
