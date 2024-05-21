const Cliente = require("../../models/Cliente");
const Evento = require("../../models/Evento");
const Habitacion = require("../../models/Habitacion");

function createParamsArray(params){
    return params.map(param => {
        return {
            "type": "text",
            "text": param
        };
    })
}

function sendTemplateMsg(clientInfo, template, params){
    console.log("sendTemplateMsg");

    const botId = '142727708934806';
    const bearerToken = 'EAAPpZA66k5CYBO6FAJ0f5NFgLZCKgKYKvnxGyJ0ah6VLOWsaajHmo4ToNXWybXLIuNBqmoi24VbLl7pZCHojX3eIAWqARpicNziOLJ92ZBSZCcGVZCYVIbXFFJLPgbi34MZAfYp4tCGVTjkdznAVmvRJwDtzePN196iOd2nXVr6dzpZC6SpSZC8webZBnwhghJTlTnvZC1psZCyssZCDape5qPzoZD';
    const formatedParams = createParamsArray(params);
    console.log(formatedParams);

    const url = 'https://graph.facebook.com/v15.0/' + botId + '/messages';
    const data = {
        messaging_product: 'whatsapp',
        to: clientInfo.phone, 
        type: 'template',
        template: {
            name: template,
            language:{ code: 'es_MX' },
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

function sendReservationConfirmation(clientInfo, chaletInfo, reservationInfo){
    console.log("sendReservationConfirmation");
    
    sendTemplateMsg(clientInfo, "confirmacion_de_reserva", [
        chaletInfo.propertyDetails.name,
        reservationInfo.arrivalDate,
        reservationInfo.departureDate
    ])
}

async function sendReminders(){
    console.log("--------------------------------------------------------------------------------");
    console.log("SENDIND REMINDERS");
    var reservations = await Evento.findOne();
    reservations = reservations.events;

    if(reservations){
        for(const reservation of reservations) {            
            
            const client = await Cliente.findById(reservation.client);
            if (!client) {
                console.log(reservation.client, ': Client does not exist');
                continue;
            }

            const chalet = await Habitacion.findById(reservation.chalet);
            if (!chalet) {
                console.log(reservation.resourceId, ': Chalet does not exist');
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

async function sendThanks(){
    console.log("--------------------------------------------------------------------------------");
    console.log("SENDIND THANKS");
    var reservations = await Evento.findOne();
    reservations = reservations.events;

    if(reservations){
        for(const reservation of reservations) {
            
            const client = await Cliente.findById(reservation.client);
            if (!client) {
                console.log(reservation.client, ': Client does not exist');
                continue;
            }

            const chalet = await Habitacion.findById(reservation.chalet);
            if (!chalet) {
                console.log(reservation.resourceId, ': Chalet does not exist');
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

module.exports = {
    sendReservationConfirmation,
    sendReminders, 
    sendThanks
};