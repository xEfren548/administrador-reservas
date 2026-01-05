express = require("express");
router = express.Router();

const Cliente = require('../models/Cliente');
const Habitacion = require("../models/Habitacion");
const TipologiasCabana = require('../models/TipologiasCabana');
const NotFoundError = require("../common/error/not-found-error");
const Roles = require("../models/Roles");
const permissions = require('../models/permissions');
const roomGroupService = require('../services/roomGroupService');


const {check} = require("express-validator");

const showReservationsViewValidators = [
    check()
        .custom(async (value, { req }) => {
            const habitaciones = await Habitacion.find({}).sort({ 'propertyDetails.name': 1 });
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
            habitaciones = await Habitacion.find({_id: assignedChalets, isActive: true}).lean().sort({ 'propertyDetails.name': 1 });
        } else {
            habitaciones = await Habitacion.find( {isActive: true}).lean().sort({ 'propertyDetails.name': 1 });
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
        
        // Obtener grupos de habitaciones
        const grupos = await roomGroupService.getAllGroups();
        const habitacionesEnGrupos = new Set();
        
        // Recopilar IDs de habitaciones que están en grupos
        grupos.forEach(grupo => {
            grupo.rooms.forEach(room => {
                habitacionesEnGrupos.add(room._id.toString());
            });
        });
        
        // Separar habitaciones: las que NO están en grupos
        const habitacionesNoAgrupadas = habitaciones.filter(
            h => !habitacionesEnGrupos.has(h._id.toString())
        );
        
        // Crear lista de chalets no agrupados
        const chalets = habitacionesNoAgrupadas.map(chalet => {
            return {
                name: chalet.propertyDetails.name,
                basePrice: chalet.others.basePrice,
                pax: chalet.propertyDetails.maxOccupancy,
                tipologia: chalet.propertyDetails.accomodationType,
                id: chalet._id?.toString(),
                isGroup: false
            };
        });
        
        // Crear lista de grupos para el select
        const gruposParaSelect = grupos.map(grupo => {
            return {
                name: grupo.groupName,
                basePrice: grupo.groupInfo.basePrice,
                pax: grupo.groupInfo.maxOccupancy,
                tipologia: grupo.groupInfo.accomodationType,
                id: `group:${grupo.groupName}`, // Prefijo para identificar grupos
                isGroup: true,
                totalRooms: grupo.totalRooms
            };
        });
        
        // Combinar habitaciones no agrupadas con grupos
        const chaletsYGrupos = [...chalets, ...gruposParaSelect];

        // Verify we still have valid chalets after filtering
        if (!chaletsYGrupos.length) {
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
            chalets: chaletsYGrupos,
            habitacionesIndividuales: habitaciones.map(h => ({
                name: h.propertyDetails.name,
                tipologia: h.propertyDetails.accomodationType,
                id: h._id?.toString()
            })),
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