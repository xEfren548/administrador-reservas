const BadRequestError = require('../common/error/bad-request-error');
const NotFoundError = require('../common/error/not-found-error');
const {check} = require("express-validator");
const Reservation = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const Cliente = require('../models/Cliente');
const moment = require('moment');

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
            console.log(reservation);

            const client = await Cliente.findById(reservation.client.toString());
            if(!client){
                throw new NotFoundError('Client does not exist');
            }

            const chalets = await Habitacion.findOne();
            const chalet = chalets.resources.find(chalet => chalet._id.toString() === reservation.resourceId.toString());
            if(!chalet){
                throw new NotFoundError('Chalet does not exist 1');
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
        const reservations = await Reservation.findOne().lean();
        const reservation = reservations.events.find(reservation => reservation._id.toString() === uuid.toString());
        if(!reservation){
            throw new NotFoundError('Reservation does not exist');
        }

        
        const client = await Cliente.findById(reservation.client.toString()).lean();
        if(!client){
            throw new NotFoundError('Client does not exist');
        }
        
        const chalets = await Habitacion.findOne().lean();
        const chalet = chalets.resources.find(chalet => chalet._id.toString() === reservation.resourceId.toString());
        if(!chalet){
            throw new NotFoundError('Chalet does not exist');
        }
        
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
        // const arrivalDate = new Date(reservation.arrivalDate);
        // const departureDate = new Date(reservation.departureDate);

        // reservation.arrivalDate = arrivalDate.toISOString();
        // reservation.departureDate = departureDate.toISOString();

        console.log("reservation arrival date: ", reservation.arrivalDate);
        console.log("reservation departure date: ", reservation.departureDate);

        console.log("reservation arrival date solo fecha: ", reservation.arrivalDate.toLocaleString("es-MX", {timezone: "America/Mexico_City"}));
        console.log("reservation departure date solo fecha: ", reservation.departureDate.toLocaleString("es-MX", {timezone: "America/Mexico_City"}));


        // const arrivalDate = moment(reservation.arrivalDate).tz("America/Mexico_City").format("DD-MM-YYYY");
        // const departureDate = moment.utc(reservation.departureDate).startOf('day').tz("America/Mexico_City").format("DD-MM-YYYY");

        // const arrivalTime = moment(chalet.others.arrivalTime).tz("America/Mexico_City").format("HH:mm");
        // const departureTime = moment(chalet.others.departureTime).tz("America/Mexico_City").format("HH:mm");

        // reservation.arrivalDate = `${arrivalDate} a las ${arrivalTime} `
        // reservation.departureDate = `${departureDate} a las ${departureTime} `;

        const dateArrivalDate = new Date(reservation.arrivalDate);
        const dateDepartureDate = new Date(reservation.departureDate);
        const dateReceivedDate = new Date(reservation.reservationDate);

        const formattedArrivalDate = formatDateMX(dateArrivalDate);
        const formattedDepartureDate = formatDateMX(dateDepartureDate);
        const formattedReceivedDate = formatDateMX(dateReceivedDate);

        console.log("Arrival Date:", formattedArrivalDate); // "08-11-2024"
        console.log("Departure Date:", formattedDepartureDate); // "10-11-2024"


        const arrivalTime = moment(chalet.others.arrivalTime).tz("America/Mexico_City").format("HH:mm");
        const departureTime = moment(chalet.others.departureTime).tz("America/Mexico_City").format("HH:mm");

        reservation.arrivalDate = `${formattedArrivalDate} a las ${arrivalTime}`
        reservation.departureDate = `${formattedDepartureDate} a las ${departureTime}`;

        reservation.reservationDate = formattedReceivedDate;

        console.log("Fechassss: ")

        
        console.log(reservation)
        
        res.render('paraUsuarios', {
            layout: 'layoutParaUsuarios',
            fullname: client.firstName + ' ' + client.lastName,
            reservation: reservation,
            chalet: chalet
        });
    } catch(err) {
        return next(err);
    }
}

function formatDateMX(date) {
    const day = date.getUTCDate();
    const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const month = monthNames[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    
    return `${day} de ${month} de ${year}`;
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