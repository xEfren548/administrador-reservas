const jwt = require("jsonwebtoken")
const Usuario = require('../models/Usuario');

async function createUser(req, res, next) {
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
        // Generating authentiation token.
        const token = jwt.sign({ email, userId: userToAdd._id }, "secret_key", { expiresIn: "1h" });

        console.log("Usuario agregado con éxito");
        res.status(200).json( {token} );

    } catch(err){
        console.log(err);
        return next(err);
    }   
}

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

        // Generating authentiation token.
        const token = jwt.sign({ email, userId: user._id }, "secret_key", { expiresIn: "1h" });

        console.log("Usuario logeado con éxito");
        res.status(200).json( {token} );

    } catch(err){
        return next(err);
    }
}

module.exports = {
    logIn,
    createUser
}