const Usuario = require('../models/Usuario');
const {check} = require("express-validator");
const NotFoundError = require("../common/error/not-found-error");
const { variationPlacements } = require('@popperjs/core');

const validators = [
    check()
        .custom(async (value, { req }) => {
            if (req.session.privilege != 'test' && req.session.privilege != 'Administrador' && 
                req.session.privilege != 'Vendedor' && req.session.privilege != 'Limpieza') {
                throw new NotFoundError('Privilege does not exists.');
            }
            return true;
        }),
];

async function generateSideMenu (req, res, next) {
    try{
        const privileges = {
            "test": [
                {'a': ["route/a", "class a"]},
                {'b': ["route/b", "class b"]},
                {'c': ["route/c", "class c"]},
            ],        
            "Administrador": [
                {'d': ["route/d", "class d"]},
                {'e': ["route/e", "class e"]},
                {'f': ["route/f", "class f"]},
            ],
            'Test': [
                {'g': ["route/g", "class g"]},
                {'h': ["route/h", "class h"]},
                {'i': ["route/i", "class i"]},
            ],            
            'Vendedor': [
                {'j': ["route/j", "class j"]},
                {'k': ["route/k", "class k"]},
                {'l': ["route/l", "class l"]},
            ],            
            'Limpieza': [
                {'m': ["route/m", "class m"]},
                {'n': ["route/n", "class n"]},
                {'o': ["route/n", "class o"]},
            ],
        }
        const routes = privileges[req.session.privilege];

        var sideMenuContent = "";
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
        console.log(sideMenuContent);

        res.status(200).json({sideMenuContent});
    } catch(err){
        return next(err);
    }
}

module.exports = {
    validators,
    generateSideMenu
};

