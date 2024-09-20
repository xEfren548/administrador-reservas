const Cliente = require("../../models/Cliente");
const Evento = require("../../models/Evento");
const Habitacion = require("../../models/Habitacion");
const Pago = require("../../models/Pago");
const pagoController = require('../../controllers/pagoController');
const utilidadesController = require('../../controllers/utilidadesController');

const moment = require('moment-timezone');
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

function sendTemplateMsg(clientInfo, template, params, buttons = []) {
    console.log("sendTemplateMsg");

    const botId = '368142649713367';
    const bearerToken = 'EAAl6R5G8zIABOZBjMPqhvYf8andptAZCrNjl5XdpwD3YjQ5Jmv5gGbnXhAtHFuYmcRpdYcYxafsUDBYXH4d015SW9MEuuYnmuHDRQOUPZAupyrHfMcXX9QCaQkQHFcfhBR1vmvwwTeeTiQwJWVe5JNrGew87ZBqXMW2u2BbZASX7YegCMeXC4arvKujTBqM4A';
    const formatedParams = createParamsArray(params);
    console.log(formatedParams);

    let components = [
        {
            type: "body",
            parameters: formatedParams
        }
    ]

    if (buttons.length > 0) {
        components.push({
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{
                type: "text",
                text: buttons[0].text
            }],
        });
    }
    

    const url = 'https://graph.facebook.com/v15.0/' + botId + '/messages';

    console.log("COMPONTENS: ******")
    console.log(components);

    
    const data = {
        messaging_product: 'whatsapp',
        to: clientInfo.phone,
        type: 'template',
        template: {
            name: template,
            language: { code: 'es_MX' },
            components: components
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
    const formatArrivalDate = moment(reservationInfo.arrivalDate).tz("America/Mexico_City").format("DD-MM-YYYY HH:mm");
    const formatDepartureDate = moment(reservationInfo.departureDate).tz("America/Mexico_City").format("DD-MM-YYYY HH:mm");
    console.log("sendReservationConfirmation");

    sendTemplateMsg(clientInfo, "confirmacion_de_reserva", [
        chaletInfo.propertyDetails.name,
        formatArrivalDate,
        formatDepartureDate
    ])
}

function sendInstructions(clientInfo, chaletInfo, idReserva){
    const url = `https://nynhoteles.com.mx/instrucciones/${idReserva}`
    console.log(`Sending instructions`);
    sendTemplateMsg(
        clientInfo, 
        "purchase_receipt_1",
        [clientInfo.firstName, chaletInfo.propertyDetails.name, idReserva],
        [
            {
                text: idReserva

            }
        ]
    );
    
}
function sendSurveyToClient(clientInfo, chaletInfo, idReserva){
    
    console.log(`Sending instructions`);

    sendTemplateMsg(
        clientInfo, 
        "encuesta_de_satisfaccion",
        [chaletInfo.propertyDetails.name, idReserva],
        [
            {
                text: idReserva

            }
        ]
    );
    
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
    // Fetch reservations and their events
    const eventDocument = await Evento.findOne();
    if (!eventDocument) {
        console.log("No reservations found.");
        return;
    }
    
    let reservations = eventDocument.events;
    if (!reservations || reservations.length === 0) {
        console.log("No events in reservations.");
        return;
    }

    // Fetch all chalets once
    const allChalets = await Habitacion.findOne();
    if (!allChalets || !allChalets.resources) {
        console.log("No chalets found.");
        return;
    }

    // Process each reservation
    for (const reservation of reservations) {
        try {
            const client = await Cliente.findById(reservation.client);
            if (!client) {
                console.log(`Client ${reservation.client} does not exist.`);
                continue;
            }

            const chalet = allChalets.resources.find(chalet => chalet._id.toString() === reservation.resourceId.toString());
            if (!chalet) {
                console.log(`Chalet ${reservation.resourceId} does not exist.`);
                continue;
            }

            // Filter by specific client ID
            if (reservation.client && reservation.client.toString() !== "668c771c3b9c755c82fe5603") {
                continue;
            }

            console.log("Current date:", new Date());
            console.log("Reservation date:", reservation.arrivalDate);

            // Check if thanks need to be sent
            if (new Date() > reservation.departureDate.getTime() && reservation.status !== "cancelled" && (reservation.thanksSent === false || !reservation.thanksSent)) {
                console.log(`Sending thanks for reservation with departure date: ${reservation.departureDate}`);
                
                // Send the thank-you message
                sendTemplateMsg(
                    client, 
                    "encuesta_de_satisfaccion",
                    [chalet.propertyDetails.name, reservation._id.toString()],
                    [
                        { text: reservation._id.toString() }
                    ]
                );

                // Mark thanks as sent
                reservation.thanksSent = true;
            }
        } catch (error) {
            console.log(`Error processing reservation ${reservation._id}:`, error);
        }
    }

    // Save the updated document
    await eventDocument.save();
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
                        const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(reservation._id);


                        const newComisiones = comisionesReserva.map(comisiones => {
                            return {
                                id: comisiones._id,
                                // monto: comisiones.monto / 2,
                                status: 'aplicado'
                            }
                        })

                        for (const comision of newComisiones) {
                            await utilidadesController.editarComisionReturn(comision);
                        }
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
                        const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(reservation._id);


                        const newComisiones = comisionesReserva.map(comisiones => {
                            return {
                                id: comisiones._id,
                                // monto: comisiones.monto / 2,
                                status: 'aplicado'
                            }
                        })

                        for (const comision of newComisiones) {
                            await utilidadesController.editarComisionReturn(comision);
                        }
                    }
                }

            }
        }

        await evento.save();
    }
}



module.exports = {
    sendReservationConfirmation,
    sendInstructions,
    sendSurveyToClient,
    sendReminders,
    sendThanks,
    cancelReservation
};