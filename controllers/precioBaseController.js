const PrecioBaseXDia = require('../models/PrecioBaseXDia');
const Habitaciones = require('../models/Habitacion');

// Controlador para agregar nuevos datos
async function agregarNuevoPrecio(req, res) {
    try {
        const { precio_base, fecha, habitacion } = req.body;


        const nuevoPrecio = new PrecioBaseXDia({
            precio_base,
            fecha,
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
        await PrecioBaseXDia.findByIdAndDelete(id);
        res.status(200).json({ mensaje: 'Precio base eliminado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al eliminar el precio base.' });
    }
}

// Controlador para consultar todos los precios base
async function consultarPrecios(req, res) {
    try {
        const precios = await PrecioBaseXDia.find();
        res.status(200).json(precios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

async function obtenerHabitacionesConPrecios() {
    try {
        console.log('Hola mundo')
    } catch (error) {
        console.log(error);
    }

}
module.exports = {
    agregarNuevoPrecio,
    eliminarPrecio,
    consultarPrecios,
    obtenerHabitacionesConPrecios
};
