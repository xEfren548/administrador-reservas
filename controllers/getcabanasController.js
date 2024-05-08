const Habitacion = require('../models/Habitacion');


async function showChaletsData(req, res, next){
    try {
        const chalets = await Habitacion.find();
        res.send(chalets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

module.exports = {
    showChaletsData
}