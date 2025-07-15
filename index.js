const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const http = require('http');
const https = require('https');
const app = express();
const { engine } = require('express-handlebars');
const routes = require('./routes/indexRoutes');
const schedule = require('node-schedule');
const cron = require('node-cron');
const Evento = require('./models/Evento');
const Cliente = require('./models/Cliente');
const Habitacion = require('./models/Habitacion');
const logController = require('./controllers/logController');
const NotFoundError = require('./common/error/not-found-error');
const SendMessages = require('./common/tasks/send-messages');
const backupController = require('./controllers/backupController');


// Configura Express para servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.json())

// Express File Upload
// app.use(fileUpload());

// Configuración del motor de plantillas
app.engine('handlebars', engine({
    helpers: {
      eq: function (value1, value2) {
        return value1 === value2;
      },
      json: function (context) {
        return JSON.stringify(context);
      },
      lookup: function(obj, key) {
        if (!obj) return null;
        return obj[key];
      }
    }
  }));
app.set('view engine', 'handlebars');
app.set('views', './views');

console.log(`Env variable: ${process.env.NODE_ENV}`)

const port = process.env.NODE_ENV === 'development' ? 3005 : process.env.PORT || 443; // 3005 for development, HTTPS for production
const db_url = process.env.NODE_ENV === 'development' ? process.env.DEV_DB : process.env.DB_URL;

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

app.get('/backup', (req, res) => {
  backupController.createBackup();
  res.send('Respaldo iniciado manualmente');
});

app.use((req, res, next) => {
  const allowedIps = ['::ffff:177.249.172.194', '::1'];
  const userIp = req.ip || req.connection.remoteAddress;
  console.log('userIp', userIp);
  console.log('req path', req.path);

  if (!allowedIps.includes(userIp)) {
    return res.status(403).send('Sitio en mantenimiento');
  }

  next();
});
// Set up all routes.
app.use(routes);

// const sslOptions = {
//   key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
//   cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
// };

async function cleanupInactiveUsers() {
  try {
      console.log('Starting inactive users cleanup');

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const result = await Cliente.deleteMany({
          $or: [
              { email: { $in: [null, '', undefined] } },
              { phone: { $in: [null, '', undefined] } },
              { address: { $in: [null, '', undefined] } 
            }],
            createdAt: { $lt: oneWeekAgo}
      });

      // Log
      const logBody = {
          fecha: Date.now(),
          type: 'elimination',
          acciones: `Usuario eliminado por inactividad`
      }
      await logController.createBackendLog(logBody);

      console.log(`Deleted ${result.deletedCount} inactive users`);
  } catch (error) {
      console.log('Error in cleanupInactiveUsers:', error);
  }
}

// Connecting app to Mongoose
mongoose.connect(db_url).then(async () => {
  let server;
  
  if (process.env.NODE_ENV === 'development') {
    // For development, run on HTTP at port 3005
    server = http.createServer(app);
    console.log('Development mode: Running on HTTP at port 3005');
  } else {
    // For production, run on HTTPS
    const sslOptions = {
      key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
    };
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

    const quarterlyJob = schedule.scheduleJob('0 0 1 */3 *', async () => {
        await cleanupInactiveUsers();
    });

    cron.schedule('0 2 1,15 * *', () => {
      console.log('Iniciando respaldo de la base de datos cada 15 días...');
      backupController.createBackup();
    });

    
    

    // Para mantener la aplicación escuchando
    process.on('SIGINT', async () => {
        job.cancel(); // Cancela el scheduler cuando se detiene la aplicación
        quarterlyJob.cancel();
        await mongoose.connection.close();
        server.close(() => {
          console.log('HTTPS server closed');
          process.exit(0);
        });
        process.exit(0);
    });

}).catch((err) => {
    console.log('failed to connect' + err.message);
});