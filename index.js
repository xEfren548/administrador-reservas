const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const http = require('http');
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

console.log(`Env variable: ${process.env.NODE_ENV}`)

const port = process.env.NODE_ENV === 'development' ? 3005 : process.env.PORT || 443; // 3005 for development, HTTPS for production
const db_url = process.env.DB_URL;

// Ensures Express correctly handles requests and interprets the necessary headers when using cookie sessions with postman.
app.set('trust proxy', true);

if (process.env.NODE_ENV !== 'development'){
  app.use((req, res, next) => {
    if (req.secure) {
      next(); // Already using HTTPS
    } else {
      res.redirect('https://' + req.headers.host + req.url); // Redirect to HTTPS
    }
  });
}

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
  let server;
  
  if (process.env.NODE_ENV === 'development') {
    // For development, run on HTTP at port 3005
    server = http.createServer(app);
    console.log('Development mode: Running on HTTP at port 3005');
  } else {
    // For production, run on HTTPS
    server = https.createServer(sslOptions, app);
    console.log('Production mode: Running on HTTPS');
  }

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