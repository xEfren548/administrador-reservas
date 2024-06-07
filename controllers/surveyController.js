const Encuesta = require('../models/Encuesta');
const BadRequestError = require("../common/error/bad-request-error");
const { check } = require("express-validator");

const createFormValidators = [
    check('questionsInfo')
        .custom((value, {req}) => {
            value.forEach(questionInfo => {
                if(!questionInfo.questionName){
                    throw new BadRequestError('Missing question name');
                }
                if(!["textField", "range", "boolean"].includes(questionInfo.questionType)){
                    throw new BadRequestError('Missing question type');
                }
            });
            return true;
        })
        .custom((value, {req}) => {
            var questionNamesSet = new Set();

            value.forEach(questionInfo => {
                if (questionNamesSet.has(questionInfo.questionName)) {
                    throw new BadRequestError(`Question \"${questionInfo.questionName}\" has been already declared`);
                } else {
                    questionNamesSet.add(questionInfo.questionName);
                }
            });
            return true;
        })
];

async function showFormView(req, res, next) {
    try {
        var survey = await Encuesta.findOne().lean();
        survey = survey.questions;

        if(!survey){ res.render('vistaCrearEncuesta'); }
        else{ res.render('vistaCrearEncuesta', {survey}); }
        
    } catch (err) {
        return next(err);
    }
}

async function createFornm(req, res, next) {
    const { questionsInfo } = req.body;
    console.log("QUESTIONS: ", questionsInfo);

    try {
        const survey = new Encuesta({
            questions: questionsInfo
        });  
        await survey.save();

        res.status(200).json({ success: true, message: "Encuesta generada con éxito" });
    } catch (err) {
        console.log(err);
        return next(err);
    }
}

module.exports = {
    createFormValidators,
    showFormView,
    createFornm,
}
