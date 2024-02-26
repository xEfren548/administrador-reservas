const Habitacion = require('../models/Habitacion');
const { nanoid } = require('nanoid');

async function agregarHabitacion(req, res) { // Create
    try {
        const { habitaciones, title, ocupacion_max } = req.body;
        const nuevaHabitacion = {
            id: nanoid(),
            habitaciones,
            title,
            ocupacion_max
        }
        console.log('Desde agregar evento en eventController');
        console.log(nuevaHabitacion);

        // const nuevoEvento = {
        //     start: event_start_date,
        //     end: event_end_date,
        //     total: total
        // }

        // Encuentra el documento existente
        const habitacionesExistentes = await Habitacion.findOne();

        // Agrega el nuevo evento al arreglo de eventos del documento
        habitacionesExistentes.resources.push(nuevaHabitacion);

        // Guarda el habitacion actualizado
        await habitacionesExistentes.save();

        console.log('Nuevo evento agregado:', nuevaHabitacion);
        res.status(201).json({ mensaje: 'Nueva habitacion agregada', habitacion: nuevaHabitacion });
    } catch (error) {
        console.error('Error al agregar habitacion:', error);
        res.status(500).json({ error });
    }
}

module.exports = {
    agregarHabitacion
};
