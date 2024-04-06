const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

router.get('/clientes/mostrar-clientes', clientController.showClientsView);
router.post('/clientes/crear-cliente', /*clientController.validators,*/ clientController.createClient);
router.put('/clientes/editar-cliente', /*clientController.validators,*/ clientController.editClient);
router.put('/clientes/editar-cliente/:uuid', /*clientController.validators,*/ clientController.editClientById);
router.delete('/clientes/eliminar-cliente', clientController.deleteClient);
router.delete('/clientes/eliminar-cliente/:uuid', clientController.deleteClientById);

module.exports = router;