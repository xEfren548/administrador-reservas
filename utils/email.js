const nodemailer = require('nodemailer');
const fs = require('fs');

function sendPassword(email, password, privilege) {
    const message = "Hemos recibido una solicitud de creación de usuario para el sistema web de N&N Hoteles con privilegio de [privilege] para esta dirección de correo electrónico.";
    let htmlContent  = fs.readFileSync("views/templates/emailUserPwd.html", 'utf8');
    
    htmlContent = htmlContent.replace("[message]", message);
    htmlContent = htmlContent.replace("[privilege]", privilege);
    htmlContent = htmlContent.replace("[password]", password);

    const transporter = nodemailer.createTransport({
        host: 'premium68.web-hosting.com',
        port: 587,
        secure: false,
        auth: {
            user: 'no-reply@jfsoluciones.com.mx',
            pass: '~3GoVL-2P{%K'
        }
    });

    const mailOptions = {
        from: '"N&N Hoteles" <no-reply@jfsoluciones.com.mx>',
        to: email,
        subject: "Creación de usuario",
        html: htmlContent
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error al enviar el correo:', error);
        } else {
            console.log('Correo enviado:', info.response);
        }
    });
}

module.exports = sendPassword;