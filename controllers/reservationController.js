express = require("express");
const Cliente = require('../models/Cliente');
const Habitacion = require("../models/Habitacion");
router = express.Router();

async function showReservationsView(req, res, next) {
    try {
        const url = 'http://localhost:3005/api/habitaciones';
        const response = await fetch(url);
        const data = await response.json();
        console.log(data[0].resources);

        const chalets = data[0].resources.map(chalet => ({
            name: chalet.propertyDetails.name,
            basePrice: chalet.others.basePrice
        }));
        console.log("Estos son los chalets: ", chalets);

        const clientes = await Cliente.find({}).lean();
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
    showReservationsView
};