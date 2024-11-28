const nodemailer = require('nodemailer');
const fs = require('fs');

function sendEmail(email, reservationId) {
    const message = "Este es un correo de prueba";
    let htmlContent  = fs.readFileSync("views/templates/emailUserPwd.html", 'utf8');
    
    htmlContent = htmlContent.replace("[message]", message);
    // htmlContent = htmlContent.replace("[privilege]", privilege);
    // htmlContent = htmlContent.replace("[password]", password);

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
}

module.exports = sendEmail;