const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Usuario = require('../models/Usuario');
const logController = require('../controllers/logController');
const sendPassword = require("../utils/email");
const NotFoundError = require("../common/error/not-found-error");
const BadRequestError = require("../common/error/bad-request-error");
const {check} = require("express-validator");

// No uuid validator has been implemented for functions that take parameters form the URL.
const createUserValidators = [
    check(['firstName', 'lastName'])
        .notEmpty().withMessage(`Full name is required`)
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid full name format")
        .isLength({ max: 255 }).withMessage("Full name must be less than 255 characters"),
    check('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const user = await Usuario.findOne({ email: value });
            if (user) {
                throw new NotFoundError('Email already taken');
            }
            return true;
        }),
    check('password')
        .notEmpty().withMessage('Password is required')
        //.isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number'),
        //.matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),        
    check('privilege')
        .notEmpty().withMessage('Privilege is required')
        .isIn(['Administrador', 'Vendedor', 'Limpieza', 'Dueño de cabañas', 'Servicios adicionales', 'Inversionistas', 'Colaborador dueño']).withMessage('Invalid privilege'),
    check('administrator')
        // .notEmpty().withMessage("Administrator's name is required")
        .isLength({ max: 255 }).withMessage("Administrator's name must be less than 255 characters")
        .custom(async (value, { req }) => {
            if (value){
                const admin = await Usuario.findOne({_id: value, privilege: {"$in": ["Administrador", "Vendedor"]}});
                if(!admin){
                    const owner = await Usuario.findOne({_id: value, privilege: 'Dueño de cabañas'});
                    if (!admin && !owner){
                        throw new NotFoundError('Administrator or owner does not exist');
                    }
                }
                return true;

            }
        }),
];

const editUserValidators = [
    check(['firstName', 'lastName'])
        .optional({ checkFalsy: true })
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid full name format")
        .isLength({ max: 255 }).withMessage("Full name must be less than 255 characters"),
    check('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const user = await Usuario.findOne({ email: value });
            if (!user) {
                throw new NotFoundError('Email not registered');
            }
            return true;
        }),
    check('password')
        .optional({ checkFalsy: true })
        //.isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number'),
        //.matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
    check('privilege')
        .optional({ checkFalsy: true }),
        // .isIn(['Administrador', 'Vendedor', 'Limpieza']).withMessage('Invalid identification type'),
    check('administrator')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Administrator's name must be less than 255 characters")
        .custom(async (value, { req }) => {
            //console.log("¿ADMIN? ", value);
            if (value) {
                const admin = await Usuario.findOne({_id: value, privilege: {"$in": ["Administrador", "Vendedor"]}});
                if(!admin){
                    const owner = await Usuario.findOne({_id: value, privilege: 'Dueño de cabañas'});
                    if (!admin && !owner){
                        throw new NotFoundError('Administrator or owner does not exist');
                    }
                }
                return true;

            }
        }),
    check()
        .custom((value, { req }) => {
            const { firstName, lastName, password, privilege, administrator, color } = req.body;
            if(!firstName && !lastName && !password && !privilege && !administrator && !color){
                throw new BadRequestError("There should be at least one field to update.")
            }
            return true;
        })
];

const deleteUserValidators = [
    check('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const user = await Usuario.findOne({ email: value });
            if (!user) {
                throw new NotFoundError('Email not registered');
            }
            return true;
        }),
];

async function showUsersView(req, res, next){
    try {
        const users = await Usuario.find({}).lean();
        if (!users) {
            throw new NotFoundError("No users found");
        }

        const admins = await Usuario.find({"$or": [{"privilege": "Administrador"}, {"privilege": "Vendedor"}]}).lean();
        if (!admins) {
            throw new NotFoundError("No admin found");
        }

        const owners = await Usuario.find({"privilege": "Dueño de cabañas"}).lean()
        if (!owners) {
            throw new NotFoundError("No owner found");
        }

        console.log(owners)

        res.render('vistaUsuarios', {
            users: users,
            admins: admins,
            owners: owners
        });
    } catch (err) {
        return next(err);
    }
}

async function createUser(req, res, next) {
    const { firstName, lastName, email, password, privilege, administrator, adminname, color, investorType } = req.body;
    const userToAdd = new Usuario ({
        firstName, lastName, email, password, privilege, administrator,adminname, color, investorType
    });

    try{    
        sendPassword(userToAdd.email, userToAdd.password, userToAdd.privilege);        
        await userToAdd.save();
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'registration',
            acciones: `Usuario creado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`,
        }
        
        await logController.createBackendLog(logBody);
        res.status(200).json( { success: true, message: "Usuario agregado con éxito"} );
    } catch(err){
        console.log(err);
        return next(err);
    }   
}

async function obtenerUsuarioPorId(req, res, next){
    const { uuid } = req.params;

    if(!uuid){
        return next(new BadRequestError("Missing info in URL"));
    }

    let userToFind;
    try{
        userToFind = await Usuario.findById(uuid);

        console.log("Usuario recuperado con éxito");
        res.status(200).json( {userToFind} );
    
    } catch(err){
        return next(err);
    }    
}

async function obtenerUsuarioPorIdMongo(uuid){

    if(!uuid){
        return next(new BadRequestError("Missing info in URL"));
    }

    let userToFind;
    try{
        userToFind = await Usuario.findById(uuid).lean();

        console.log("Usuario recuperado con éxito");
        return userToFind;
    
    } catch(err){
        return err;
    }    
}

async function editarUsuario(req, res, next) {
    const { firstName, lastName, email, password, privilege, administrator,adminname, color, investorType } = req.body;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    if (password) {
        const salt = await bcrypt.genSalt(10);
        updateFields.password = await bcrypt.hash(password, salt);
    }
    if (privilege) { updateFields.privilege = privilege; }
    if (administrator) { updateFields.administrator = administrator; }
    if (adminname) { updateFields.adminname = adminname; }
    if (color) { updateFields.color = color; }
    if (investorType) { updateFields.investorType = investorType; }

    try {
        const userToUpdate = await Usuario.findOneAndUpdate({ email }, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'modification',
            acciones: `Usuario editado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }
        
        await logController.createBackendLog(logBody);
        res.status(200).json({ success: true, message: "Usuario editado con éxito" });
    } catch(err) {
        return next(err);
    }
}

// Maybe this function is not completely necessary.
async function editarUsuarioPorId(req, res, next) {   
    const { uuid } = req.params;
    const { firstName, lastName, email, password, privilege, administrator,adminname } = req.body;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    if (email) { updateFields.email = email; }
    if (password) { updateFields.password = password; }
    if (privilege) { updateFields.privilege = privilege; }
    if (administrator) { updateFields.administrator = administrator; }
    if (adminname) { updateFields.adminname = adminname; }

    try{
        const userToUpdate = await Usuario.findByIdAndUpdate(uuid, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'modification',
            acciones: `Usuario editado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }
        
        await logController.createBackendLog(logBody);

        console.log("Usuario editado con éxito");
        res.status(200).json({ userToUpdate });
    } catch(err){
        return next(err);
    }
}

async function deleteUser(req, res, next) {
    const { email } = req.body;

    try {
        const userToDelete = await Usuario.findOneAndDelete({ email });
        if (!userToDelete) {
            throw new NotFoundError("Client not found");
        }

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'elimination',
            acciones: `Usuario eliminado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }
        
        await logController.createBackendLog(logBody);
        res.status(200).json({ success: true, message: "Usuario eliminado con éxito" });
    } catch(err) {
        return next(err);
    }    
}

// Maybe this function is not completely necessary.
async function eliminarUsuarioPorId(req, res, next) {
    const { uuid } = req.params;

    if(!uuid){
        return next(new BadRequestError("Missing info in URL"));  
    }

    try{
        await Usuario.findByIdAndDelete(uuid);

        console.log("Usuario eliminado con éxito");
        res.status(200).json({ success: true });
    } catch(err){
        return next(err);
    }    
}

module.exports = {
    createUserValidators,
    editUserValidators,
    deleteUserValidators,
    showUsersView,
    createUser,
    obtenerUsuarioPorId,
    obtenerUsuarioPorIdMongo,
    editarUsuario,
    editarUsuarioPorId,
    deleteUser,
    eliminarUsuarioPorId
}