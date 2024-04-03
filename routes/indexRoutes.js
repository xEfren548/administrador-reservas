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
const instruccionesUsuario = require('./instruccionesUsuario');
const loginRoute = require("./loginRoute");
const serviciosRoutes = require('./serviciosRoutes');
const userRoutes = require('./userRoutes');

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

// Validating user's token in later requests.
//router.use(currentuser);

// Determining user access based on privileges.
//router.use(userPrivilege);

// Use middlewares.
router.use('/', instruccionesUsuario);
router.use('/api', 
    eventRoutes, 
    habitacionesRoutes, 
    serviciosRoutes, 
    clientesRoutes, 
    cabanasRoutes, 
    editarCabanaRoutes,
    dashboardRoutes);
router.use('/api/usuarios', userRoutes);

// Get middlewares.
router.get('/', (req, res) => {
    res.render('index'); 
});
router.get('/api/racklimpieza', (req, res) => {
    res.render('rackLimpieza');
});

// Not found resource handling middleware.
router.all("*", (req, res, next) => {
    const error = new Error("Resource not found");
    error.status = 404;
    next(error);
});

// Error handling middleware.
router.use((err, req, res, next) => {
    if(err.status){
        res.status(err.status).json({error: err.message})
        return;
    }
    res.status(500).json({error: "Internal server error: something went wrong: "});
});

module.exports = router;