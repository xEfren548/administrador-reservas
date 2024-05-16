const jwt = require("jsonwebtoken");
const Usuario = require('../models/Usuario');
const sendPassword = require("../utils/email");
const NotFoundError = require("../common/error/not-found-error");
const BadRequestError = require("../common/error/bad-request-error");
const {check} = require("express-validator");

// No uuid validator has been implemented for those functions that take parameters form the URL.
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
        .notEmpty().withMessage('Password is required'),
        /*
        .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
        */
    check('privilege')
        .notEmpty().withMessage('Privilege is required')
        .isIn(['Administrador', 'Vendedor', 'Limpieza', 'Servicios adicionales', 'Dueño de cabañas', 'Inversionistas', 'Cliente']).withMessage('Invalid privilege'),
    check('administrator')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid administrator name format")
        .isLength({ max: 255 }).withMessage("Administrator name must be less than 255 characters")
];

const editUserValidators = [
    check(['firstName', 'lastName'])
        .optional({ checkFalsy: true })
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
        .optional({ checkFalsy: true }),
        /*
        .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
        */
    check('privilege')
        .optional({ checkFalsy: true })
        .isIn(['Administrador', 'Vendedor', 'Limpieza', 'Servicios adicionales', 'Dueño de cabañas', 'Inversionistas', 'Cliente']).withMessage('Invalid identification type'),
    check('administrator')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Administrator name must be less than 255 characters"),
    check()
        .custom((value, { req }) => {
            const { firstName, lastName, password, privilege, administrator } = req.body;
            if(!firstName && !lastName && !password && !privilege && !administrator){
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
        res.render('vistaUsuarios', {
            layout: 'users',
            users: users
        });
    } catch (err) {
        return next(err);
    }
}

async function createUser(req, res, next) {
    const { firstName, lastName, email, password, privilege, administrator } = req.body;
    const userToAdd = new Usuario ({
        firstName, lastName, email, password, privilege, administrator
    });

    try{    
        sendPassword(userToAdd.email, userToAdd.password, userToAdd.privilege);        
        await userToAdd.save();
        
        console.log("Usuario agregado con éxito");
        res.status(200).json( { userToAdd } );
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

async function editarUsuario(req, res, next) {
    const { firstName, lastName, email, password, privilege, administrator } = req.body;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    if (password) { updateFields.password = password; }
    if (privilege) { updateFields.privilege = privilege; }
    if (administrator) { updateFields.administrator = administrator; }

    try {
        const userToUpdate = await Usuario.findOneAndUpdate({ email }, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        console.log("Usuario editado con éxito");
        res.status(200).json({ userToUpdate });
    } catch(err) {
        return next(err);
    }
}

// Maybe this function is not completely necessary.
async function editarUsuarioPorId(req, res, next) {   
    const { uuid } = req.params;
    const { firstName, lastName, email, password, privilege, administrator } = req.body;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    if (email) { updateFields.email = email; }
    if (password) { updateFields.password = password; }
    if (privilege) { updateFields.privilege = privilege; }
    if (administrator) { updateFields.administrator = administrator; }

    try{
        const userToUpdate = await Usuario.findByIdAndUpdate(uuid, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

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

        console.log("Usuario eliminado con éxito");
        res.status(200).json({ success: true });
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
    editarUsuario,
    editarUsuarioPorId,
    deleteUser,
    eliminarUsuarioPorId
}