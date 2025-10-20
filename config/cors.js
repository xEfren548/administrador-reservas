// cors.js

const cors = require('cors');

const ALLOWED_ORIGINS = new Set([
    'https://nynhoteles.com.mx',
    'http://localhost:51779',
    'http://localhost:8080',
]);

// Dominios que permiten subdominios
const ALLOWED_DOMAIN_PATTERNS = [
    'rentravel.com.mx'
];

const options = {
    // Permite requests sin Origin (Postman/cURL) y los de la lista blanca
    origin(origin, callback) {
        if (!origin || ALLOWED_ORIGINS.has(origin)) {
            return callback(null, true);
        }
        
        // Verifica si el origen coincide con algún patrón de dominio permitido
        if (origin) {
            const originUrl = new URL(origin);
            const hostname = originUrl.hostname;
            
            for (const pattern of ALLOWED_DOMAIN_PATTERNS) {
                // Verifica si es el dominio exacto o un subdominio
                if (hostname === pattern || hostname.endsWith('.' + pattern)) {
                    return callback(null, true);
                }
            }
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
