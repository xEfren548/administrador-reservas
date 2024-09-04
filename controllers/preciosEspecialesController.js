const PreciosEspeciales = require('../models/PreciosEspeciales');
const Habitacion = require('../models/Habitacion');
const mongoose = require('mongoose');

// Controlador para agregar nuevos datos
async function agregarNuevoPrecio(req, res) {
    const { precio_modificado, precio_base_2noches, costo_base, costo_base_2noches, fecha, criterio, noPersonas, habitacionId } = req.body;
    try {
        const objectHabitacionId = new mongoose.Types.ObjectId(habitacionId);
        
        const precioModificado = Number(precio_modificado);
        const precioBase2Noches = Number(precio_base_2noches);
        const costoBase = Number(costo_base);
        const costoBase2Noches = Number(costo_base_2noches);
        
        if (costoBase > precioModificado){
            throw new Error('El costo base no puede ser mayor al precio base');
        } else if(costoBase2Noches > precioBase2Noches){
            throw new Error('El costo base 2+ noches no puede ser mayor al precio base 2+ noches');
        } else if(precioModificado === 0) {
            throw new Error('El precio no puede ser 0');
        } else if(precioBase2Noches === 0) {
            throw new Error('El precio base 2+ noches no puede ser 0');
        } else if(costoBase === 0) {
            throw new Error('El costo base no puede ser 0')
        } else if(costoBase2Noches === 0) {
            throw new Error('El costo base 2+ noches no puede ser 0')
        }

        // const existePrecioEspecial = await PreciosEspeciales.findOne({habitacionId: habitacionId, noPersonas: noPersonas, criterio: criterio})
        // if (existePrecioEspecial) {
        //     throw new Error('Ya existe un precio especial para la habitación, número de personas y criterio seleccionados');
        // }

        const nuevoPrecio = new PreciosEspeciales({
            precio_modificado: precioModificado,
            precio_base_2noches: precioBase2Noches,
            costo_base: costoBase,
            costo_base_2noches: costoBase2Noches,
            criterio,
            noPersonas,
            fecha,
            habitacionId: objectHabitacionId
        });


        await nuevoPrecio.save();
        res.status(201).json({ mensaje: 'Precio especial agregado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: error.message });
    }
}

// Controlador para eliminar un precio base por su ID
async function eliminarPrecio(req, res) {
    try {
        const { id } = req.params;
        await PreciosEspeciales.findByIdAndDelete(id);
        res.status(200).json({ mensaje: 'Precio base eliminado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al eliminar el precio base.' });
    }
}

// Controlador para consultar todos los precios base
async function consultarPrecios(req, res) {
    try {
        const precios = await PreciosEspeciales.find();
        return precios;
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

async function consultarPreciosPorId(req, res) {
    try {
        const { id } = req.params;
        const precio = await PreciosEspeciales.findById(id);
        return precio;
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Hubo un error al consultar los precios base.' });
    }
}

async function consultarPreciosPorFecha(req, res) {
    try {
        const { fecha, habitacionid, noPersonas } = req.query;
        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC
        console.log(fechaAjustada);
        let precio = await PreciosEspeciales.findOne({ fecha: fechaAjustada, habitacionId: habitacionid, noPersonas: noPersonas });
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

        const { fecha, habitacionId, noPersonas } = req.query;

        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC

        const resultado = await PreciosEspeciales.findOneAndDelete({ fecha: fechaAjustada, habitacionId: habitacionId, noPersonas });

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
async function verificarExistenciaRegistro(req, res) {
    try {
        const { fecha, habitacionId, noPersonas} = req.query;

        // Convertir la fecha a un objeto Date y ajustar la hora a 06:00:00
        const fechaAjustada = new Date(fecha);
        fechaAjustada.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC


        const response = await PreciosEspeciales.findOne({ fecha: fechaAjustada, habitacionId: habitacionId, noPersonas: noPersonas });
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
