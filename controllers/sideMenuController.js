const Usuario = require('../models/Usuario');
const {check} = require("express-validator");
const NotFoundError = require("../common/error/not-found-error");
const { variationPlacements } = require('@popperjs/core');

const validators = [
    check()
        .custom(async (value, { req }) => {
            if (req.session.privilege != 'Administrador' && req.session.privilege != 'Vendedor' 
                && req.session.privilege != 'Limpieza') {
                throw new NotFoundError('Privilege does not exists.');
            }
            return true;
        }),
];

async function generateSideMenu (req, res, next) {
    try{
        const privileges = {     
            "Administrador": [
                {'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"]},
                {'Home': ["/", "fs-5 fa fa-house"]},
                {'Usuarios': ["/api/usuarios", "fas fa-users"]},
                {'Clientes': ["/api/clientes/mostrar-clientes", "fa fa-user-circle"]},
                {'Servicios adicionales': ["/api/servicios", "fas fa-spa"]},
                {'Limpieza': ["/api/racklimpieza", "fas fa-broom"]},
                {'Alta cabaña': ["/api/cabanas", "fas fa-plus"]},
                {'Editar cabaña': ["/api/cabanas/editar-cabana", "fas fa-pencil-alt"]},
                {'Reserva cliente cabaña': ["/instrucciones/", "far fa-calendar-alt"]},
            ],        
            'Vendedor': [
                {'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"]},
                {'Home': ["/", "fs-5 fa fa-house"]},
                {'Reserva cliente cabaña': ["/instrucciones/", "far fa-calendar-alt"]},                
            ],            
            'Limpieza': [
                {'Dashboard': ["/dashboard", "fs-5 fa fa-chart-bar"]},
                {'Limpieza': ["/racklimpieza", "fas fa-broom"]},
            ],
            'Servicios adicionales': [
                {'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"]},
                {'Servicios adicionales': ["/api/servicios", "fas fa-spa"]},                
            ],
            'Dueño de cabañas': [
                {'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"]},
            ],
            'Inversionistas': [
                {'Dashboard': ["/api/dashboard", "fs-5 fa fa-chart-bar"]},
            ],            
            'Cliente': [
                {'Home': ["/", "fs-5 fa fa-house"]},
            ],
        }
        const routes = privileges[req.session.privilege];

        var sideMenuContent = 
            `<a href="" class="d-flex text-decoration-none mt-1 align-items-center text-white">
                <span class="fs-4 d-none d-sm-inline" href="/">SideMenu</span>
            </a>
            <ul class="nav nav-pills flex-column mt-4 ">`;
        routes.forEach(item => {
            for (const key in item) {
                const route = item[key][0];
                const cssClass = item[key][1];
                sideMenuContent += 
                `<li class="nav-item py-2 py-sm-0">
                    <a href="${route}" class="nav-link text-white">
                        <i class="${cssClass}"></i><span
                            class="fs-4 ms-3 d-none d-sm-inline">${key}</span>
                    </a>
                </li>`;  
            }
        });
        sideMenuContent += 
            `</ul>
            <hr>
            <div class="dropdown pb-4">
                <a href="#" class="d-flex align-items-center text-white text-decoration-none dropdown-toggle" id="dropdownUser1" data-bs-toggle="dropdown" aria-expanded="false">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png" alt="hugenerd" width="30" height="30" class="rounded-circle">
                    <span class="d-none d-sm-inline mx-1">${req.session.firstName}</span>
                </a>
                <ul class="dropdown-menu dropdown-menu-dark text-small shadow" aria-labelledby="dropdownUser1">
                    <li><a class="dropdown-item" href="#">Settings</a></li>
                    <li>
                        <hr class="dropdown-divider">
                    </li>
                    <li><a class="dropdown-item" href="/api/auth/logout">Sign out</a></li>
                </ul>
            </div>`;  

        // console.log("ESTE ES EL MENU ENTREGADO: ", sideMenuContent);

        res.status(200).json({sideMenuContent});
    } catch(err){
        return next(err);
    }
}

module.exports = {
    validators,
    generateSideMenu
};

