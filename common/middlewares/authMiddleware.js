function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        // Usuario está autenticado
        return next();
    } else {
        // Usuario no está autenticado, redirigir a /login
        if (req.url === "/api/eventos/cotizaciones"){
            return next();
        }
        res.redirect('/login');
    }
}

module.exports = ensureAuthenticated;