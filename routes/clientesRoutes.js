const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const validationRequest = require('../common/middlewares/validation-request');

router.get('/clientes/mostrar-clientes', clientController.showClientsView);
router.get('/clientes/show-clients/:id', clientController.showClients);
router.post('/clientes/crear-cliente', clientController.createClientValidators, validationRequest, clientController.createClient);
router.put('/clientes/editar-cliente', clientController.editClientValidators, validationRequest, clientController.editClient);
router.put('/clientes/editar-cliente/:uuid', clientController.editClientValidators, validationRequest, clientController.editClientById);
router.delete('/clientes/eliminar-cliente', clientController.deleteClientValidators, validationRequest, clientController.deleteClient);
router.delete('/clientes/eliminar-cliente/:uuid', clientController.deleteClientValidators, validationRequest, clientController.deleteClientById);

module.exports = router;