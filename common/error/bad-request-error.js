CustomError = require("./custom-error");

module.exports = class BadRequestError extends CustomError{
    constructor(customMessage){
        super(customMessage);
        this.statusCode = 404;
        this.customMessage = customMessage;
    }

    generateErrors(){
        if(this.customMessage){
            return [{message: this.customMessage}];
        }
        return [{message: "Bad request"}]
    }
}