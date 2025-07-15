const RequestValidationError = require("../error/request-validation-error");

function ensureAuthenticated(req, res, next) {
    const whitelistExact = [
        "/api/eventos/cotizaciones"
    ];
    const whitelistPrefix = [
        
    ];
    if (process.argv[2] === '--api' || req.userIp === '178.128.141.2') {
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
        return next();
    }

    res.redirect('/login');

}

module.exports = ensureAuthenticated;