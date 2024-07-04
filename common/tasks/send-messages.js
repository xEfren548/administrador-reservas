const Cliente = require("../../models/Cliente");
const Evento = require("../../models/Evento");
const Habitacion = require("../../models/Habitacion");
const Pago = require("../../models/Pago");
const pagoController = require('../../controllers/pagoController');

const { format } = require('date-fns');
const { es } = require('date-fns/locale');

function createParamsArray(params) {
    return params.map(param => {
        return {
            "type": "text",
            "text": param
        };
    })
}

function sendTemplateMsg(clientInfo, template, params) {
    console.log("sendTemplateMsg");

    const botId = '142727708934806';
    const bearerToken = 'EAAPpZA66k5CYBOyH8qdKujxZBuXuCeKSmeO8M3L1Uqok1Sano9TtgZAQ7AoROw8VxF9pGgOP88W3QCXzZAQfItLQp5jSBpGVPWDkkRGyqG2HN6kIx91jKF0RTT4ZCdsZAtF0KXrLiTIUeSfxlU6DQbtZAJdzfOi8xVeEwBe9RKZA7CjgJyDuNrZC9XkO3ERvSmCWa5UbODw2IQkbCBnIO';
    const formatedParams = createParamsArray(params);
    console.log(formatedParams);

    const url = 'https://graph.facebook.com/v15.0/' + botId + '/messages';
    const data = {
        messaging_product: 'whatsapp',
        to: clientInfo.phone,
        type: 'template',
        template: {
            name: template,
            language: { code: 'es_MX' },
            components: [
                {
                    type: "body",
                    parameters: formatedParams
                }
            ]
        }
    };

    var postReq = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + bearerToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        json: true
    };

    fetch(url, postReq)
        .then(data => {
            return data.json()
        })
        .then(res => {
            console.log(res)
        })
        .catch(error => console.log(error));
}

function sendReservationConfirmation(clientInfo, chaletInfo, reservationInfo) {
    console.log("sendReservationConfirmation");

    sendTemplateMsg(clientInfo, "confirmacion_de_reserva", [
        chaletInfo.propertyDetails.name,
        reservationInfo.arrivalDate,
        reservationInfo.departureDate
    ])
}

async function sendReminders() {
    // console.log("--------------------------------------------------------------------------------");
    // console.log("SENDIND REMINDERS");
    var reservations = await Evento.findOne();
    reservations = reservations.events;

    if (reservations) {
        for (const reservation of reservations) {

            const client = await Cliente.findById(reservation.client);
            if (!client) {
                // console.log(reservation.client, ': Client does not exist');
                continue;
            }

            const chalet = await Habitacion.findById(reservation.chalet);
            if (!chalet) {
                // console.log(reservation.resourceId, ': Chalet does not exist');
                continue;
            }

            console.log("Current date: ", new Date);
            console.log("Reservation date: ", reservation.arrivalDate);
            if (new Date() === new Date(reservation.arrivalDate.getTime() - (12 * 60 * 60 * 1000))) {
                console.log(`Sending reminder for reservation with arrival date: ${reservation.arrivalDate}`);
                sendTemplateMsg(client, "purchase_receipt_1", [client.firstName, chalet.propertyDetails.name]);
            }
        };
    }
}

async function sendThanks() {
    // console.log("--------------------------------------------------------------------------------");
    // console.log("SENDIND THANKS");
    var reservations = await Evento.findOne();
    reservations = reservations.events;

    if (reservations) {
        for (const reservation of reservations) {

            const client = await Cliente.findById(reservation.client);
            if (!client) {
                // console.log(reservation.client, ': Client does not exist');
                continue;
            }

            const chalet = await Habitacion.findById(reservation.chalet);
            if (!chalet) {
                // console.log(reservation.resourceId, ': Chalet does not exist');
                continue;
            }

            console.log("Current date: ", new Date);
            console.log("Reservation date: ", reservation.arrivalDate);
            if (new Date() === reservation.departureDate.getTime()) {
                console.log(`Sending thanks for reservation with departure date: ${reservation.departureDate}`);
                sendTemplateMsg(client, "encuesta_de_satisfaccion", [chalet.propertyDetails.name]);
            }
        };
    }
}

async function cancelReservation() {
    console.log("--------------------------------------------------------------------------------");
    console.log("SENDING CANCELATION");
    var evento = await Evento.findOne();
    var reservations = evento.events;

    if (reservations) {
        for (const reservation of reservations) {
            if (reservation.status === "pending") {
                const client = await Cliente.findById(reservation.client);
                if (!client) {
                    console.log(reservation.client, ': Client does not exist');
                    continue;
                }

                const isDeposit = reservation.isDeposit;

                const pagos = await pagoController.obtenerPagos(reservation._id);
                let pagoTotal = 0
                pagos.forEach(pago => {
                    pagoTotal += pago.importe;
                })
                const totalReserva = reservation.total;
                const montoPendiente = totalReserva - pagoTotal;

                const pagoDel50 = (montoPendiente <= totalReserva / 2) ? true : false;
                console.log(pagoDel50);


                if (isDeposit) {
                    if (pagoDel50) {
                        // const payment = await Pago.findOne({ reservationId: reservation._id });
                        // console.log(reservation.resourceId, ': Reservation has no payment recorded');
                        // console.log("Current date: ", new Date());
                        // console.log("Cancelation date: ", reservation.paymentCancelation);
                        
                        reservation.status = 'active';
                        console.log('reserva movida a activa')
                    }
                    else {
                        if (new Date().getTime() >= reservation.paymentCancelation.getTime()) {
                            console.log(`Canceling reservation as it is: ${reservation.departureDate} and no payment has been recorded`);
                            reservation.status = "cancelled"
                        }
                    }

                } else {
                    if (pagoDel50) {
                        reservation.status = 'active';
                        console.log('reserva movida a activa')
                    }
                }

            }
        }

        await evento.save();
    }
}



module.exports = {
    sendReservationConfirmation,
    sendReminders,
    sendThanks,
    cancelReservation
};