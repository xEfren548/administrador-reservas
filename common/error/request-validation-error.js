CustomError = require("./custom-error");

module.exports = class RequestValidationError extends CustomError{
    constructor(errors){
        super("Invalid request");
        this.statusCode = 400;
        this.errors = errors;
    }

    generateErrors(){
        return this.errors.map(error => {
            return {message: error.msg, field: error.param};
        });
    }
}