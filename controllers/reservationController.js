express = require("express");
router = express.Router();

const Cliente = require('../models/Cliente');
const Habitacion = require("../models/Habitacion");
const TipologiasCabana = require('../models/TipologiasCabana');
const NotFoundError = require("../common/error/not-found-error");
const Roles = require("../models/Roles");
const permissions = require('../models/permissions');


const {check} = require("express-validator");

const showReservationsViewValidators = [
    check()
        .custom(async (value, { req }) => {
            const habitaciones = await Habitacion.find({});
            if(!habitaciones){
                throw new NotFoundError("No rooms found");
            }
            return true;
        }),
    check()
        .custom(async (value, { req }) => {
            const clientes = await Cliente.find({});
            if(!clientes){
                throw new NotFoundError("No clients found");
            }
            return true;
        }),
];
// VIEW_MAIN_CALENDAR: 'Ver calendario principal'
async function showReservationsView(req, res, next) {
    try {
        const privilege = req.session.privilege;
        let habitaciones = [];
        if (privilege === "Vendedor"){
            const assignedChalets = req.session.assignedChalets;
            habitaciones = await Habitacion.find({_id: assignedChalets}).lean();
        } else {
            habitaciones = await Habitacion.find().lean();
        }
        // const habitaciones = await Habitacion.find().lean();
        if(!habitaciones){
            throw new Error("No room found");
        }
        const data = habitaciones;

        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "VIEW_MAIN_CALENDAR";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para ver el calendario principal");
        }


        // console.log(data);
        const chalets = habitaciones.map(chalet => {
            return {
                name: chalet.propertyDetails.name,
                basePrice: chalet.others.basePrice,
                pax: chalet.propertyDetails.maxOccupancy,
                tipologia: chalet.propertyDetails.accomodationType,
                id: chalet._id?.toString()
            };
        })

        // Verify we still have valid chalets after filtering
        if (!chalets.length) {
            throw new Error("No hay información de cabañas o el usuario no tiene cabañas asignadas");
        }
        // console.log("Estos son los chalets: ", chalets);

        const clientes = await Cliente.find({}).lean();
        if(!clientes){
            throw new NotFoundError("No client not found");
        }

        const tipologias = await TipologiasCabana.find().lean();
        if (!tipologias) {
            throw new NotFoundError("No tipologies found");
        }

        console.log(req.session)

        res.render('index', {
            chalets: chalets,
            clientes: clientes,
            tipologias: tipologias
        });
    } catch (error) {
        console.log(error);
        return next(error);
    }
}



module.exports = {
    showReservationsViewValidators,
    showReservationsView,
};