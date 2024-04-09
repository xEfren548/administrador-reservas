module.exports = class CustomError extends Error{
    constructor(customMessage){
        super(customMessage);
        if(new.target === CustomError){
            throw new TypeError("CustomError no es instanciable");
        }
    }
    
    generateErrors(){
        throw new Error("Not a callable method");
    }
}