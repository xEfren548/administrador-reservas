const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
    questionName: {
        type: String,
        required: true,
        unique: true
    },
    questionType: {
        type: String,
        enum: ["textField", "range", "boolean"],
        required: true
    }
});

const surveySchema = new mongoose.Schema({
    questions: [questionSchema],
});

module.exports = mongoose.model('encuesta', surveySchema);
