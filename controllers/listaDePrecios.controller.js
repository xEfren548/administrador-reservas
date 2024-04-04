const ListaPrecios = require('../models/ListaPrecios');

// Controlador para agregar nuevos datos
async function agregarNuevoPrecio(req, res) {
    try {
        const { nuevo_precio, fechaInicio, fechaFinal, habitacion } = req.body;

        const nuevoPrecio = new ListaPrecios({
            nuevo_precio,
            fechaInicio,
            fechaFinal,
            habitacion
        });

        await nuevoPrecio.save();
        res.status(201).json({ mensaje: 'Precio base agregado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al agregar el precio base.' });
    }
}

// Controlador para eliminar un precio base por su ID
async function eliminarPrecio(req, res) {
    try {
        const { id } = req.params;
        await ListaPrecios.findByIdAndDelete(id);
        res.status(200).json({ mensaje: 'Precio base eliminado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al eliminar el precio base.' });
    }
}

// Controlador para consultar todos los precios base
async function consultarPrecios(req, res) {
    try {
        const precios = await ListaPrecios.find();
        res.status(200).json(precios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

module.exports = {
    agregarNuevoPrecio,
    eliminarPrecio,
    consultarPrecios
};
