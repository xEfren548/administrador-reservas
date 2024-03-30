const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Usuario = require('../models/Usuario');

async function login(req, res, next){
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

        const pwdEqual = bcrypt.compare(password, user.password);
        if(!pwdEqual){
            error = new Error("Wrong credentials");
            error.status = 401;    
            return next(error);
        }

        // Generating authentiation token.
        const token = jwt.sign({ email, userId: user._id }, "secret_key", { expiresIn: "1h" });
        
        // Saving user's cookies.
        req.session = { 
            token,
            email: user.email,
            privilege: user.privilege
        };        
        
        console.log("Usuario logeado con éxito");
        // Uncomment the following line in order to test it on the browser.
        // res.redirect('/');
        // Uncomment the following line in order to test it on Postman.
        res.status(200).json( req.session );

    } catch(err){
        return next(err);
    }
}

async function logout(req, res, next){
    req.session = null;
    res.send({ message: "Successfully logged out" });
}

module.exports = {
    login,
    logout
}