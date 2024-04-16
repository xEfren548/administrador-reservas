const PrecioBaseXDia = require('../models/PrecioBaseXDia');

// Controlador para agregar nuevos datos
async function agregarNuevoPrecio(req, res) {
    try {
<<<<<<< HEAD
        const { precio_modificado, fecha, habitacion } = req.body;


        const nuevoPrecio = new PrecioBaseXDia({
            precio_modificado,
=======
        const { precio_base, fecha, habitacion } = req.body;


        const nuevoPrecio = new PrecioBaseXDia({
            precio_base,
>>>>>>> d787274b362d94bdcca4e08a4663192234aedbef
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
        return precios;
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

async function consultarPreciosPorId(req, res) {
    try {
        const { id } = req.params;
        const precio = await PrecioBaseXDia.findById(id);
        return precio;
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

<<<<<<< HEAD
async function modificacionMasivaPrecios(req, res) {
    try {
        const { precio_modificado, fecha, habitacion } = req.body;


        const nuevoPrecio = new PrecioBaseXDia({
            precio_modificado,
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

=======
>>>>>>> d787274b362d94bdcca4e08a4663192234aedbef

module.exports = {
    agregarNuevoPrecio,
    eliminarPrecio,
    consultarPrecios,
    consultarPreciosPorId
};
