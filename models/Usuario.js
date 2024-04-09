const { Schema, model } = require('mongoose');
const bcrypt = require("bcrypt");

const userSchema = new Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true
    },
    privilege: {
        type: String,
        enum: ['test', 'Administrador', 'Vendedor', 'Limpieza'],
        required: true
    },
    administrator: {
        type: String,
        required: true
    },
});

userSchema.pre("save", async function(done){
    if(this.isModified("password") || this.isNew){
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(this.password, saltRounds);
        this.set("password", hashedPassword);
    }

    done();
});

module.exports = model('Usuario', userSchema);