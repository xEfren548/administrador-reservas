const mongoose = require('mongoose');
const Habitacion = require('../models/Habitacion');
const BloqueoFechas = require('../models/BloqueoFechas');
const channexController = require('../controllers/channexController');

async function obtenerFechasBloqueadas(req, res){
    const fechasBloquedas = await BloqueoFechas.find().lean();
    if (!fechasBloquedas){
        res.status(404).send({ message: 'No dates found' });
    }
    res.status(200).send(fechasBloquedas);
}

async function crearFechaRestringida(req, res){
    const {date, min, habitacionId, type} = req.body;

    console.log(req.body);

    try {

        if (type !== 'restriccion') {
            return res.status(400).send({ message: 'Invalid type value' });
        }

        if (isNaN(min) || min <= 0) {
            return res.status(400).send({ message: 'Invalid min value' });
        }

        const fechaFormatted = new Date(date)
        fechaFormatted.setUTCHours(6); // Ajustar la hora a 00:00:00 UTC
        const mongooseHabitacionId = new mongoose.Types.ObjectId(habitacionId);
    
        const description = `Estancia mínima de ${min} noches.`
    
    
        const existeFecha = await BloqueoFechas.findOne({date: date, habitacionId: mongooseHabitacionId, type: 'restriccion'});
        if (existeFecha){
            // edit the existe fecha to the new description and min
            existeFecha.description = description;
            existeFecha.min = min;
            await existeFecha.save();
            return res.status(201).send({ message: 'Date modified successfully', date: existeFecha});
    
        }
    
        const newFechaBloqueada = new BloqueoFechas({
            date: new Date(date),
            description,
            min,
            type,
            habitacionId: new mongoose.Types.ObjectId(habitacionId)
        })
    
        const agregarFecha = await newFechaBloqueada.save();
        if (!agregarFecha){
            return res.status(400).send({ message: 'Failed to create date' });
        }
        res.status(200).send({ message: 'Date created successfully', date: agregarFecha});
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
}

async function crearFechaBloqueada(req, res){
    const {date, habitacionId, type, min} = req.body;

    try {

        if (type !== 'bloqueo' && type !== 'capacidad_minima') {
            return res.status(400).send({ message: 'Invalid type value' });
        }

        if (type === 'capacidad_minima' && isNaN(min) || min <= 0) {
            return res.status(400).send({ message: 'Invalid min value' });
        }

        const fechaFormatted = new Date(date)
        fechaFormatted.setUTCHours(6); // Ajustar la hora a 00:00:00 UTC
        const mongooseHabitacionId = new mongoose.Types.ObjectId(habitacionId);
    
        const description = (type === "bloqueo") ? `Fecha bloqueada` : `Capacidad mínima de ${min} personas.`
    
    
        const existeFecha = await BloqueoFechas.findOne({date: date, habitacionId: mongooseHabitacionId, type: type})
        if (existeFecha){
            // edit the existe fecha to the new description and min
            existeFecha.description = description;
            if (type === "capacidad_minima") {
                existeFecha.min = min;
            }
            await existeFecha.save();
            return res.status(201).send({ message: 'Date modified successfully', date: existeFecha});
    
        }
    
        let newFechaBloqueada;
        if (type === "capacidad_minima") {
            newFechaBloqueada = new BloqueoFechas({
                date: new Date(date),
                description,
                habitacionId: new mongoose.Types.ObjectId(habitacionId),
                type: 'capacidad_minima',
                min: min
            })
        } else if (type === "bloqueo") {
            newFechaBloqueada = new BloqueoFechas({
                date: new Date(date),
                description,
                habitacionId: new mongoose.Types.ObjectId(habitacionId),
                type: 'bloqueo'
            })
        } else {
            newFechaBloqueada = null
        }

        if (!newFechaBloqueada) {
            return res.status(400).send({ message: 'Invalid type value' });
        }
    
        const agregarFecha = await newFechaBloqueada.save();
        if (!agregarFecha){
            return res.status(400).send({ message: 'Failed to create date' });
        }

        const chalet = await Habitacion.findById(habitacionId).select('channels')
        console.log(chalet);

        if (chalet.channels?.length > 0) {
            channexController.updateChannexAvailability(chalet._id)
            .then(() => {
                console.log("Disponibilidad actualizada en Channex.");
            })
            .catch(err => {
                // Aquí puedes: loggear a archivo, mandar notificación, email, etc.
                console.error("Error al actualizar disponibilidad en Channex: ", err.message);
            });
        }
        res.status(200).send({ message: 'Date created successfully', date: agregarFecha});
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
}

async function eliminarFechaBloqueada(req, res){
    try{
        const { fecha, habitacionId, type } = req.query;
        console.log(fecha)
        console.log(habitacionId)
    
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 00:00:00 UTC
        const newHabitacionId = new mongoose.Types.ObjectId(habitacionId);

        if (type === 'bloqueo') {
            const resultado = await BloqueoFechas.findOneAndDelete({ date: fechaAjustada, habitacionId: newHabitacionId, type: 'bloqueo' });

            if (!resultado) {
                return res.status(200).json({});
            }

            const chalet = await Habitacion.findById(habitacionId).select('channels')
            console.log(chalet);

            if (chalet.channels?.length > 0) {
                channexController.updateChannexAvailability(chalet._id)
                .then(() => {
                    console.log("Disponibilidad actualizada en Channex.");
                })
                .catch(err => {
                    // Aquí puedes: loggear a archivo, mandar notificación, email, etc.
                    console.error("Error al actualizar disponibilidad en Channex: ", err.message);
                });
            }

            return res.status(200).json({ message: 'Registro eliminado correctamente' });

        } else if (type === "bloqueo_capacidad") {
            const resultado = await BloqueoFechas.findOneAndDelete({ date: fechaAjustada, habitacionId: newHabitacionId, type: 'capacidad_minima' });

            if (!resultado) {
                return res.status(200).json({});
            }

            return res.status(200).json({ message: 'Registro eliminado correctamente' });
        }

        const resultado = await BloqueoFechas.findOneAndDelete({
            date: fechaAjustada,
            habitacionId: newHabitacionId,
            type: { $ne: 'bloqueo', $ne: 'capacidad_minima' }
        });
        
        if (!resultado) {
            return res.status(200).json({});
        }
    
        res.status(200).json({ message: 'Registro eliminado correctamente' });

    } catch(error){
        console.error('Error al eliminar el registro de precio:', error);
        res.status(500).json({ error: 'Error al eliminar el registro de precio' });
    }
}


module.exports = {
    obtenerFechasBloqueadas,
    crearFechaRestringida,
    crearFechaBloqueada,
    eliminarFechaBloqueada
}