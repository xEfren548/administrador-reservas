express = require("express");
const Cliente = require('../models/Cliente');
const Habitacion = require("../models/Habitacion");
router = express.Router();
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

async function showReservationsView(req, res, next) {
    try {
        const habitaciones = await Habitacion.find();
        if(!habitaciones){
            throw new NotFoundError("No room found");
        }
        const data = habitaciones;
        console.log(data);

        const chalets = data[0].resources.map(chalet => ({
            name: chalet.propertyDetails.name,
            basePrice: chalet.others.basePrice
        }));
        console.log("Estos son los chalets: ", chalets);

        const clientes = await Cliente.find({}).lean();
        if(!clientes){
            throw new NotFoundError("No client not found");
        }
        console.log(clientes);

        res.render('index', {
            chalets: chalets,
            clientes: clientes
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