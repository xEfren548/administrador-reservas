const express = require('express');
const router = express.Router();
const cookieSession = require("cookie-session");

const authRoutes = require('./authRoutes');
const currentUser = require("../common/middlewares/currentUser");
const userPrivilege = require("../common/middlewares/userPrivilege");
const cabanasRoutes = require('./cabanasRoutes');
const clientesRoutes = require('./clientesRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const editarCabanaRoutes = require("./editarCabanaRoutes");
const eventRoutes = require('./eventRoutes');
const habitacionesRoutes = require('./habitacionesRoutes');
const instruccionesRoutes = require('./instruccionesRoutes');
const getchaletsRoutes = require('./getchaletsRoutes');
const loginRoute = require("./loginRoute");
const logsRoutes = require("./logsRoutes");
const serviciosRoutes = require('./serviciosRoutes');
const userRoutes = require('./usersRoutes');
const userProfileRoutes = require('./userProfileRoutes');
const calendarioPrecios = require('./calendarioPreciosRoutes');
const reservationRoutes = require('./reservationRoutes');
const rackLimpiezaRoutes = require('./rackLimpiezaRoutes');
const rackServiciosRoutes = require('./rackServiciosRoutes');
const pagosRoutes = require('./pagosRoutes');
const sideMenuRoutes = require('./sideMenuRoutes');
const costosRoutes = require('./costosRoutes');
const utilidadesRoutes = require('./utilidadesRoutes');
const surveyModelingRoutes = require('./surveyModelingRoutes');
const surveyProcessingRoutes = require('./surveyProcessingRoutes');
const tipologiasRoutes = require('./tipologiasRoutes');
const preciosEspecialesRoutes = require('./preciosEspecialesRoutes');
const bloqueoFechasRoutes = require('./bloqueoFechasRoutes');
const bloqueoInversionistasRoutes = require('./bloqueoInversionistasRoutes');
const rolesRoutes = require('./rolesRoutes');
const webhookRoutes = require('./webHook');
const plataformasRoutes = require('./plataformasRoutes');
const aprobacionesRoutes = require('./aprobacionesRoutes');
const channexRoutes = require('./channexRoutes');
const generalRoutes = require('./webClientesRoutes/generalRoutes');
const paymentsRoutes = require('./paymentsRoutes');
const webhooksRoutes = require('./webhooksRoutes');

// Nuevas rutas para clientes web
const clientAuthRoutes = require('./authClientes/clientAuthRoutes');
const clientFavoritesRoutes = require('./authClientes/clientFavoritesRoutes');

const authMiddleware = require('../common/middlewares/authMiddleware');

// Privileges middlewares authentication
const adminPrivilege = require('../common/middlewares/authPrivileges/authAdmin');


const CustomError = require("../common/error/custom-error");
const NotFoundError = require("../common/error/not-found-error");
const { error } = require('qrcode-terminal');

// Middleware for parsing incoming data
router.use(express.json());
router.use(express.urlencoded({ extended: false }));

// Enable cookie sessions
router.use(cookieSession({
    signed: false, // No extra layer of security will be added.
    secure: false, // Can receive both HTTP and HTTPS requests.
    maxAge: 24 * 60 * 60 * 1000 // 1 day
}));

// Public routes
router.use('/login', loginRoute);
router.use('/', instruccionesRoutes);
router.use('/procesar-encuesta', surveyProcessingRoutes);
router.use('/getchaletsRoutes', getchaletsRoutes);
router.use('/', webhookRoutes);

router.use('/api/client', generalRoutes);
router.use('/payments', paymentsRoutes);
router.use('/webhooks', webhooksRoutes);

// Rutas de autenticación para clientes web
router.use('/client/auth', clientAuthRoutes);

// Rutas de favoritos para clientes web
router.use('/client/favorites', clientFavoritesRoutes);


router.use('/api', authRoutes);

// Static files route
router.use("/download", express.static("download"));

// Grouping routes
router.use('/', authMiddleware)
router.use('/', sideMenuRoutes);
router.use('/', calendarioPrecios);
router.use('/', logsRoutes);
router.use('/', bloqueoFechasRoutes);
router.use('/', bloqueoInversionistasRoutes);
router.use('/', plataformasRoutes);
router.use('/', aprobacionesRoutes);

// API routes
router.use('/api', eventRoutes);
router.use('/api', habitacionesRoutes);
router.use('/api', serviciosRoutes);
router.use('/api', clientesRoutes);
router.use('/api', cabanasRoutes);
router.use('/api', editarCabanaRoutes);
router.use('/api', dashboardRoutes);
router.use('/api/usuarios', userRoutes);
router.use('/api/perfil-usuario', userProfileRoutes);
router.use('/api/pagos', pagosRoutes);
router.use('/api', utilidadesRoutes);
router.use('/api', costosRoutes);
router.use('/api/channex', channexRoutes);

// Additional routes
router.use('/', rackLimpiezaRoutes);
router.use('/', rackServiciosRoutes);
router.use('/', tipologiasRoutes);
router.use('/', preciosEspecialesRoutes);
router.use('/modelar-encuesta', surveyModelingRoutes);
router.use('/', rolesRoutes);

// Reservation route with authentication
router.get('/', authMiddleware, reservationRoutes);

// Not found resource handling middleware
router.all("*", (req, res, next) => {
    next(new NotFoundError("Page not found"));
});

// Error handling middleware
router.use((err, req, res, next) => {
    if (err.statusCode) {
        res.status(err.statusCode).json({ error: err.generateErrors() });
        return;
    }
    // res.status(500).json({ error: "Internal server error: something went wrong", message: err.message });
    res.render('errorView',{
        err: err.message
    })
});

module.exports = router;
    