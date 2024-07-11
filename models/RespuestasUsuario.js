const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
    questionName: {
        type: String,
        required: true,
    },
    answer: {
        type: String,
        required: true
    },
    answerType: {
        type: String,
        enum: ["textField", "range", "boolean"],
        required: true
    }
});

const userSurveyAnswersSchema = new mongoose.Schema({
    reservation:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Evento'
    },
    answers: {
        type: Array,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('respuestaUsuario', userSurveyAnswersSchema);
