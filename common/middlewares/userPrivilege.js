const BadRequestError = require("../error/bad-request-error");

const userPrivilege = (req, res, next) => {
    const privilege = req.session?.privilege;
     
    console.log(req.session?.privilege)

    if(!privilege){   
        return next(new BadRequestError("Privilege needed"));
    }
    
    const allowedRoutes = {
        "test": ['/', '/login', 'api/auth/login', 'api/auth/logout', '/api/usuarios', '/api/usuarios/mostrar-usuarios', '/api/usuarios/mostrar-usuario/:uuid', '/api/usuarios/editar-usuario', '/api/usuarios/editar-usuario/:uuid', '/api/usuarios/eliminar-usuario/:uuid', '/api/usuarios/crear-usuario', 'api/servicios/', 'api/servicios/crear-servicio', 'api/servicios/editar-servicio', 'api/servicios/editar-servicio/:uuid', 'api/servicios/eliminar-servicio', 'api/servicios/eliminar-servicio/:uuid'],
        
        "Administrador": ['/','/api/perfil-usuario','/api/auth/crear-usuario','/api/usuarios/crear-usuario','/api/clientes/mostrar-clientes','/api/habitaciones','/resources','/api/editar-cabana','/instrucciones/:id','/api/instrucciones/','/api/instrucciones/kgUoporxboU1ZLJvGcKm5','/api/servicios','/api/clientes','/api/cabanas','/api/racklimpieza','/api/dashboard','/api/auth/logout','/fullcalendar/dist/index.global.js' ,'/api/eventos', '/api/eventos/:id', '/api/eventos/:id/modificar', '/api/habitaciones', '/api/habitaciones/:id', '/login', 'api/auth/login', 'api/auth/logout', '/api/usuarios', '/api/usuarios/mostrar-usuarios', '/api/usuarios/mostrar-usuario/:uuid', '/api/usuarios/editar-usuario', '/api/usuarios/editar-usuario/:uuid', '/api/usuarios/eliminar-usuario/:uuid', '/api/usuarios/crear-usuario', ],
        'Test': ['/'],
        
        'Vendedor': ['/'],
        
        'Limpieza': ['/']
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