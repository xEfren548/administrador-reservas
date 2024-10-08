function adminAuthentication(req, res, next) {
    console.log(req.session)
    if (req.session) {
        // Usuario está autenticado
        if (req.session.privilege === "Administrador"){
            return next();
        } else {
            // Usuario no está autenticado, redirigir a /login
            const error = new Error('Forbidden. No tiene privilegios para realizar esta operación');
            error.status = 403;
            next(error);
        }
    } else {
        res.redirect('/login')
    }
}

module.exports = adminAuthentication;