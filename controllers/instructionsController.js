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

module.exports = {
    getViewValidators,
    showInstructionsView
};