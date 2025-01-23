const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const validationRequest = require('../common/middlewares/validation-request');
const Cliente = require('../models/Cliente');
const Reserva = require('../models/Evento');

router.get('/clientes/mostrar-clientes', clientController.showClientsView);
router.get('/clientes/show-clients/:id', clientController.showClients);
router.post('/clientes/crear-cliente', clientController.createClientValidators, validationRequest, clientController.createClient);
router.put('/clientes/editar-cliente', clientController.editClientValidators, validationRequest, clientController.editClient);
router.put('/clientes/editar-cliente/:uuid', clientController.editClientValidators, validationRequest, clientController.editClientById);
router.delete('/clientes/eliminar-cliente', clientController.deleteClientValidators, validationRequest, clientController.deleteClient);
router.delete('/clientes/eliminar-cliente/:uuid', clientController.deleteClientValidators, validationRequest, clientController.deleteClientById);

router.put('/clientes/asignar-cliente', async (req, res, next) => {
    const { email, idReservation } = req.body;

    try {
        const confirmation = await asignClientToReservation(email, idReservation);

        if (!confirmation || confirmation instanceof Error) {
            throw new Error(confirmation?.message || "An unknown error occurred.");
        }

        res.status(200).json({ message: "Client assigned to reservation successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

async function asignClientToReservation(email, idReservation) {
    try {
        console.log("Assigning client:", { email, idReservation });

        // Check if client exists
        const user = await Cliente.findOne({ email });
        if (!user) {
            throw new Error("Client not found");
        }

        // Check if reservation exists
        const reservation = await Reserva.findById(idReservation);
        if (!reservation) {
            throw new Error("Reservation not found");
        }

        // Assign client to reservation
        reservation.client = user._id;

        // Save the updated reservation
        const confirmation = await reservation.save();
        if (!confirmation) {
            throw new Error("Error assigning client to reservation");
        }

        return confirmation; // Return confirmation of success
    } catch (err) {
        console.error("Error in asignClientToReservation:", err.message);
        return err; // Return the error object for further handling
    }
}


module.exports = router;