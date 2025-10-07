const Cliente = require("../../models/Cliente");
const Evento = require("../../models/Evento");
const Habitacion = require("../../models/Habitacion");
const Pago = require("../../models/Pago");
const RackLimpieza = require("../../models/RackLimpieza");
const pagoController = require('../../controllers/pagoController');
const utilidadesController = require('../../controllers/utilidadesController');
const logController = require('../../controllers/logController');
const channexController = require('../../controllers/channexController');


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

async function sendTemplateMsg(clientInfo, template, params, buttons = []) {
    console.log("sendTemplateMsg");

    const botId = '472231735966563';
    const bearerToken = 'EAALyoAZAkGtcBPWHc8Dazcu5TSujhyAS6xZAXGGrrWH0ZAjzL1UBBIJDsh8ZBZCyC642qdviyTbfQBiKz2FxbtnOpZBnZC4oo6vNoRmqZARZCBe5ZCRpHcCDVc0i9b4UTV1OZBD3gRNeRRJD37T8Q3ybgKEiwLTkhZBMuDh1zt8IoQKrG2OfJPD9tpb8ZA5nJffcocpjkJgZDZD';
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


    const url = 'https://graph.facebook.com/v20.0/' + botId + '/messages';

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

    try {
        const response = await fetch(url, postReq);
        const result = await response.json();
        
        if (!response.ok) {
            // NO lanzar error, retornar objeto indicando fallo
            return {
                success: false,
                error: result.error?.message || 'Unknown error',
                errorCode: result.error?.code,
                data: result
            };
        }
        
        console.log('WhatsApp Response:', result);
        
        // Retornar objeto indicando éxito
        return {
            success: true,
            data: result,
            messageId: result.messages?.[0]?.id
        };
        
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        
        // Retornar objeto indicando fallo por error de red/conexión
        return {
            success: false,
            error: error.message,
            errorType: 'network'
        };
    }
}

async function sendReservationConfirmation(clientInfo, chaletInfo, reservationInfo) {
    // const formatArrivalDate = moment(reservationInfo.arrivalDate).tz("America/Mexico_City").format("DD-MM-YYYY HH:mm");
    // const formatDepartureDate = moment(reservationInfo.departureDate).tz("America/Mexico_City").format("DD-MM-YYYY HH:mm");
    console.log("sendReservationConfirmation");

    const chaletArrivalHour = moment.tz(chaletInfo.others.arrivalTime, "America/Mexico_City").format("HH:mm");
    const chaletDepartureHour = moment.tz(chaletInfo.others.departureTime, "America/Mexico_City").format("HH:mm");


    console.log("chaletArrivalHour", chaletArrivalHour)
    console.log("chaletDepartureHour", chaletDepartureHour)

    const formattedArrivalDate = moment(reservationInfo.arrivalDate).format("DD/MM/YYYY");
    const formattedDepartureDate = moment(reservationInfo.departureDate).format("DD/MM/YYYY");

    const arrMsg = `${formattedArrivalDate} a las ${chaletArrivalHour}`
    const depMsg = `${formattedDepartureDate} a las ${chaletDepartureHour}`

    await sendTemplateMsg(clientInfo, "confirmacion_de_reserva", [
        chaletInfo.propertyDetails.name,
        arrMsg,
        depMsg
    ])
}

async function sendInstructions(clientInfo, chaletInfo, idReserva) {
    const url = `https://nynhoteles.com.mx/instrucciones/${idReserva}`
    console.log(`Sending instructions`);
    await sendTemplateMsg(
        clientInfo,
        "instrucciones_de_cliente",
        [clientInfo.firstName, chaletInfo.propertyDetails.name, idReserva],
        [
            {
                text: idReserva

            }
        ]
    );

}
async function sendSurveyToClient(clientInfo, chaletInfo, idReserva) {

    console.log(`Sending instructions`);

    await sendTemplateMsg(
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
    var reservations = await Evento.find();
    reservations = reservations || [];

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
                await sendTemplateMsg(client, "purchase_receipt_1", [client.firstName, chalet.propertyDetails.name]);
            }
        };
    }
}

async function sendThanks() {
    // Fetch reservations and their events
    let reservations = await Evento.find({ status: { $nin: ["cancelled", "no-show"] } });
    // if (!eventDocument) {
    //     console.log("No reservations found.");
    //     return;
    // }

    // let reservations = eventDocument.events;
    if (!reservations || reservations.length === 0) {
        console.log("No events in reservations.");
        return;
    }

    // Fetch all chalets once
    // const allChalets = await Habitacion.find();
    // if (!allChalets) {
    //     console.log("No chalets found.");
    //     return;
    // }

    // Process each reservation
    for (const reservation of reservations) {
        try {
            const client = await Cliente.findById(reservation.client);
            if (!client) {
                console.log(`Client ${reservation.client} does not exist.`);
                continue;
            }

            // const chalet = allChalets.resources.find(chalet => chalet._id.toString() === reservation.resourceId.toString());
            const chalet = await Habitacion.findById(reservation.resourceId.toString()).lean();
            if (!chalet) {
                continue;
            }

            // if (reservation.status === "cancelled"){
            //     continue;
            // }

            //console.log("Current date:", new Date());
            //console.log("Reservation date:", typeof reservation.departureDate);

            const departureDate = new Date(reservation.departureDate);


            // Check if thanks need to be sent
            if (new Date() > departureDate && reservation.status !== "cancelled" && !reservation.thanksSent) {
                console.log(`Sending thanks for reservation with departure date: ${reservation.departureDate}`);

                // Send the thank-you message
                await sendTemplateMsg(
                    client,
                    "encuesta_de_satisfaccion",
                    [chalet.propertyDetails.name, reservation._id.toString()],
                    [
                        { text: reservation._id.toString() }
                    ]
                );

                // Mark thanks as sent
                reservation.thanksSent = true;
                await reservation.save();
            }
        } catch (error) {
            console.log(`Error processing reservation ${reservation._id}:`, error);
        }
    }

}

async function sendCheckInMessage() {
    console.log("Enviando mensajes de check in");

    moment.locale('es');

    const today = moment().startOf('day').toDate();
    const tomorrow = moment().add(1, 'day').startOf('day').toDate();
    const todayFormattedDate = moment().format("DD [de] MMMM");

    const reservas = await Evento.find({ status: { $nin: ["cancelled", "no-show"] }, arrivalDate: { $gte: today, $lt: tomorrow }, checkInSent: false });
    console.log(`Found ${reservas.length} reservations for tomorrow.`);

    for (const reserva of reservas) {
        const client = await Cliente.findById(reserva.client);
        if (!client) {
            console.log(`Client ${reserva.client} does not exist.`);
            continue;
        }

        const chalet = await Habitacion.findOne({ _id: reserva.resourceId }).select('propertyDetails');
        console.log("Chalet details:", chalet);
        if (!chalet || chalet.propertyDetails.accomodationType.toUpperCase() !== "BOSQUE IMPERIAL") {
            console.log(`Chalet ${reserva.resourceId} does not exist.`);
            continue;
        }

        const receiver = {
            phone: '523317583008'
        }

        const formattedCheckOut = moment(reserva.departureDate).format("DD [de] MMMM");

        const whatsappResponse = await sendTemplateMsg(receiver, 'automatizacion_checkin', [
            todayFormattedDate,
            `${client.firstName} ${client.lastName}`,
            chalet.propertyDetails.name,
            reserva.pax.toString(),
            todayFormattedDate,
            formattedCheckOut

        ]);

        console.log("whatsappResponse: ", whatsappResponse);

        if (whatsappResponse.success) {
            // reserva.checkInSent = true;
            // await reserva.save();
            console.log(`Mensaje enviado a ${client.firstName}. (${receiver.phone}) para la reserva ${reserva._id}`);
        } else {
            console.log(`Error al enviar mensaje a ${client.firstName}. (${receiver.phone}) para la reserva ${reserva._id}`);
        }
        


    }
    // sendTemplateMsg(clientInfo, template, params, buttons = [])
}


async function cancelReservation() {
    console.log("--------------------------------------------------------------------------------");
    console.log("SENDING CANCELATION");
    var evento = await Evento.find();
    var reservations = evento;

    if (reservations) {
        for (const reservation of reservations) {
            if (reservation.status === "pending") {
                const client = await Cliente.findById(reservation.client);
                if (!client) {
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

                            const rackLimpieza = await RackLimpieza.findOne({ id_reserva: reservation._id });
                            if (rackLimpieza) {
                                await RackLimpieza.findByIdAndDelete(rackLimpieza._id);
                                console.log("Rack de limpieza eliminado con éxito");

                            }
                            const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(reservation._id);

                            for (const comisiones of comisionesReserva) {
                                const utilidadEliminada = await utilidadesController.eliminarComisionReturn(comisiones._id);
                                if (utilidadEliminada) {
                                    console.log('Utilidad eliminada correctamente');
                                } else {
                                    throw new Error('Error al eliminar comision.');
                                }
                            }

                            const logBody = {
                                fecha: Date.now(),
                                type: 'reservation',
                                acciones: `Reserva cancelada por falta de pago`,
                                idReserva: reservation._id
                            }

                            await logController.createBackendLog(logBody);
                            
                            const chalet = await Habitacion.findById(reservation.resourceId);

                            if (chalet.channels?.length > 0) {
                                channexController.updateChannexAvailability(chalet._id)
                                    .then(() => {
                                        console.log("Disponibilidad actualizada en Channex.");
                                    })
                                    .catch(err => {
                                        console.error("Error al actualizar disponibilidad en Channex: ", err.message);
                                    });
                            }
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
            await reservation.save();
        }

    }
}



module.exports = {
    sendReservationConfirmation,
    sendInstructions,
    sendSurveyToClient,
    sendReminders,
    sendThanks,
    cancelReservation,
    sendCheckInMessage
};