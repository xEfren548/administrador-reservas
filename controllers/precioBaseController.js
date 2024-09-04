const PrecioBaseXDia = require('../models/PrecioBaseXDia');
const PreciosEspeciales = require('../models/PreciosEspeciales');
const Habitacion = require('../models/Habitacion');
const mongoose = require('mongoose');

// Controlador para agregar nuevos datos
async function agregarNuevoPrecio(req, res) {
    try {
        const { precio_modificado, precio_base_2noches, costo_base, costo_base_2noches, fecha, habitacionId } = req.body;
        const objectHabitacionId = new mongoose.Types.ObjectId(habitacionId);

        const nuevoPrecio = new PrecioBaseXDia({
            precio_modificado,
            precio_base_2noches,
            costo_base,
            costo_base_2noches,
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

async function consultarPreciosPorFecha(req, res) {
    try {
        const { fecha, habitacionid, needSpecialPrice, pax } = req.query;
        console.log("need special price? " , needSpecialPrice)
        console.log(typeof needSpecialPrice)
        
        let precio = null;
        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC
        console.log(fechaAjustada);

        if (needSpecialPrice === "true") {
            precio = await PreciosEspeciales.findOne({ fecha: fechaAjustada, habitacionId: habitacionid, noPersonas: pax})
        } else {
            precio = await PrecioBaseXDia.findOne({ fecha: fechaAjustada, habitacionId: habitacionid });

        }
        
        console.log(precio);

        if (precio === null) {
            const habitacionesExistentes = await Habitacion.findOne(); // Buscar el documento que contiene los eventos

            if (!habitacionesExistentes) {
                throw new Error('No se encontraron eventos');
            }

            // Buscar la habitacion por su id
            const habitacion = habitacionesExistentes.resources.find(habitacion => habitacion.id === habitacionid);

            if (!habitacion) {
                throw new Error('Habitacion no encontrada');
            }

            precio = {
                costo_base: habitacion.others.baseCost,
                costo_base_2noches: habitacion.others.baseCost2nights,
                precio_modificado: habitacion.others.basePrice,
                precio_base_2noches: habitacion.others.basePrice2nights
            }
        }
        res.send(precio);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

async function eliminarRegistroPrecio(req, res) {
    try {

        const { fecha, habitacionId } = req.query;

        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC
        console.log(fechaAjustada);
        const resultado = await PrecioBaseXDia.findOneAndDelete({ fecha: fechaAjustada, habitacionId: habitacionId });
        console.log(resultado);
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

        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC
// No changes

        const response = await PrecioBaseXDia.findOne({ fecha: fechaAjustada, habitacionId: habitacionId });
        const existeRegistro = response !== null;

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
    consultarPreciosPorFecha,
    eliminarRegistroPrecio,
    verificarExistenciaRegistro
};
