const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const exphbs = require('express-handlebars');
const cors = require('cors');

const eventRoutes = require('./routes/eventRoutes');
const habitacionesRoutes = require('./routes/habitacionesRoutes');
// Configura Express para servir archivos estáticos desde la carpeta 'public'

app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.json())

const dominiosPermitidos = ['https://administrador-reservas.onrender.com/', 'https://navarro.integradev.site/'];
const corsOptions = {
    origin: function(origin, callback){
        if(dominiosPermitidos.indexOf(origin) !== -1) {
            // El origen del Request esta permitido
            callback(null, true);
        }else{
            callback(new Error('No permitido por CORS'))
        }
    }
}
app.use(cors(corsOptions));




// Configuración del motor de plantillas
app.set('views', path.join(__dirname, 'views'))
app.engine('.hbs', exphbs.engine({
    extname: '.hbs',
    // Disable the knownHelpersOnly check
    runtimeOptions: {
        knownHelpersOnly: false,
        allowProtoPropertiesByDefault: true
    }
}))
app.set('view engine', '.hbs');




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


app.use('', eventRoutes);
app.use('', habitacionesRoutes);


