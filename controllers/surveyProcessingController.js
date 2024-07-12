const RespuestasUsuario = require('../models/RespuestasUsuario');
const BadRequestError = require("../common/error/bad-request-error");
const NotFoundError = require("../common/error/not-found-error");
const { check } = require("express-validator");
const Evento = require('../models/Evento');
const Cliente = require('../models/Cliente');
const Encuesta = require('../models/Encuesta');
const habitacionController = require('../controllers/habitacionController')

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

        const clientsSurveyResponses = await RespuestasUsuario.find().lean();
        if (!clientsSurveyResponses) { throw new NotFoundError("Survey does not exist"); }
        console.log("clientsSurveyResponses:", clientsSurveyResponses);

        var reservations = await Evento.findOne().lean();
        reservations = reservations.events;
        
        const totalP1 = Array(5).fill(0); // Inicializa un array con 5 elementos, todos con valor 0
        const totalP2 = Array(5).fill(0); // Inicializa un array con 5 elementos, todos con valor 0
        const totalP3 = Array(5).fill(0); // Inicializa un array con 5 elementos, todos con valor 0
        const totalP4 = Array(5).fill(0); // Inicializa un array con 5 elementos, todos con valor 0
        const totalP5 = Array(5).fill(0); // Inicializa un array con 5 elementos, todos con valor 0
        const totalP6 = Array(5).fill(0); // Inicializa un array con 5 elementos, todos con valor 0
        const totalP7 = Array(5).fill(0); // Inicializa un array con 5 elementos, todos con valor 0
        const totalP8 = Array(5).fill(0); // Inicializa un array con 5 elementos, todos con valor 0
        const totalP9 = Array(2).fill(0); // Inicializa un array con 2 elementos, todos con valor 0
        const totalP10 = Array(5).fill(0); // Inicializa un array con 5 elementos, todos con valor 0


        for (const clientSurveyResponses of clientsSurveyResponses) {
            const reservation = reservations.find(reservation => reservation._id.toString() === clientSurveyResponses.reservation.toString());

            console.log(reservation)
            const habitacion = await habitacionController.obtenerHabitacionPorId(reservation.resourceId.toString());

            const nombreHabitacion = habitacion.propertyDetails.name;

            const client = await Cliente.findById(reservation.client);
            if (!client) { throw new NotFoundError("Client does not exist."); }

            const clientSurveyInfo = {
                id: clientSurveyResponses._id,
                fullName: `${client.firstName} ${client.lastName}`,
                email: client.email,
                surveyResponses: `./mostrar-respuestas-usuario/${clientSurveyResponses._id}`,
                answers: clientSurveyResponses.answers,
                nombreHabitacion: nombreHabitacion
            };

            const newAnswers = convertToNumbers(clientSurveyResponses.answers);
            console.log("newAnswers: ", newAnswers);

            
            switch(newAnswers[0]){
                case 1: 
                    totalP1[0] += 1;
                    break;
                case 2:
                    totalP1[1] += 1;
                    break;
                case 3:
                    totalP1[2] += 1;
                    break;
                case 4:
                    totalP1[3] += 1;
                    break;
                case 5:
                    totalP1[4] += 1;
                    break;
            }

            switch(newAnswers[1]){
                case 1: 
                    totalP2[0] += 1;
                    break;
                case 2:
                    totalP2[1] += 1;
                    break;
                case 3:
                    totalP2[2] += 1;
                    break;
                case 4:
                    totalP2[3] += 1;
                    break;
                case 5:
                    totalP2[4] += 1;
                    break;
            }

            switch(newAnswers[2]){
                case 1: 
                    totalP3[0] += 1;
                    break;
                case 2:
                    totalP3[1] += 1;
                    break;
                case 3:
                    totalP3[2] += 1;
                    break;
                case 4:
                    totalP3[3] += 1;
                    break;
                case 5:
                    totalP3[4] += 1;
                    break;
            }

            switch(newAnswers[3]){
                case 1: 
                    totalP4[0] += 1;
                    break;
                case 2:
                    totalP4[1] += 1;
                    break;
                case 3:
                    totalP4[2] += 1;
                    break;
                case 4:
                    totalP4[3] += 1;
                    break;
                case 5:
                    totalP4[4] += 1;
                    break;
            }

            switch(newAnswers[4]){
                case 1: 
                    totalP5[0] += 1;
                    break;
                case 2:
                    totalP5[1] += 1;
                    break;
                case 3:
                    totalP5[2] += 1;
                    break;
                case 4:
                    totalP5[3] += 1;
                    break;
                case 5:
                    totalP5[4] += 1;
                    break;
            }

            switch(newAnswers[5]){
                case 1: 
                    totalP6[0] += 1;
                    break;
                case 2:
                    totalP6[1] += 1;
                    break;
                case 3:
                    totalP6[2] += 1;
                    break;
                case 4:
                    totalP6[3] += 1;
                    break;
                case 5:
                    totalP6[4] += 1;
                    break;
            }

            switch(newAnswers[6]){
                case 1: 
                    totalP7[0] += 1;
                    break;
                case 2:
                    totalP7[1] += 1;
                    break;
                case 3:
                    totalP7[2] += 1;
                    break;
                case 4:
                    totalP7[3] += 1;
                    break;
                case 5:
                    totalP7[4] += 1;
                    break;
            }

            switch(newAnswers[7]){
                case 1: 
                    totalP8[0] += 1;
                    break;
                case 2:
                    totalP8[1] += 1;
                    break;
                case 3:
                    totalP8[2] += 1;
                    break;
                case 4:
                    totalP8[3] += 1;
                    break;
                case 5:
                    totalP8[4] += 1;
                    break;
            }

            switch(newAnswers[8]){
                case "true": 
                    totalP9[0] += 1;
                    break;
                case "false":
                    totalP9[1] += 1;
                    break;
            }

            switch(newAnswers[9]){
                case 1: 
                    totalP10[0] += 1;
                    break;
                case 2:
                    totalP10[1] += 1;
                    break;
                case 3:
                    totalP10[2] += 1;
                    break;
                case 4:
                    totalP10[3] += 1;
                    break;
                case 5:
                    totalP10[4] += 1;
                    break;
            }
            console.log("totalP1: ")
            console.log(totalP7)    
            console.log(totalP8)    
            console.log(totalP9)    
            console.log(totalP10)    

            clientsSurveyInfo.push(clientSurveyInfo);
        }

        console.log("clientsSurveyInfo: ", clientsSurveyInfo);
        console.log(totalP8)
        res.render('vistaRespuestasClientes', {
            clientsSurveyInfo,
            totalP1: totalP1,
            totalP2: totalP2,
            totalP3: totalP3,
            totalP4: totalP4,
            totalP5: totalP5,
            totalP6: totalP6,
            totalP7: totalP7,
            totalP8: totalP8,
            totalP9: totalP9,
            totalP10: totalP10
        });
    } catch (error) {
        return next(error);
    }
}

function convertToNumbers(answers) {
    return answers.map(value => {
      let num = parseFloat(value);
      return isNaN(num) ? value : num;
    });
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
