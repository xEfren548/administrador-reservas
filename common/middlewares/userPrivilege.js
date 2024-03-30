const userPrivilege = (req, res, next) => {
    // RETRIEVING CURRENT USER'S PRIVILEGE COOKIE.
    //const { privilege } = req.user;
    privilege = "test";
    
    if(!privilege){
        error = new Error("El usuario require un privilegio");
        error.status = 400;    
        return next(error);
    }
    
    const allowedRoutes = {
        "test": ['/', '/login', '/api/auth/logIn-usuario', '/api/auth/crear-usuario', '/api/usuarios', '/api/usuarios/mostrar-usuarios', '/api/usuarios/mostrar-usuario/:uuid', '/api/usuarios/editar-usuario', '/api/usuarios/editar-usuario/:uuid', '/api/usuarios/eliminar-usuario/:uuid', '/api/usuarios/crear-usuario', ],
        'admin': ['/'],
        'seller': ['/']
    };
    const currentRoute = req.path;
    const allowedRoutesForUser = allowedRoutes[privilege];
    
    let routeAllowed = false;
    for (const allowedRoute of allowedRoutesForUser) {
        if (allowedRoute.includes(':')) {
            const routePrefix = allowedRoute.split(':')[0];
            if (currentRoute.startsWith(routePrefix)) {
                routeAllowed = true;
                break;
            }
        } else {
            if (allowedRoute === currentRoute) {
                routeAllowed = true;
                break;
            }
        }
    }
    if (routeAllowed) {
        next();
    } else {
        const error = new Error('Forbidden');
        error.status = 403;
        next(error);
    }
}

module.exports = userPrivilege;