const  mongoose = require('mongoose');
const Schema = mongoose.Schema;
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
    phone: {
        type: String,
        unique: true,
        required: true,
        validate: {
            validator: function(v) {
                const regex = /^\d{10}$/;
                return regex.test(v);
            },
            message: props => `${props.value} no es un número de teléfono válido de México.`
        }
    },
    password: {
        type: String,
        required: true
    },
    privilege: {
        type: String,
        enum: ['Administrador', 'Vendedor', 'Limpieza', 'Servicios adicionales', 'Dueño de cabañas', 'Inversionistas', 'Cliente', 'Colaborador dueño'],
        required: true
    },
    administrator: {
        type: String,
    },
    adminname: {
        type: String,
    },
    investorType: {
        type: String,
        enum: ['Asimilado', 'RESICO Fisico', 'PF con AE y PM']    
    },
    reservation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Documento.events'
    },
    color: {
        type: String,
        unique: true,
        sparse: true

    }
});

userSchema.pre("save", async function(done){
    if(this.isModified("password") || this.isNew){
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(this.password, saltRounds);
        this.set("password", hashedPassword);
    }
    done();
});

module.exports = mongoose.model('Usuario', userSchema);