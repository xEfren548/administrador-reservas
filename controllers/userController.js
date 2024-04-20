const jwt = require("jsonwebtoken");
const Usuario = require('../models/Usuario');
const sendPassword = require("../utils/email");

async function createUser(req, res, next) {
    const { firstName, lastName, email, password, privilege, administrator } = req.body;

    if(!firstName || !lastName || !email || !password || !privilege || !administrator){
        error = new Error("Falta información en el request");
        error.status = 400;    
        return next(error);
    }

async function obtenerUsuarios(req, res) { 
    try {
        const usuarios = await Usuario.find();
        const usuariosJSON = usuarios.map(usuario => usuario.toObject()); // Convertir documentos de usuario a objetos JSON planos
        return usuariosJSON;
    } catch (error) {
        console.error(error);
        throw new Error('Error al obtener usuarios como JSON');
    }
}

    try{    
        sendPassword(userToAdd.email, userToAdd.password, userToAdd.privilege);        
        await userToAdd.save();
        
        // Generating authentiation token.
        // const token = jwt.sign({ email, userId: userToAdd._id }, "secret_key", { expiresIn: "1h" });

        console.log("Usuario agregado con éxito");
        res.status(200).json( {success: true} );

    } catch(err){
        console.log(err);
        return next(err);
    }   
}

async function mostrarVistaUsuarios(req, res, next){
    try {
        req.render = true;
        const users = await mostrarUsuarios(req, res, next);
        
    } catch (err) {
        return next(err);
    }
}

async function mostrarUsuarios(req, res, next) { 
    let users = [];
    try {
        users = await Usuario.find({});

        console.log("Usuarios mostrados con éxito");
        if(!req.render){
            res.status(200).json( {users} );
        } else if(req.render && req.render === true){
            res.render('vistaUsuarios', {
                layout: 'users',
                users: users
            });
        }

    } catch (err) {
        return next(err);
    }
}

async function obtenerUsuarioPorId(req, res, next){
    const { uuid } = req.params;

    if(!uuid){
        error = new Error("Falta información en la URL.");
        error.status = 400;    
        return next(error);
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

    console.log(req.body);
    if (!email || (!firstName && !lastName && !password && !privilege && !administrator)) {
        error = new Error("Falta información en el request.");
        error.status = 400;    
        return next(error);
    }

    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    if (password) { updateFields.password = password; }
    if (privilege) { updateFields.privilege = privilege; }
    if (administrator) { updateFields.administrator = administrator; }

    try {
        // Buscar el usuario por su dirección de correo electrónico
        const userToUpdate = await Usuario.findOneAndUpdate({ email }, updateFields, { new: true });

        if (!userToUpdate) {
            // Si no se encuentra el usuario, devolver un error
            const error = new Error("El usuario no fue encontrado.");
            error.status = 404;
            throw error;
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

    if(!uuid || (!firstName && !lastName && !email && !password && !privilege && !administrator)){
        error = new Error("Falta información en el request.");
        error.status = 400;    
        return next(error);
    }

    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    if (email) { updateFields.email = email; }
    if (password) { updateFields.password = password; }
    if (privilege) { updateFields.privilege = privilege; }
    if (administrator) { updateFields.administrator = administrator; }

    try{
        userToUpdate = await Usuario.findByIdAndUpdate(uuid, updateFields, { new: true });

        console.log("Usuario editado con éxito");
        res.status(200).json({ userToUpdate });
    
    } catch(err){
        return next(err);
    }
}

async function eliminarUsuario(req, res, next) {
    const { uuid } = req.params;

    if(!uuid){
        error = new Error("Falta información en el request.");
        error.status = 400;    
        return next(error);   
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
    createUser,
    mostrarVistaUsuarios,
    mostrarUsuarios,
    obtenerUsuarioPorId,
    editarUsuario,
    editarUsuarioPorId,
    eliminarUsuario
}