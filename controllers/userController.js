const Usuario = require('../models/Usuario');

async function logIn(req, res, next){
    const { email, password } = req.body;

    if(!email || !password){
        error = new Error("Falta información en el request");
        error.status = 400;    
        return next(error);
    }

    try{
        const user = await Usuario.findOne({ email });
        if(!user){
            error = new Error("Wrong credentials");
            error.status = 401;    
            return next(error);
        }

        const pwdEqual = user.password === password;
        if(!pwdEqual){
            error = new Error("Wrong credentials");
            error.status = 401;    
            return next(error);
        }

        console.log("Usuario logeado con éxito");
        res.status(200).json( {user} );

    } catch(err){
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

async function agregarUsuario(req, res, next) {
    const { firstName, lastName, email, password, privilege, administrator } = req.body;

    if(!firstName || !lastName || !email || !password || !privilege || !administrator){
        error = new Error("Falta información en el request");
        error.status = 400;    
        return next(error);
    }

    const userToAdd = new Usuario ({
        firstName, lastName, email, password, privilege, administrator
    });

    try{    
        await userToAdd.save();

        console.log("Usuario agregado con éxito");
        res.status(200).json( {userToAdd} );

    } catch(err){
        return next(err);
    }   
}

async function editarUsuario(req, res, next) {
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
    logIn,
    mostrarVistaUsuarios,
    mostrarUsuarios,
    obtenerUsuarioPorId,
    agregarUsuario,
    editarUsuario,
    eliminarUsuario
}