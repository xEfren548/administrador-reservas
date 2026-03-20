const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../common/middlewares/authMiddleware');
const swCategoriaController = require('../controllers/swCategoriaController');

router.use(ensureAuthenticated);

router.get('/categorias', swCategoriaController.getCategoriasFinancieras);
router.put('/categorias', swCategoriaController.updateCategoriasFinancieras);

module.exports = router;
