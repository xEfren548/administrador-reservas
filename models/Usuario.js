const { Schema, model } = require('mongoose');


const userSchema = new Schema({
    uuid: {
        type: String,
        unique: true,
    },
    firstName: String,
    lastName: String,
    email: {
        type: String,
        unique: true,
    },
    password: String,
    privilege: String,
    administrator: String,
});

module.exports = model('usuarios', userSchema);