const jwt = require("jsonwebtoken");

const currentUser = (req, res, next) => {
    try{
        // Extracting content in request's authorization header to make sure there is an associated token.
        const token = req.get("Authorization").split(' ')[1];
        if(!token){
            throw new Error();
        }

        // Extracting payload by assuring that the user's token is valid.
        const payload = jwt.verify(token, "secret_key");
        if(!payload){
            throw new Error();
        }

        req.currentUser = payload;
        return next();

    } catch(err){
        const error = new Error("Not authorized");
        error.status = 401;
        return next(error);
    }
}

module.exports = currentUser;