const Documento = require('../models/Evento');
const { nanoid } = require('nanoid');

async function obtenerEventos(req, res) {
    try {
        const eventos = await Documento.find();
        res.send(eventos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

async function agregarEvento(req, res) {
    try {
        const { resourceId, title, start, end, url, total} = req.body;
        const reserva = {
            id: nanoid(),
            resourceId,
            title,
            start,
            end,
            url,
            total
        }
        console.log('Desde agregar evento en eventController');
        console.log(reserva);

        // const nuevoEvento = {
        //     start: event_start_date,eliminarEvento);
        //     end: event_end_date,
        //     total: total
        // }

        // Encuentra el documento existente
        const documento = await Documento.findOne();

        // Agrega el nuevo evento al arreglo de eventos del documento
        documento.events.push(reserva);

        // Guarda el documento actualizado
        await documento.save();

        console.log('Nuevo evento agregado:', reserva);
        res.status(201).json({ mensaje: 'Nuevo evento agregado', evento: reserva });
    } catch (error) {
        console.error('Error al agregar evento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

async function editarEvento(req, res) {
    try {
        const id = req.params.id;
        const { resourceId, title, start, end, url, total } = req.body;

        // Fetch existing rooms from the database
        const eventosExistentes = await Documento.findOne();
        
        if (!eventosExistentes) {
            return res.status(404).json({ mensaje: 'No se encontraron habitaciones' });
        }

        // Find the room to edit by its ID
        const evento = eventosExistentes.events.find(habitacion => habitacion.id === id);

        if (!evento) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }

        // const { resourceId, title, start, end, url, total } = req.body;


        // Update only the provided fields
        if (resourceId !== undefined && resourceId !== null){
            evento.resourceId = resourceId;
        }

        if (title !== undefined && title !== null) {
            evento.title = title;
        }

        if (start !== undefined && start !== null) {
            evento.start = start;
        }

        if (end !== undefined && end !== null) {
            evento.end = end;
        }

        if (url !== undefined && url !== null) {
            evento.url = url;
        }

        if (total !== undefined && total !== null) {
            evento.total = total;
        }



        // Save the updated room to the database
        await eventosExistentes.save();

        console.log('evento editado:', evento);
        res.status(200).json({ mensaje: 'evento editado correctamente', evento });
    } catch (error) {
        console.error('Error al editar evento:', error);
        res.status(500).json({ error });
    }
}

async function eliminarEvento(req, res) {

    try {
        const id = req.params.id;
        const eventosExistentes = await Documento.findOne();
        
        if (!eventosExistentes) {
            return res.status(404).json({ mensaje: 'No se encontraron eventos' });
        }

        // Find the index of the room to delete by its ID
        const index = eventosExistentes.events.findIndex(evento => evento.id === id);

        if (index === -1) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }

        // Remove the room from the array
        eventosExistentes.events.splice(index, 1);

        // Save the updated room list to the database
        await eventosExistentes.save();

        console.log('Evento eliminado con éxito');
        res.status(200).json({ mensaje: 'Evento eliminado correctamente' });
    } catch(error){
        console.error('Error al eliminar el evento:', error);
        res.status(500).json({ error });
    }
}

module.exports = {
    obtenerEventos,
    agregarEvento,
    editarEvento,
    eliminarEvento
};
