const BadRequestError = require("../error/bad-request-error");

const userPrivilege = (req, res, next) => {
    const privilege = req.session?.privilege;
    if(!privilege){   
        return next(new BadRequestError("Privilege needed"));
    }
    
    const allowedRoutes = {       
        "Administrador": [
            "/sidemenu",
            "/instrucciones/:uuid",
            "/calendario-precios",
            "/api/calendario-precios",
            "/api/calendario-precios/:id",
            "/api/eventos",
            "/api/eventos/create-reservation",
            "/api/eventos/:id",
            "/api/eventos/:id/modificar",
            "/api/eventos/:id",
            "/api/eventos/:idevento",
            "/api/habitaciones",
            "/api/habitaciones/:id",
            "/api/servicios",
            "/api/servicios/crear-servicio",
            "/api/servicios/editar-servicio",
            "/api/servicios/editar-servicio/:uuid",
            "/api/servicios/eliminar-servicio",
            "/api/servicios/eliminar-servicio/:uuid",
            "/api/clientes/mostrar-clientes",
            "/api/clientes/crear-cliente",
            "/api/clientes/editar-cliente",
            "/api/clientes/editar-cliente/:uuid",
            "/api/clientes/eliminar-cliente",
            "/api/clientes/eliminar-cliente/:uuid",
            "/api/cabanas",
            "/api/cabanas/crear-cabana",
            "/api/cabanas/subir-imagenes-cabana",
            "/api/cabanas/editar-cabana",
            "/api/editar-cabana",
            "/api/dashboard",
            "/api/usuarios",
            "/api/usuarios/crear-usuario",
            "/api/usuarios/mostrar-usuario/:uuid",
            "/api/usuarios/editar-usuario",
            "/api/usuarios/editar-usuario/:uuid",
            "/api/usuarios/eliminar-usuario/",
            "/api/usuarios/eliminar-usuario/:uuid",
            "/api/perfil-usuario",
            "/api/perfil-usuario/editar-nombre",
            "/api/perfil-usuario/editar-nombre/:uuid",
            "/api/perfil-usuario/editar-email",
            "/api/perfil-usuario/editar-email/:uuid",
            "/api/perfil-usuario/editar-contrasena",
            "/api/perfil-usuario/editar-contrasena/:uuid",
            "/",
            "/api/racklimpieza",
            "/racklimpieza",
            "/rackservicios",
            "/api/costos/mostrar-costos",
            "/api/costos/editar-costos",
            "/api/costos/eliminar-costos",
            "/modelar-encuesta/crear-encuesta",
            "/modelar-encuesta/guardar-encuesta",
            "/modelar-encuesta/modificar-encuesta",
            "/procesar-encuesta/responder-encuesta",
            "/procesar-encuesta/enviar-respuestas",
            "/procesar-encuesta/mostrar-respuestas/:id"
        ],
        'Vendedor': [
            "/sidemenu",
            "/",
            "/calendario-precios",
            "/api/calendario-precios",
            "/api/calendario-precios/:id",
            "/instrucciones/:uuid",
            "/api/dashboard",
            "/api/perfil-usuario/",
            "/api/perfil-usuario/editar-nombre",
            "/api/perfil-usuario/editar-nombre/:uuid",
            "/api/perfil-usuario/editar-email",
            "/api/perfil-usuario/editar-email/:uuid",
            "/api/perfil-usuario/editar-contrasena",
            "/api/perfil-usuario/editar-contrasena/:uuid",
        ],
        'Limpieza': [
            "/sidemenu",
            "/api/racklimpieza",
            "/api/dashboard",
            "/api/perfil-usuario/",
            "/api/perfil-usuario/editar-nombre",
            "/api/perfil-usuario/editar-nombre/:uuid",
            "/api/perfil-usuario/editar-email",
            "/api/perfil-usuario/editar-email/:uuid",
            "/api/perfil-usuario/editar-contrasena",
            "/api/perfil-usuario/editar-contrasena/:uuid",            
        ],
        'Servicios adicionales': [
            "/sidemenu",
            "/api/servicios",
            "/api/servicios/crear-servicio",
            "/api/servicios/editar-servicio",
            "/api/servicios/editar-servicio/:uuid",
            "/api/servicios/eliminar-servicio",
            "/api/servicios/eliminar-servicio/:uuid",
            "/api/dashboard",
            "/api/perfil-usuario/",
            "/api/perfil-usuario/editar-nombre",
            "/api/perfil-usuario/editar-nombre/:uuid",
            "/api/perfil-usuario/editar-email",
            "/api/perfil-usuario/editar-email/:uuid",
            "/api/perfil-usuario/editar-contrasena",
            "/api/perfil-usuario/editar-contrasena/:uuid",   
        ], 
        'Dueño de cabañas': [
            "/sidemenu",
            "/api/dashboard",
            "/api/perfil-usuario/",
            "/api/perfil-usuario/editar-nombre",
            "/api/perfil-usuario/editar-nombre/:uuid",
            "/api/perfil-usuario/editar-email",
            "/api/perfil-usuario/editar-email/:uuid",
            "/api/perfil-usuario/editar-contrasena",
            "/api/perfil-usuario/editar-contrasena/:uuid", 
        ], 
        'Inversionistas': [
            "/sidemenu",
            "/api/dashboard",
            "/api/perfil-usuario/",
            "/api/perfil-usuario/editar-nombre",
            "/api/perfil-usuario/editar-nombre/:uuid",
            "/api/perfil-usuario/editar-email",
            "/api/perfil-usuario/editar-email/:uuid",
            "/api/perfil-usuario/editar-contrasena",
            "/api/perfil-usuario/editar-contrasena/:uuid", 
        ], 
        'Cliente': [
            "/sidemenu",
            "/",
            "/api/perfil-usuario/",
            "/api/perfil-usuario/editar-nombre",
            "/api/perfil-usuario/editar-nombre/:uuid",
            "/api/perfil-usuario/editar-email",
            "/api/perfil-usuario/editar-email/:uuid",
            "/api/perfil-usuario/editar-contrasena",
            "/api/perfil-usuario/editar-contrasena/:uuid", 
        ]
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