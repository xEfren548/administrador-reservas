const nodemailer = require('nodemailer');
const fs = require('fs');
const moment = require('moment-timezone');
const Evento = require('../../models/Evento');
const Habitacion = require('../../models/Habitacion');
const Cliente = require('../../models/Cliente');


async function sendEmail(email, reservationId) {
    try {

        const allReservations = await Evento.findOne();
        const allChalets = await Habitacion.findOne();
    
        const reservation = allReservations.events.find(reservation => reservation._id.toString() === reservationId.toString());
        const chalet = allChalets.resources.find(chalet => chalet._id.toString() === reservation.resourceId.toString());
        const client = await Cliente.findById(reservation.client.toString());
        const arrivalTime = moment(chalet.others.arrivalTime).tz("America/Mexico_City").format("HH:mm");
        const departureTime = moment(chalet.others.departureTime).tz("America/Mexico_City").format("HH:mm");

        let htmlContent  = fs.readFileSync("views/templates/reservationTemplate.html", 'utf8');
        
        htmlContent = htmlContent.replace("[chaletName]", chalet.propertyDetails.name);
        htmlContent = htmlContent.replace("[arrivalDate]", `${moment.tz(reservation.arrivalDate, "America/Mexico_City").format('DD-MM-YYYY')} ${arrivalTime}`);
        htmlContent = htmlContent.replace("[departureDate]", `${moment.tz(reservation.departureDate, "America/Mexico_City").format('DD-MM-YYYY')} ${departureTime}`);
        htmlContent = htmlContent.replace("[huespedes]", reservation.pax);
        htmlContent = htmlContent.replace("[nNights]", reservation.nNights);
        htmlContent = htmlContent.replace("[precioTotal]", reservation.total);
        htmlContent = htmlContent.replace("[nombreCliente]", client.firstName + " " + client.lastName);
        htmlContent = htmlContent.replace("[reservationId]", reservationId);
    
        // <p style="margin: 10px 0;"><strong>Fecha de llegada:</strong> [arrivalDate]</p>
        // <p style="margin: 10px 0;"><strong>Fecha de salida:</strong> [departureDate]</p>
        // <p style="margin: 10px 0;"><strong>Huéspedes:</strong> [huespedes]</p>
        // <p style="margin: 10px 0;"><strong>Noches:</strong> [nNights[</p>
        // <p style="margin: 10px 0;"><strong>Precio total:</strong> $[precioTotal]</p>
        // <p style="margin: 10px 0;"><strong>Nombre del cliente:</strong> [nombreCliente]</p>
    
        const transporter = nodemailer.createTransport({
            host: 'sandbox.smtp.mailtrap.io',
            port: 25,
            auth: {
                user: '1a5a5292926a0e',
                pass: '21c4f402383c4a'
            }
        });
    
        const mailOptions = {
            from: '"N&N Hoteles" <administracion@nynhoteles.com.mx>',
            to: email,
            subject: "Creación de usuario",
            html: htmlContent
        };
    
        console.log("Enviando correo...")
    
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error al enviar el correo:', error);
            } else {
                console.log('Correo enviado:', info.response);
            }
        });
    } catch (error) {

    }
}

module.exports = sendEmail;