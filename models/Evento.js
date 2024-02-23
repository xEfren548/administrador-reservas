const { Schema, model } = require('mongoose');


const reservaSchema = new Schema({
    id: {
        type: String,
        unique: true,
        },
    resourceId: String,
    title: String,
    start: String,
    end: String,
    url: String,
    total: Number
});

const documentSchema = new Schema({
    events: [reservaSchema]
});

module.exports = model('Documento', documentSchema);
