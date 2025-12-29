const express = require('express');
const router = express.Router();
const cronTasksController = require('../controllers/cronTasksController');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(ensureAuthenticated);

/**
 * @route   POST /api/cron/ejecutar-recurrentes
 * @desc    Ejecutar manualmente transacciones recurrentes (para pruebas)
 * @access  Usuario autenticado
 */
router.post('/ejecutar-recurrentes', cronTasksController.ejecutarRecurrentesManual);

/**
 * @route   POST /api/cron/verificar-cuotas
 * @desc    Verificar manualmente cuotas vencidas (para pruebas)
 * @access  Usuario autenticado
 */
router.post('/verificar-cuotas', cronTasksController.verificarCuotasManual);

/**
 * @route   POST /api/cron/notificar-cuotas-proximas
 * @desc    Verificar manualmente cuotas próximas (para pruebas)
 * @access  Usuario autenticado
 */
router.post('/notificar-cuotas-proximas', cronTasksController.notificarCuotasProximasManual);

/**
 * @route   POST /api/cron/ejecutar-todas
 * @desc    Ejecutar todas las tareas cron manualmente (para pruebas)
 * @access  Usuario autenticado
 */
router.post('/ejecutar-todas', cronTasksController.ejecutarTodasLasTareas);

module.exports = router;
