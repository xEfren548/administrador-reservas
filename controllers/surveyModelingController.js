const Encuesta = require('../models/Encuesta');
const BadRequestError = require("../common/error/bad-request-error");
const NotFoundError = require("../common/error/not-found-error");
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

const updateFormValidators = [
    check('questionsInfo')
        .custom(async (value, {req}) => {
            var survey = await Encuesta.findOne();
            survey = survey.questions;
            if(!survey){ throw new NotFoundError("No previously existing survey to update") }
            
            var questionIdsSet = new Set();
            var questionNamesSet = new Set();

            value.forEach(questionInfo => {
                // Validating question type.
                if(!["textField", "range", "boolean"].includes(questionInfo.questionType)){
                    throw new BadRequestError('Missing question type');
                }
                
                // Validating question name.
                if (questionNamesSet.has(questionInfo.questionName)) {
                    throw new BadRequestError(`Question \"${questionInfo.questionName}\" has been already declared`);
                } else if(!questionInfo.questionName){
                    throw new BadRequestError('Missing question name');
                }
                else {                    
                    questionNamesSet.add(questionInfo.questionName);
                }

                /*
                // Validating duplicate IDs.
                if (questionIdsSet.has(questionInfo.questionId)) {
                    throw new BadRequestError(`Question \"${questionInfo.questionName}\" ID duplicated`);
                } else {
                    questionIdsSet.add(questionInfo.questionId);
                } 
                
                // Validating correct IDs.
                if(questionInfo.questionId != null){
                    if(!survey.some(question => question._id === questionInfo.questionId)){
                        // It's been deleted. 
                        throw new BadRequestError(`Missing question. Question "${questionInfo.questionName} does not exist"`);
                    }
                }
                else{ //New question }
                // How to process form edition when showing user's results?
                */
            });
            return true;
        })
];

async function showFormModellingView(req, res, next) {
    try {
        var survey = await Encuesta.findOne().lean();
        
        if(!survey){ res.render('vistaModelarEncuesta'); }
        else{ 
            survey = survey.questions;
            res.render('vistaModelarEncuesta', {survey}); 
        }
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

async function updateForm(req, res, next) {
    const { questionsInfo } = req.body;
    try {
        var survey = await Encuesta.findOne();
        survey.questions = questionsInfo;
        
        await survey.save();

        res.status(200).json({ success: true, message: "Encuesta modificada con éxito" });
    } catch (err) {
        console.log(err);
        return next(err);
    }
}

module.exports = {
    createFormValidators,
    updateFormValidators,
    showFormModellingView,
    createFornm,
    updateForm
}
