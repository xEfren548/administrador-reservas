const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const Evento = require('./models/Evento')

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

app.post('/eventos', async (req, res) => {
    
});

app.put('/eventos/:id', async (req, res) => {
    try {
        const idEvento = req.params.id; // Obtener el ID del evento de los parámetros de la URL
        const nuevoEvento = req.body; // Obtener los datos actualizados del evento desde el cuerpo de la solicitud
        const resultado = await Reserva.findByIdAndUpdate(idEvento, nuevoEvento, { new: true }); // Buscar y actualizar el evento en la base de datos
        res.json(resultado); // Devolver el resultado como JSON
    } catch (error) {
        res.status(400).json({ message: error.message }); // Si ocurre un error, devolver un mensaje de error con el código de estado 400 (Bad Request)
    }
});