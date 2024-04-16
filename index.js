const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const { engine } = require('express-handlebars');
const routes = require('./routes/indexRoutes'); 
// require('add-to-calendar-button');

// Configura Express para servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.json())

// Configuración del motor de plantillas
app.engine('handlebars', engine())
app.set('view engine', 'handlebars');
app.set('views', './views');

const port = process.env.PORT || 3005;
const db_url = process.env.DB_URL;

// Ensures Express correctly handles requests and interprets the necessary headers when using cookie sessions with postman.
app.set('trust proxy', true);

// Set up all routes.
app.use(routes);

// Connecting app to Mongoose
mongoose.connect(db_url).then(()=>{
    app.listen(port, () => {
        console.log(`App is running on port ${port}`);
    })
}).catch((err)=>{
    console.log('failed to connect' + err.message);
});