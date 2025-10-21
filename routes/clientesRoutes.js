const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const validationRequest = require('../common/middlewares/validation-request');
const Cliente = require('../models/Cliente');
const Reserva = require('../models/Evento');

router.get('/clientes/mostrar-clientes', clientController.showClientsView);
router.get('/clientes/show-clients/:id', clientController.showClients);
router.get('/clientes/show-clients', clientController.showAllClients);
router.post('/clientes/crear-cliente', clientController.createClientValidators, validationRequest, clientController.createClient);
router.put('/clientes/editar-cliente', clientController.editClientValidators, validationRequest, clientController.editClient);
router.put('/clientes/editar-cliente/:uuid', clientController.editClientValidators, validationRequest, clientController.editClientById);
router.delete('/clientes/eliminar-cliente', clientController.deleteClientValidators, validationRequest, clientController.deleteClient);
router.delete('/clientes/eliminar-cliente/:uuid', clientController.deleteClientValidators, validationRequest, clientController.deleteClientById);

// Clientes Web
router.get('/clientes/mostrar-clientes-web', clientController.renderClientsWebView);

// Rutas adicionales para el dashboard de clientes web
router.get('/clientes-web/:id', async (req, res) => {
    try {
        const ClienteWeb = require('../models/ClienteWeb');
        const client = await ClienteWeb.findById(req.params.id).lean();
        
        if (!client) {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
        }
        
        res.json(client);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener cliente', error: error.message });
    }
});

router.put('/clientes-web/:id/status', async (req, res) => {
    try {
        const ClienteWeb = require('../models/ClienteWeb');
        const { isActive } = req.body;
        
        const client = await ClienteWeb.findByIdAndUpdate(
            req.params.id, 
            { isActive }, 
            { new: true }
        );
        
        if (!client) {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
        }
        
        res.json({ success: true, message: 'Estado actualizado correctamente', client });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar estado', error: error.message });
    }
});

router.get('/clientes-web/export/csv', async (req, res) => {
    try {
        const ClienteWeb = require('../models/ClienteWeb');
        const clients = await ClienteWeb.find().lean();
        
        // Crear CSV
        const csvHeader = 'ID,Nombre,Apellido,Email,Telefono,Método de Registro,Email Verificado,Activo,Fecha de Registro,Último Login\n';
        const csvData = clients.map(client => 
            `${client._id},"${client.firstName}","${client.lastName}","${client.email}","${client.phone || ''}","${client.registrationMethod}","${client.isEmailVerified}","${client.isActive}","${client.createdAt}","${client.lastLogin || ''}"`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="clientes-web.csv"');
        res.send(csvHeader + csvData);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al exportar datos', error: error.message });
    }
});

router.put('/clientes-web/:id', async (req, res) => {
    try {
        const ClienteWeb = require('../models/ClienteWeb');
        const { firstName, lastName, email, phone, address, isActive, password } = req.body;
        
        const updateData = {
            firstName,
            lastName,
            email,
            phone,
            address,
            isActive
        };
        
        // Solo actualizar password si se proporcionó
        if (password && password.trim() !== '') {
            if (password.length < 6) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'La contraseña debe tener al menos 6 caracteres' 
                });
            }
            updateData.password = password;
        }
        
        const client = await ClienteWeb.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!client) {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
        }
        
        res.json({ 
            success: true, 
            message: 'Cliente actualizado correctamente', 
            client: client.toPublicJSON() 
        });
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al actualizar cliente', 
            error: error.message 
        });
    }
});

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