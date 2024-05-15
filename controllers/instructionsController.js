const BadRequestError = require('../common/error/bad-request-error');
const NotFoundError = require('../common/error/not-found-error');
const {check} = require("express-validator");
const Reservation = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const Cliente = require('../models/Cliente');

const getViewValidators = [
    check('')
        .custom(async (value, { req }) => {
            console.log(req.session);
            const uuid = req.params.uuid;
            if(!uuid){
                throw new BadRequestError('Reservation id does not exist');
            }

            const reservations = await Reservation.findOne();
            const reservation = reservations.events.find(reservation => reservation._id.toString() === uuid.toString());
            if(!reservation){
                throw new NotFoundError('Reservation does not exist');
            }

            const client = await Cliente.findById(reservation.client.toString());
            if(!client){
                throw new NotFoundError('Client does not exist');
            }

            const chalets = await Habitacion.findOne();
            const chalet = chalets.resources.find(chalet => chalet._id.toString() === reservation.resourceId.toString());
            if(!chalet){
                throw new NotFoundError('Chalet does not exist');
            }

            return true;
        })
];

const areTermsAcceptedValidators = [
    check('')
        .custom(async (value, { req }) => {
            console.log(req.session);
            const uuid = req.params.uuid;
            if(!uuid){
                throw new BadRequestError('Reservation id does not exist');
            }

            const reservations = await Reservation.findOne();
            const reservation = reservations.events.find(reservation => reservation._id.toString() === uuid.toString());
            if(!reservation){
                throw new NotFoundError('Reservation does not exist');
            }

            const client = await Cliente.findById(reservation.client.toString());
            if(!client){
                throw new NotFoundError('Client does not exist');
            }

            const chalets = await Habitacion.findOne();
            const chalet = chalets.resources.find(chalet => chalet._id.toString() === reservation.resourceId.toString());
            if(!chalet){
                throw new NotFoundError('Chalet does not exist');
            }

            return true;
        })
];

const acceptTermsAndConditionsValidators = [
    check("termsAccepted")
        .notEmpty().withMessage('Terms and conditions are required')
        .isBoolean().withMessage('Terms and conditions must be a boolean value')
        .custom(async (value, { req }) => {
            if(!value){
                throw new NotFoundError("Terms and conditions must be accepted");
            }
            return true;
        }),
];

async function showInstructionsView(req, res, next) {   
    const uuid = req.params.uuid;

    try {
        const reservations = await Reservation.findOne();
        const reservation = reservations.events.find(reservation => reservation._id.toString() === uuid.toString());
        if(!reservation){
            throw new NotFoundError('Reservation does not exist');
        }

        const client = await Cliente.findById(reservation.client.toString());
        if(!client){
            throw new NotFoundError('Client does not exist');
        }
        
        const chalets = await Habitacion.findOne();
        const chalet = chalets.resources.find(chalet => chalet._id.toString() === reservation.resourceId.toString());
        if(!chalet){
            throw new NotFoundError('Chalet does not exist');
        }

        res.render('paraUsuarios', {
            layout: 'layoutParaUsuarios',
            fullname: client.firstName + ' ' + client.lastName,
            reservation: reservation.toObject(),
            chalet: chalet.toObject()
        });
    } catch(err) {
        return next(err);
    }
}

async function areTermsAccepted(req, res, next) {
    const uuid = req.params.uuid;

    try {
        console.log("TEEESt 1");
        const reservations = await Reservation.findOne();
        const reservation = reservations.events.find(reservation => reservation._id.toString() === uuid.toString());
        if(!reservation){
            throw new NotFoundError('Reservation does not exist');
        }
        
        console.log("TEEESt 2");
        var termsAccepted = true;
        if(!reservation.termsAccepted){
            termsAccepted = false;
        }

        console.log("TEEESt");

        res.status(200).json({ termsAccepted });
    } catch (error) {
        console.log(error);
        return next(error);
    }
}

async function acceptTermsAndConditions(req, res, next) {
    const uuid = req.params.uuid;
    const { termsAccepted } = req.body;

    try {
        const reservations = await Reservation.findOne();
        const reservation = reservations.events.find(reservation => reservation._id.toString() === uuid.toString());
        if(!reservation){
            throw new NotFoundError('Reservation does not exist');
        }
        
        reservation.termsAccepted = termsAccepted;
        await reservations.save();

        res.status(200).json({ success: true });
    } catch (error) {
        console.log(error);
        return next(error);
    }
}

module.exports = {
    getViewValidators,
    areTermsAcceptedValidators,
    acceptTermsAndConditionsValidators,
    showInstructionsView,
    areTermsAccepted,
    acceptTermsAndConditions
};