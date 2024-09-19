const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const https = require('https');
const app = express();
const { engine } = require('express-handlebars');
const routes = require('./routes/indexRoutes');
const schedule = require('node-schedule');
const Evento = require('./models/Evento');
const Cliente = require('./models/Cliente');
const Habitacion = require('./models/Habitacion');
const NotFoundError = require('./common/error/not-found-error');
const SendMessages = require('./common/tasks/send-messages');

// Configura Express para servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.json())

// Configuración del motor de plantillas
app.engine('handlebars', engine({
    helpers: {
      eq: function (value1, value2) {
        return value1 === value2;
      },
      json: function (context) {
        return JSON.stringify(context);
      }
    }
  }));
app.set('view engine', 'handlebars');
app.set('views', './views');

const port = process.env.PORT || 3005;
const db_url = process.env.DB_URL;

// Ensures Express correctly handles requests and interprets the necessary headers when using cookie sessions with postman.
app.set('trust proxy', true);

app.use((req, res, next) => {
  if (req.secure || process.env.NODE_ENV === 'development') {
    next();
  } else {
    res.redirect('https://' + req.headers.host + req.url);
  }
});

// Set up all routes.
app.use(routes);

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
};

// Connecting app to Mongoose
mongoose.connect(db_url).then(async () => {
    const server = https.createServer(sslOptions, app);

    server.listen(port, () => {
      console.log(`HTTPS server is running on port ${port}`);
    });

    
    // const job = schedule.scheduleJob('* * * * *', async () => {         
    const job = schedule.scheduleJob('* * * * *', async () => {         
        await SendMessages.sendReminders();
        await SendMessages.sendThanks();
        await SendMessages.cancelReservation();
    });
    

    // Para mantener la aplicación escuchando
    process.on('SIGINT', () => {
        job.cancel(); // Cancela el scheduler cuando se detiene la aplicación
        mongoose.connection.close();
        server.close(() => {
          console.log('HTTPS server closed');
          process.exit(0);
        });
        process.exit(0);
    });

}).catch((err) => {
    console.log('failed to connect' + err.message);
});