const jwt = require("jsonwebtoken");
const NotAuthorizedError = require("../error/not-authorized-error");

const currentUser = (req, res, next) => {
    try{
        // Extracting content in request's authorization header to make sure there is an associated token.
        const token = req.session.token;
        if(!token){
            console.log("No token");
            throw new NotAuthorizedError();
        }

        // Extracting payload by assuring that the user's token is valid.
        const payload = jwt.verify(token, "secret_key");
        if(!payload){
            console.log("Invalid");
            throw new NotAuthorizedError();
        }

        req.currentUser = payload;
        return next();

    } catch(err){
        //console.log("Smnth else");
        return next(new NotAuthorizedError());
    }
}

module.exports = currentUser;