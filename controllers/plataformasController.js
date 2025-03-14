const mongoose = require('mongoose');
const Plataformas = require('../models/Plataformas');
const Habitaciones = require('../models/Habitacion');
const precioBaseController = require('../controllers/precioBaseController');
const preciosEspecialesController = require('../controllers/preciosEspecialesController');

const renderVistaPlataformas = async (req, res) => {
    const habitaciones = await Habitaciones.find({ isActive: true }).lean();
    const mappedChalets = habitaciones.map(chalet => ({
        id: chalet._id,
        name: chalet.propertyDetails.name
    }))

    const preciosHabitacionesData = await precioBaseController.consultarPrecios();
    //console.log(preciosHabitacionesData);
    const preciosEspecialesData = await preciosEspecialesController.consultarPrecios()
    console.log(preciosEspecialesData)
    res.render('plataformasView', {
        layout: 'tailwindMain',
        chalets: mappedChalets,
        preciosHabitaciones: preciosHabitacionesData,
        preciosEspeciales: preciosEspecialesData
    });
}

const obtenerPlataformas = async (req, res) => {
    const plataformas = await Plataformas.find().lean();
    if (!plataformas) {
        res.status(404).send({ message: 'No platforms found' });
    }
    res.status(200).send(plataformas);
}

const nuevaPlataforma = async (req, res) => {
    try {
        
        const { nombre, descripcion, aumentoPorcentaje } = req.body;
        if (!nombre) {
            throw new Error('El nombre de la plataforma es requerido');
        }
        if (!aumentoPorcentaje || aumentoPorcentaje <= 0 || aumentoPorcentaje > 100) {
            throw new Error('El aumento porcentaje de la plataforma es requerido y debe ser un valor entre 0 y 100');
        }
        const plataforma = new Plataformas({ nombre, descripcion, aumentoPorcentaje });
        await plataforma.save();
        res.status(201).send(plataforma);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: error.message });
    }
}

const modificarPlataforma = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, aumentoPorcentaje } = req.body;
        if (!nombre) {
            throw new Error('El nombre de la plataforma es requerido');
        }
        if (!aumentoPorcentaje || aumentoPorcentaje <= 0 || aumentoPorcentaje > 100) {
            throw new Error('El aumento porcentaje de la plataforma es requerido y debe ser un valor entre 0 y 100');
        }
        const plataforma = await Plataformas.findByIdAndUpdate(id, { nombre, descripcion, aumentoPorcentaje }, { new: true });
        if (!plataforma) {
            throw new Error('No se encontró la plataforma con el ID proporcionado');
        }
        res.status(200).send(plataforma);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: error.message });
    }
}

const eliminarPlataforma = async (req, res) => {
    try {
        const { id } = req.params;
        const plataforma = await Plataformas.findByIdAndDelete(id);
        if (!plataforma) {
            throw new Error('No se encontró la plataforma con el ID proporcionado');
        }
        res.status(200).send({ message: 'Plataforma eliminada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: error.message });
    }
}



module.exports = { 
    renderVistaPlataformas,
    obtenerPlataformas,
    nuevaPlataforma,
    modificarPlataforma,
    eliminarPlataforma
};