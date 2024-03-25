const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const { engine } = require('express-handlebars');
const routes = require('./routes/indexRoutes'); 

// Configura Express para servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.json())


// Configuración del motor de plantillas
app.engine('handlebars', engine())
app.set('view engine', 'handlebars');
app.set('views', './views');

const port = process.env.PORT || 3005;

const db_url = process.env.DB_URL;

async function connect() {
    try {
        await mongoose.connect(db_url);
        app.listen(port, () => {
            console.log(`App is running on port ${port}`);
        })

    } catch (err) {
        console.log('failed to connect' + err.message);
    }
}

connect();

app.use(routes);




// HOLA