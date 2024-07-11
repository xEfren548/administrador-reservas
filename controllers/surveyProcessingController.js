const RespuestasUsuario = require('../models/RespuestasUsuario');
const BadRequestError = require("../common/error/bad-request-error");
const NotFoundError = require("../common/error/not-found-error");
const { check } = require("express-validator");
const Evento = require('../models/Evento');
const Cliente = require('../models/Cliente');
const Encuesta = require('../models/Encuesta');

const showSurveyValidators = [
    check('questionsInfo')
        .custom(async (value, {req}) => {
            var survey = await Encuesta.findOne();
            survey = survey.questions;

            if(!survey){ throw new NotFoundError("No previously existing survey to process") }
            return true;
        })
];

const answerSurveyValidators = [
    check("clientEmail")
        .custom(async (value, { req }) => {
            var client = await Cliente.findOne({ email: value });
            if (!client) {
                console.log('El cliente no existe');
                throw new NotFoundError("Current client does not exist. Calling FBI");
            }

            var evento = await Evento.findOne();
            if (!evento || !evento.events || evento.events.length === 0) {
                throw new NotFoundError("No reservations found for this event.");
            }

            var reservations = evento.events.filter(reservation => reservation.client.toString() === client._id.toString());
            if (reservations.length === 0) {
                throw new NotFoundError("Current client has no reservation. Calling FBI");
            }

            // var latestReservation = reservations[reservations.length - 1];
            // if (latestReservation.surveySubmited) {
            //     throw new NotFoundError("You have already submitted this survey");
            // }

            return true;
        }),

        
    check('questionsInfo')
        .custom(async (value, {req}) => {
            var survey = await Encuesta.findOne();
            survey = survey.questions;

            if(!survey){ throw new NotFoundError("No previously existing survey to process") }
            return true;
        })
];

const showClientResponsesValidator = [
    check()
        .custom(async (value, {req}) => {
            const { id } = req.params;

            const clientSurveyResponses = await RespuestasUsuario.findById(id);
            if(!clientSurveyResponses){ throw new NotFoundError("Survey does not exist") }

            return true;
        }),
];

const showClientsResponsesValidator = [

];

async function showSurvey(req, res, next) {
    try {
        var survey = await Encuesta.findOne().lean();
        
        if(!survey){ throw new NotFoundError("No previously existing survey to process") }
        else{ 
            survey = survey.questions;
            res.render('vistaProcesarEncuesta', {
                layout: "layoutProcesarEncuesta", 
                survey
            }); 
        }
    } catch (err) {
        return next(err);
    }
}

async function answerSurvey(req, res, next) {
    const { clientEmail, answersInfo } = req.body;
    console.log(answersInfo); 

    try {
        var client = await Cliente.findOne({ email: clientEmail });
        if(!client){ throw new NotFoundError("Current client does not exist. Calling FBI") }
        console.log("Cliente 2: ", client);

        const reservations = await Evento.findOne();
        const reservation = reservations.events.find(reservation => reservation.client.toString() === client._id.toString());
        if(!reservation){ throw new NotFoundError("Current client has no reservation. Calling FBI") }

        console.log("Cliente asociado: ", client);
        console.log("Reservación asociada: ", reservation);

        const clientAnswers = await RespuestasUsuario.findOneAndUpdate(
            { reservation: reservation._id }, 
            {
                reservation: reservation._id,
                answers: answersInfo
            }, 
            { 
                upsert: true, 
                new: true, 
                setDefaultsOnInsert: true 
            }
        );
        if (!clientAnswers) {
            throw new NotFoundError("User survey answers not found");
        }

        reservation.surveySubmited = true;
        await reservations.save();

        res.status(200).json({ success: true, message: "Encuesta enviada con éxito" });
    } catch (err) {
        return next(err);
    }
}

async function showClientResponses(req, res, next){
    const { id } = req.params;

    try{
        const clientSurveyResponses = await RespuestasUsuario.findById(id).lean();
        if(!clientSurveyResponses){ throw new NotFoundError("Survey does not exist") }

        var reservation = await Evento.findOne();
        reservation = reservation.events.find(reservation => reservation._id.toString() === clientSurveyResponses.reservation.toString());
        if(!reservation){ throw new NotFoundError("Reservation has no client associated to it") }

        const client = await Cliente.findById(reservation.client);
        if(!client){ throw new NotFoundError("Client does not exist") }
        console.log(clientSurveyResponses.answers)
        res.render('vistaRespuestasCliente', {
            email: client.email,
            surveyResponses: clientSurveyResponses.answers,
            layout: "layoutRespuestasCliente"
        });
    } catch(error){
        return next(error);
    }
}

async function showClientsResponses(req, res, next) {
    try {
        var clientsSurveyInfo = [];

        const clientsSurveyResponses = await RespuestasUsuario.find();
        if (!clientsSurveyResponses) { throw new NotFoundError("Survey does not exist"); }
        console.log("clientsSurveyResponses:", clientsSurveyResponses);

        var reservations = await Evento.findOne();
        reservations = reservations.events;

        console.log(reservations)

        for (const clientSurveyResponses of clientsSurveyResponses) {
            const reservation = reservations.find(reservation => reservation._id.toString() === clientSurveyResponses.reservation.toString());

            console.log(reservation)

            const client = await Cliente.findById(reservation.client);
            if (!client) { throw new NotFoundError("Client does not exist."); }

            const clientSurveyInfo = {
                fullName: `${client.firstName} ${client.lastName}`,
                email: client.email,
                surveyResponses: `./mostrar-respuestas-usuario/${clientSurveyResponses._id}`
            };
            console.log("clientSurveyInfo: ", clientSurveyInfo);

            clientsSurveyInfo.push(clientSurveyInfo);
        }

        console.log("clientsSurveyInfo: ", clientsSurveyInfo);
        res.render('vistaRespuestasClientes', { clientsSurveyInfo });
    } catch (error) {
        return next(error);
    }
}


module.exports = {
    showSurveyValidators,
    answerSurveyValidators,
    showClientResponsesValidator,
    showClientsResponsesValidator,
    showSurvey,
    answerSurvey,
    showClientResponses,
    showClientsResponses
}
