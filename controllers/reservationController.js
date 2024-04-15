express = require("express");
const Cliente = require('../models/Cliente');
router = express.Router();

async function showReservationsView(req, res, next){
    try {
        const url = 'http://localhost:3005/api/habitaciones';
        const response = await fetch(url);
        const data = await response.json();
        const habitaciones = data[0].resources.map(habitacion => {
            return { title: habitacion.title, baseRate: habitacion.precio_base };
        });
        console.log(habitaciones);        

        const clientes = await Cliente.find({}).lean();
        console.log(clientes),
        
        res.render('index', {
            habitaciones: habitaciones,
            clientes: clientes
        });
    } catch (error) {
        console.log(error);
        return next(err);
    }
}

module.exports = {
    showReservationsView
};