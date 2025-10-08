const Router = require('express').Router();
const generalController = require('../../controllers/webClientes/generalController');

// Habitaciones
Router.get('/habitaciones/:id', generalController.mostrarUnaHabitacion);
Router.get('/habitaciones', generalController.mostrarTodasHabitaciones);

// Cotizador
Router.get('/cotizar/search', generalController.cotizadorChaletsyPrecios);
Router.post('/reservas/cotizar', generalController.cotizarReservaController);
module.exports = Router;