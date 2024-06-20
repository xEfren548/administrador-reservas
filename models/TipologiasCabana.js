const { Schema, model } = require('mongoose');

const tipologiasSchema = new Schema({
    tipologia: {
        unique: true,
        type: String,
        required: true
    }
    
});

const Tipologias = model('tipologias', tipologiasSchema);


module.exports = Tipologias;