express = require("express");
const Cliente = require('../models/Cliente');
const Habitacion = require("../models/Habitacion");
router = express.Router();

async function showReservationsView(req, res, next) {
    try {
        const habitaciones = await Habitacion.find();
        const data = habitaciones;
        // console.log(data);

        const chalets = data[0].resources.map(chalet => ({
            name: chalet.propertyDetails.name,
            basePrice: chalet.others.basePrice,
            pax: chalet.propertyDetails.maxOccupancy
        }));
        // console.log("Estos son los chalets: ", chalets);

        const clientes = await Cliente.find({}).lean();
        // console.log(chalets);

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
    showReservationsView
};