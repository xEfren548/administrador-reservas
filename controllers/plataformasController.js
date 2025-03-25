const mongoose = require('mongoose');
const Plataformas = require('../models/Plataformas');
const Habitaciones = require('../models/Habitacion');
const precioBaseController = require('../controllers/precioBaseController');
const preciosEspecialesController = require('../controllers/preciosEspecialesController');

const renderVistaPlataformas = async (req, res) => {
    const habitaciones = await Habitaciones.find({ isActive: true }).lean();
    const mappedChalets = habitaciones.map(chalet => ({
        id: chalet._id,
        name: chalet.propertyDetails.name,
        baseCost: chalet.others.baseCost,
        baseCost2nights: chalet.others.baseCost2nights,
        basePrice: chalet.others.basePrice,
        basePrice2nights: chalet.others.basePrice2nights,
        activePlatforms: chalet.activePlatforms || undefined,
    }))

    const plataformas = await Plataformas.find().lean();

    const plataformasMap = plataformas.reduce((map, plataforma) => {
        map[plataforma._id] = {
            nombre: plataforma.nombre,
            aumentoPorcentual: plataforma.aumentoPorcentual,
            aumentoFijo: plataforma.aumentoFijo
        }
        return map;
    }, {});

    const habitacionesConNombresDePlataformas = mappedChalets.map(habitacion => {
        if (habitacion.activePlatforms) {
            return {
                ...habitacion,
                activePlatforms: habitacion.activePlatforms.map(platformId => ({
                    id: platformId,
                    name: plataformasMap[platformId] || "Plataforma Desconocida", // Usar el nombre o un valor por defecto,
                    aumentoPorcentual: plataformasMap[platformId]?.aumentoPorcentual || 0,
                    aumentoFijo: plataformasMap[platformId]?.aumentoFijo || 0
                }))
            };
        } else {
            return {
                ...habitacion,
                activePlatforms: undefined // Si no existe activePlatforms, se establece como undefined
            };
        }
    });

    const preciosHabitacionesData = await precioBaseController.consultarPrecios();
    //console.log(preciosHabitacionesData);

    for (const habitacion of habitacionesConNombresDePlataformas) {
        console.log(habitacion.activePlatforms);
    }
    const preciosEspecialesData = await preciosEspecialesController.consultarPrecios()
    res.render('plataformasView', {
        layout: 'tailwindMain',
        habitaciones: habitacionesConNombresDePlataformas,
        preciosHabitaciones: preciosHabitacionesData,
        preciosEspeciales: preciosEspecialesData,
        plataformas
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
        
        const { nombre, descripcion, aumentoFijo, aumentoPorcentaje } = req.body;
        if (!nombre) {
            throw new Error('El nombre de la plataforma es requerido');
        }
        if (aumentoFijo) {
            if (aumentoFijo < 0) {
                throw new Error('El aumento fijo de la plataforma no puede ser negativo');
            }
        }

        if (aumentoPorcentaje) {
            if (aumentoPorcentaje < 0 || aumentoPorcentaje > 100) {
                throw new Error('El aumento porcentaje de la plataforma debe ser un valor entre 0 y 100');
            }
        }

        console.log("aumento fijo: ", aumentoFijo, "aumento porcentaje: " ,aumentoPorcentaje);

        let newPlataforma = {}

        if (aumentoFijo) {
            newPlataforma = new Plataformas({ nombre, descripcion, aumentoFijo });
        } else if (aumentoPorcentaje) {
            newPlataforma = new Plataformas({ nombre, descripcion, aumentoPorcentual: aumentoPorcentaje });
        }

        // const plataforma = new Plataformas({ nombre, descripcion, aumentoPorcentual: aumentoPorcentaje, aumentoFijo });
        await newPlataforma.save();
        res.status(201).send(newPlataforma);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: error.message });
    }
}

const modificarPlataforma = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, aumentoPorcentaje, aumentoFijo } = req.body;
        if (!id) {
            throw new Error('El ID de la plataforma es requerido');
        }
        console.log("ID PLATAFORMA: ", id);
        if (!nombre) {
            throw new Error('El nombre de la plataforma es requerido');
        }
        if (aumentoFijo) {
            if (aumentoFijo < 0) {
                throw new Error('El aumento fijo de la plataforma no puede ser negativo');
            }
        }
        if (aumentoPorcentaje) {
            if (!aumentoPorcentaje || aumentoPorcentaje <= 0 || aumentoPorcentaje > 100) {
                throw new Error('El aumento porcentaje de la plataforma es requerido y debe ser un valor entre 0 y 100');
            }
        }
        let plataforma = null;
        if (aumentoFijo) {
            plataforma = await Plataformas.findByIdAndUpdate(id, { nombre, descripcion, aumentoFijo }, { new: true });
        } else if (aumentoPorcentaje) {
            plataforma = await Plataformas.findByIdAndUpdate(id, { nombre, descripcion, aumentoPorcentual: aumentoPorcentaje }, { new: true });
        }
        // const plataforma = await Plataformas.findByIdAndUpdate(id, { nombre, descripcion, aumentoPorcentaje }, { new: true });
        if (!plataforma) {
            throw new Error('No se encontró la plataforma con el ID proporcionado');
        }
        console.log(plataforma);
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

        const resultadoActualizacion = await Habitaciones.updateMany(
            { activePlatforms: id },
            { $pull: { activePlatforms: id } }
        );


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