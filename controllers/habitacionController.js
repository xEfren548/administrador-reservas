const Habitacion = require('../models/Habitacion');
const PrecioBaseXDia = require('../models/PrecioBaseXDia');
const { nanoid } = require('nanoid');

async function obtenerHabitaciones(req, res) { 
    try {
        // const habitaciones = await Habitacion.find();
        const privilege = req.session.privilege;
        let habitaciones = [];
        
        if (privilege === "Vendedor") {
            const assignedChalets = req.session.assignedChalets;
            habitaciones = await Habitacion.find({ _id: assignedChalets }).lean();
        } else {
            habitaciones = await Habitacion.find().lean();
        }
        
        res.send(habitaciones);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

async function obtenerHabitacionPorId(id) {
    try {
        // const habitacionesExistentes = await Habitacion.findOne(); // Buscar el documento que contiene los eventos
        
        // if (!habitacionesExistentes) {
        //     throw new Error('No se encontraron eventos');
        // }

        // Buscar la habitacion por su id
        // const habitacion = habitacionesExistentes.resources.find(habitacion => habitacion.id === id);
        const habitacion = await Habitacion.findById(id).lean(); // Buscar el documento que contiene los eventos


        if (!habitacion) {
            throw new Error('Habitacion no encontrada');
        }



        return habitacion;
    } catch (error) {
        throw new Error('Error al obtener habitacion por id: ' + error.message);
    }
}

async function obtenerHabitacionPorIdRoute(req, res) {
    try {
        const { id } = req.params;
        // const habitacionesExistentes = await Habitacion.find(); // Buscar el documento que contiene los eventos
        
        // if (!habitacionesExistentes) {
        //     throw new Error('No se encontraron eventos');
        // }

        // Buscar la habitacion por su id
        // const habitacion = habitacionesExistentes.resources.find(habitacion => habitacion.id === id);
        const habitacion = await Habitacion.findById(id).lean(); // Buscar el documento que contiene los eventos

        if (!habitacion) {
            throw new Error('Habitacion no encontrada');
        }



        res.send(habitacion) ;
    } catch (error) {
        throw new Error('Error al obtener habitacion por id: ' + error.message);
    }
}

async function agregarHabitacion(req, res) { // Create
    try {
        const { habitaciones, title, description, ocupacion_max, location, precio_base    } = req.body;
        const nuevaHabitacion = {
            id: nanoid(),
            habitaciones,
            title,
            description,
            ocupacion_max,
            location,
            precio_base
        }


        // Encuentra el documento existente
        // const habitacionesExistentes = await Habitacion.findOne();


        // // Agrega el nuevo evento al arreglo de eventos del documento
        // habitacionesExistentes.resources.push(nuevaHabitacion);
        const habitacion = new Habitacion(nuevaHabitacion);
        await habitacion.save();

        // // Guarda el habitacion actualizado
        // await habitacionesExistentes.save();

        console.log('Nuevo evento agregado:', nuevaHabitacion);
        res.status(201).json({ mensaje: 'Nueva habitacion agregada', habitacion: nuevaHabitacion });
    } catch (error) {
        console.error('Error al agregar habitacion:', error);
        res.status(500).json({ error });
    }
}

async function editarHabitacion(req, res) {
    try {
        const id = req.params.id;
        const { habitaciones, title, ocupacion_max } = req.body;

        // Fetch existing rooms from the database
        // const habitacionesExistentes = await Habitacion.findOne();
        
        // if (!habitacionesExistentes) {
        //     return res.status(404).json({ mensaje: 'No se encontraron habitaciones' });
        // }

        // Find the room to edit by its ID
        // const habitacionExistente = habitacionesExistentes.resources.find(habitacion => habitacion.id === id);
        const habitacionExistente = await Habitacion.findById(id).lean();
        if (!habitacionExistente) {
            return res.status(404).json({ mensaje: 'La habitación no fue encontrada' });
        }

        // Update only the provided fields
        if (habitaciones !== undefined) {
            habitacionExistente.habitaciones = habitaciones;
        }
        if (title !== undefined) {
            habitacionExistente.title = title;
        }
        if (ocupacion_max !== undefined) {
            habitacionExistente.ocupacion_max = ocupacion_max;
        }

        // Save the updated room to the database
        await habitacionExistente.save();

        console.log('Habitación editada:', habitacionExistente);
        res.status(200).json({ mensaje: 'Habitación editada correctamente', habitacion: habitacionExistente });
    } catch (error) {
        console.error('Error al editar habitación:', error);
        res.status(500).json({ error });
    }
}

async function eliminarHabitacion(req, res) {
    try {
        const id  = req.params.id;

        // Fetch existing rooms from the database
        // const habitacionesExistentes = await Habitacion.findOne();
        
        // if (!habitacionesExistentes) {
        //     return res.status(404).json({ mensaje: 'No se encontraron habitaciones' });
        // }

        // Find the index of the room to delete by its ID
        // const index = habitacionesExistentes.resources.findIndex(habitacion => habitacion.id === id);

        // if (index === -1) {
        //     return res.status(404).json({ mensaje: 'La habitación no fue encontrada' });
        // }

        // // Remove the room from the array
        // habitacionesExistentes.resources.splice(index, 1);

        const habitacionesExistentes = await Habitacion.findByIdAndDelete(id);
        // Save the updated room list to the database
        if (!habitacionesExistentes) {
            throw new Error("La habitación no fue encontrada");
        }

        console.log('Habitación eliminada con éxito');
        res.status(200).json({ mensaje: 'Habitación eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar la habitación:', error);
        res.status(500).json({ error });
    }
}

module.exports = {
    obtenerHabitaciones,
    agregarHabitacion,
    editarHabitacion,
    eliminarHabitacion,
    obtenerHabitacionPorId,
    obtenerHabitacionPorIdRoute
};

// hola 2