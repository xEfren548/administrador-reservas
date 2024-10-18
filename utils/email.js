const nodemailer = require('nodemailer');
const fs = require('fs');

function sendPassword(email, password, privilege) {
    const message = "Hemos recibido una solicitud de creación de usuario para el sistema web de N&N Hoteles con privilegio de [privilege] para esta dirección de correo electrónico.";
    let htmlContent  = fs.readFileSync("views/templates/emailUserPwd.html", 'utf8');
    
    htmlContent = htmlContent.replace("[message]", message);
    htmlContent = htmlContent.replace("[privilege]", privilege);
    htmlContent = htmlContent.replace("[password]", password);

    const transporter = nodemailer.createTransport({
        host: 'mail.privateemail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'administracion@nynhoteles.com.mx',
            pass: 'Martes.123'
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

module.exports = sendPassword;