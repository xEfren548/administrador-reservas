const PrecioBaseXDia = require('../models/PrecioBaseXDia');
const mongoose = require('mongoose');

// Controlador para agregar nuevos datos
async function agregarNuevoPrecio(req, res) {
    try {
        const { precio_modificado, fecha, habitacionId } = req.body;
        const objectHabitacionId = new mongoose.Types.ObjectId(habitacionId);

        const nuevoPrecio = new PrecioBaseXDia({
            precio_modificado,
            fecha,
            habitacionId: objectHabitacionId
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

async function eliminarRegistroPrecio(req, res) {
    try {

        const { fecha, habitacionId } = req.query;

        const resultado = await PrecioBaseXDia.findOneAndDelete({ fecha: new Date(fecha), habitacionId: habitacionId });

        if (!resultado) {
            return res.status(404).json({ message: 'No se encontró ningún registro para eliminar' });
        }

        res.status(200).json({ message: 'Registro eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar el registro de precio:', error);
        res.status(500).json({ error: 'Error al eliminar el registro de precio' });
    }
}

// Función para verificar si existe un registro con la misma fecha y habitación
// Función para verificar si existe un registro con la misma fecha y habitación
async function verificarExistenciaRegistro(req, res) {
    try {
        const { fecha, habitacionId } = req.query;
        console.log(fecha, habitacionId);

        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC

        console.log(fechaAjustada);

        const response = await PrecioBaseXDia.findOne({ fecha: fechaAjustada, habitacionId: habitacionId });
        const existeRegistro = response !== null;
        console.log({existeRegistro});

        res.json({ existeRegistro: existeRegistro });
    } catch (error) {
        console.error('Error al verificar la existencia del registro:', error);
        throw error;
    }
}





module.exports = {
    agregarNuevoPrecio,
    eliminarPrecio,
    consultarPrecios,
    consultarPreciosPorId,
    eliminarRegistroPrecio,
    verificarExistenciaRegistro
};
