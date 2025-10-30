const Usuario = require('../models/Usuario');
const { check } = require("express-validator");
const NotFoundError = require("../common/error/not-found-error");
const { variationPlacements } = require('@popperjs/core');

const validators = [
    check()
        .custom(async (value, { req }) => {
            if (req.session.privilege != 'Administrador' && req.session.privilege != 'Vendedor'
                && req.session.privilege != 'Limpieza' && req.session.privilege != 'Dueño de cabañas' &&
                req.session.privilege != 'Servicios adicionales' && req.session.privilege != 'Inversionistas'
                && req.session.privilege != 'Colaborador dueño'
            ) {
                throw new NotFoundError('Privilege does not exists.');
            }
            return true;
        }),
];

async function generateSideMenu(req, res, next) {
    const profileImg = req.session.profileImageUrl || '/images/default-pp.jpg'
    try {
        const privileges = {
            "Administrador": [
                // { 'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"] },
                { 'Home': ["/", "fs-5 fa fa-house"] },
                { 'Cotizador': ["/api/cotizar", "fas fa-calculator"] },
                { 'Usuarios': ["/api/usuarios", "fas fa-users"] },
                { 'Roles': ["/newroles", "fas fa-users-cog"] },
                { 'Clientes': ["/api/clientes/mostrar-clientes", "fa fa-user-circle"] },
                { 'Clientes Web': ["/api/clientes/mostrar-clientes-web", "fas fa-users"] },
                { 'Servicios adicionales': ["/api/servicios", "fas fa-spa"] },
                { 'Limpieza': ["/racklimpieza", "fas fa-broom"] },
                { 'Cabañas': [] },
                { 'Utilidades': [] },
                { 'Solicitudes': ["/aprobaciones", "fas fa-check"] },
                { 'Encuestas': [] },
                { 'Logs': ["/logs", "fas fa-cogs"] },
                { 'Calendarios': [] },
                { 'Reportes' : [] },
                { 'Conexiones': ["/api/channex/home", "fas fa-link"] },
            ],
            'Vendedor': [
                // { 'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"] },
                { 'Cotizador': ["/api/cotizar", "fas fa-calculator"] },
                { 'Calendario': ["/", "fs-5 fa fa-calendar"] },
                { 'Mis Utilidades': ["/api/mostrar-utilidades", "fas fa-hand-holding-usd"] },
            ],
            'Limpieza': [
                // { 'Dashboard': ["/dashboard", "fs-5 fa fa-chart-bar"] },
                { 'Limpieza': ["/racklimpieza", "fas fa-broom"] },
            ],
            'Servicios adicionales': [
                // { 'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"] },
                { 'Servicios adicionales': ["/api/servicios", "fas fa-spa"] },
            ],
            'Dueño de cabañas': [
                // { 'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"] },
                { 'Calendario': ["/api/calendar/duenos", "fs-5 fa fa-calendar"] },
                { 'Mis Utilidades': ["/api/mostrar-utilidades", "fas fa-hand-holding-usd"] },
            ],
            'Colaborador dueño': [
                // { 'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"] },
                { 'Calendario': ["/api/calendar/colaboradorduenos", "fs-5 fa fa-calendar"] },
            ],
            'Inversionistas': [
                // { 'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"] },
                { 'Mis Utilidades': ["/api/mostrar-utilidades", "fas fa-hand-holding-usd"] },
                { 'Calendario': ["/api/calendar/colaboradorduenos", "fs-5 fa fa-calendar"] },

            ],
            'Cliente': [
                { 'Home': ["/", "fs-5 fa fa-house"] },
            ],
        };

        const routes = privileges[req.session.privilege];
        var sideMenuContent =
            `<div class="offcanvas-header">
                <h6 class="offcanvas-title d-none d-sm-block text-white" id="offcanvas"></h6>
                <button type="button" class="btn-close text-reset bg-light" data-bs-dismiss="offcanvas"
                    aria-label="Close"></button>
            </div>
            <div class="offcanvas-body px-0 bg-dark">
                <ul class="nav nav-pills flex-column mb-sm-auto mb-0 align-items-start" id="menu">`;
        routes.forEach(item => {
            for (const key in item) {
                const route = item[key][0];
                const cssClass = item[key][1];
                if (key === "Servicios adicionales") {
                    sideMenuContent +=
                        `<li class="nav-item py-2 py-sm-0">
                            <a href="#submenu1" data-bs-toggle="collapse" class="nav-link text-truncate px-4 align-middle ">
                                <div>
                                    <i class="fs-5 fas fa-spa" title="Servicios Adicionales"></i>
                                    <span class="fs-5 ms-2 d-none d-sm-inline">Servicios adicionales</span>
                                </div>
                            </a>
                            <ul class="collapse nav flex-column ms-1" id="submenu1" data-bs-parent="#menu">
                                <li class="w-100">
                                    <a href="/api/servicios" class="nav-link px-5" title="Servicios disponibles"><i
                                            class="fa fa-list" aria-hidden="true"></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Servicios
                                            disponibles</span>
                                    </a>
                                </li>
                                <li>
                                    <a href="/rackservicios" class="nav-link px-5" title="Ver todos los servicios"><i
                                            class="fa fa-list-alt" aria-hidden="true"></i> <span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Ver todos los
                                            servicios</span>
                                    </a>
                                </li>
                            </ul>
                        </li>`;
                }
                else if (key === "Cabañas") {
                    sideMenuContent +=
                        `<li class="nav-item py-2 py-sm-0">
                            <a href="#submenu2" data-bs-toggle="collapse" class="nav-link px-4 align-middle " title="Cabañas">
                                <i class="fs-5 fa fa-hotel" aria-hidden="true"></i><span
                                    class="fs-5 ms-3 d-none d-sm-inline">Cabañas
                                </span></a>
                            <ul class="collapse nav flex-column ms-1" id="submenu2" data-bs-parent="#menu">
                                <li class="w-100">
                                    <a href="/api/cabanas" class="nav-link px-5" title="Alta Cabañas">
                                        <i class="fas fa-plus"></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Alta cabaña</span>
                                    </a>
                                </li>
                                <li>
                                    <a href="/api/cabanas/editar-cabana" class="nav-link px-5" title="Editar Cabaña">
                                        <i class="fas fa-pencil-alt "></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Editar cabaña</span>
                                    </a>

                                </li>
                                <li>
                                    <a href="/tipologias" class="nav-link px-5" title="Editar Tipologias">
                                                <i class="fa fa-edit" aria-hidden="true"></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Editar Tipologias</span>
                                    </a>

                                </li>
                            </ul>
                        </li>`;
                }
                else if (key === "Encuestas") {
                    sideMenuContent +=
                        `<li class="nav-item py-2 py-sm-0">
                            <a href="#submenu3" data-bs-toggle="collapse" class="nav-link px-4 align-middle " title="Encuestas">
                                <i class="fab fa-wpforms"></i><span
                                    class="fs-5 ms-3 d-none d-sm-inline">Encuestas
                                </span></a>
                            <ul class="collapse nav flex-column ms-1" id="submenu3" data-bs-parent="#menu">
                                <li class="w-100">
                                    <a href="/modelar-encuesta/crear-encuesta" class="nav-link px-5" title="Modificar Encuesta">
                                        <i class="fas fa-pencil-alt "></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Modificar Encuesta</span>
                                    </a>
                                </li>
                                <li>
                                    <a href="/procesar-encuesta/mostrar-respuestas-usuarios" class="nav-link px-5" title="Ver respuestas">
                                        <i class="fas fa-tasks"></i></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Ver respuestas</span>
                                    </a>

                                </li>
                            </ul>
                        </li>`;
                } else if (key === "Utilidades") {
                    sideMenuContent +=
                        `<li class="nav-item py-2 py-sm-0">
                            <a href="#submenu4" data-bs-toggle="collapse" class="nav-link px-4 align-middle " title="Encuestas">
                                <i class="fas fa-chart-line"></i><span
                                    class="fs-5 ms-3 d-none d-sm-inline">Utilidades
                                </span></a>
                            <ul class="collapse nav flex-column ms-1" id="submenu4" data-bs-parent="#menu">
                                <li class="w-100">
                                    <a href="/api/costos/mostrar-costos" class="nav-link px-5" title="Modificar Encuesta">
                                        <i class="fas fa-chart-line "></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Comisiones por Reserva</span>
                                    </a>
                                </li>
                                <li>
                                    <a href="/api/mostrar-utilidades" class="nav-link px-5" title="Ver respuestas">
                                        <i class="fas fa-hand-holding-usd"></i></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Mis Utilidades</span>
                                    </a>

                                </li>
                                <li>
                                    <a href="/api/mostrar-utilidades-globales" class="nav-link px-5" title="Utilidades globales">
                                        <i class="fas fa-globe"></i></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Utilidades globales</span>
                                    </a>

                                </li>
                            </ul>
                        </li>`;
                }else if (key === "Calendarios") {
                    sideMenuContent +=
                        `<li class="nav-item py-2 py-sm-0">
                            <a href="#submenu5" data-bs-toggle="collapse" class="nav-link px-4 align-middle " title="Calendarios">
                                <i class="far fa-calendar-alt"></i><span
                                    class="fs-5 ms-3 d-none d-sm-inline">Calendarios
                                </span></a>
                            <ul class="collapse nav flex-column ms-1" id="submenu5" data-bs-parent="#menu">
                                <li class="w-100">
                                    <a href="/calendario-precios" class="nav-link px-5" title="Calendario precios">
                                        <i class="far fa-calendar-alt"></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Calendario precios</span>
                                    </a>
                                </li>
                                <li>
                                    <a href="/calendario-bloqueofechas" class="nav-link px-5" title="Calendario bloqueos">
                                        <i class="fas fa-window-close"></i></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Calendario bloqueos</span>
                                    </a>

                                </li>
                                <li>
                                    <a href="/calendario-bloqueofechasinversionistas" class="nav-link px-5" title="Calendario inversionistas">
                                        <i class="fas fa-calendar-times"></i></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Calendario inversionistas</span>
                                    </a>

                                </li>
                                <li>
                                    <a href="/plataformas" class="nav-link px-5" title="Plataformas">
                                        <i class="fas fa-laptop-code"></i></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Plataformas</span>
                                    </a>

                                </li>
                            </ul>
                        </li>`;
                } else if (key === "Reportes") {
                    sideMenuContent +=
                        `<li class="nav-item py-2 py-sm-0">
                            <a href="#submenu6" data-bs-toggle="collapse" class="nav-link px-4 align-middle " title="Reportes">
                                <i class="fas fa-chart-line"></i><span
                                    class="fs-5 ms-3 d-none d-sm-inline">Reportes
                                </span></a>
                            <ul class="collapse nav flex-column ms-1" id="submenu6" data-bs-parent="#menu">
                                <li class="w-100">
                                    <a href="/api/reportes" class="nav-link px-5" title="Reservas">
                                        <i class="fas fa-chart-line"></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Reservas</span>
                                    </a>
                                </li>
                            </ul>
                            <ul class="collapse nav flex-column ms-1" id="submenu6" data-bs-parent="#menu">
                                <li class="w-100">
                                    <a href="/api/pagos" class="nav-link px-5" title="Pagos">
                                        <i class="fas fa-money-bill-wave"></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Pagos</span>
                                    </a>
                                </li>
                            </ul>
                            <ul class="collapse nav flex-column ms-1" id="submenu6" data-bs-parent="#menu">
                                <li class="w-100">
                                    <a href="/api/reportes-personalizados" class="nav-link px-5" title="Reportes Completos">
                                        <i class="fas fa-chart-line"></i><span class="d-none d-sm-inline"
                                            style="margin-left: 8px;">Reportes Completos</span>
                                    </a>
                                </li>
                            </ul>
                        </li>`;
                }
                else {
                    sideMenuContent +=
                        `<li class="nav-item">
                        <a href="${route}" class="nav-link align-middle px-4" title="${key}">
                            <i class="${cssClass}"></i><span class="fs-5 ms-3 d-none d-sm-inline">${key}</span>
                        </a>
                    </li>`;
                }
            }
        });
        sideMenuContent +=
            `</ul>
            <hr>
            <div class="offcanvas-footer px-4 pt-5 pb-4 d-flex align-items-end justify-content-start">
                <div class="dropdown mt-auto">
                    <a href="#" class="d-flex align-items-center justify-content-center text-white text-decoration-none dropdown-toggle"
                        id="dropdownUser1" data-bs-toggle="dropdown" aria-expanded="false">
                        <img src="${profileImg}" alt="hugenerd" width="30" height="30" class="rounded-circle">
                        <span class="d-none d-sm-inline mx-1">${req.session.firstName}</span>
                    </a>
                    <ul class="dropdown-menu dropdown-menu-dark text-small shadow">
                        <li><a class="dropdown-item" href="/api/perfil-usuario">Profile</a></li>
                        <li>
                            <hr class="dropdown-divider">
                        </li>
                        <li><a class="dropdown-item" href="/api/auth/logout">Sign out</a></li>
                    </ul>
                </div>
            </div>
        </div>`

        // console.log("ESTE ES EL MENU ENTREGADO: ", sideMenuContent);

        res.status(200).json({ sideMenuContent });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    validators,
    generateSideMenu
};

