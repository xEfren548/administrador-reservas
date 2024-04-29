const express = require('express');
const router = express.Router();
const cookieSession = require("cookie-session");

const authRoutes = require('./authRoutes');
const currentuser = require("../common/middlewares/currentUser")
const userPrivilege = require("../common/middlewares/userPrivilege")
const cabanasRoutes = require('./cabanasRoutes');
const clientesRoutes = require('./clientesRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const editarCabanaRoutes = require("./editarCabanaRoutes");
const eventRoutes = require('./eventRoutes');
const habitacionesRoutes = require('./habitacionesRoutes');
const instruccionesRoutes = require('./instruccionesRoutes');
const loginRoute = require("./loginRoute");
const serviciosRoutes = require('./serviciosRoutes');
const userRoutes = require('./usersRoutes');
const userProfileRoutes = require('./userProfileRoutes');
const calendarioPrecios = require('./calendarioPreciosRoutes');
const reservationRoutes = require('./reservationRoutes');
const CustomError = require("../common/error/custom-error");
const NotFoundError = require("../common/error/not-found-error");

// Formating incoming data.
router.use(express.json());
router.use(express.urlencoded( {extended: false} ));

// Enabling cookies.
router.use(cookieSession({
    signed: false, // No extra layer of security will be added.
    secure: false // Can recieve both HTTP and HTTPS request.
}));

// Public routes
router.use('/login', loginRoute);
router.use("/api", authRoutes);

//Validating user's token in later requests.
router.use(currentuser);

//Determining user access based on privileges.
router.use(userPrivilege);

router.use("/download", express.static("download"));

router.use('/', 
    instruccionesRoutes,
    calendarioPrecios);
router.use('/api', 
    eventRoutes, 
    habitacionesRoutes, 
    serviciosRoutes, 
    clientesRoutes, 
    cabanasRoutes, 
    editarCabanaRoutes,
    dashboardRoutes);
router.use('/api/usuarios', userRoutes);
router.use('/api/perfil-usuario/', userProfileRoutes);

router.get('/', reservationRoutes);
router.get('/api/racklimpieza', (req, res) => {
    res.render('rackLimpieza');
});

router.use('/api', eventRoutes);
router.use('/api', habitacionesRoutes);
router.use('/api', userRoutes);
router.use('/api', serviciosRoutes);
router.use('/', calendarioPrecios);

// Not found resource handling middleware.
router.all("*", (req, res, next) => {
    next(new NotFoundError("Page not found"));
});

// Error handling middleware.
router.use((err, req, res, next) => {
    if(err.statusCode){
        res.status(err.statusCode).json({error: err.generateErrors()})
        return;
    }
    res.status(500).json({error: "Internal server error: something went wrong", message: err.message });
});

module.exports = router;