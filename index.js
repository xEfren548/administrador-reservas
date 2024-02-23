const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const Evento = require('./models/Evento')
const eventRoutes = require('./routes/eventRoutes'); 
const path = require('path');
const app = express();

// Configura Express para servir archivos estáticos desde la carpeta 'public'

app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.json())



const port = process.env.PORT || 3000;

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

app.get('/eventos', async (req, res) => {
    try {
        const eventos = await Evento.find();
        console.log(eventos)
        res.send(eventos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
});

app.use('', eventRoutes);


