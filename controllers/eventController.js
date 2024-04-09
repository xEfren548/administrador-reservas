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

async function obtenerEventoPorId(id) {
    try {
        const eventosExistentes = await Documento.findOne(); // Buscar el documento que contiene los eventos
        
        if (!eventosExistentes) {
            throw new Error('No se encontraron eventos');
        }

        // Buscar el evento por su id
        const evento = eventosExistentes.events.find(evento => evento.id === id);

        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }



        return evento;
    } catch (error) {
        throw new Error('Error al obtener el evento por id: ' + error.message);
    }
}

async function agregarEvento(req, res) {
    try {
        const id = nanoid();
        const { resourceId, title, start, end, total} = req.body;
        const reserva = {
            id,
            resourceId,
            title,
            start,
            end,
            url: `${process.env.URL}/eventos/${id}` ,
            total
        }

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

async function modificarEvento(req, res) {
    try {
        const { event, newResource } = req.body;

        console.log('eventoRecibido: ',  event);

        // Obtener el ID del evento y la nueva fecha
        const eventId = req.params.id;
        const newStartDate = event.start;
        const newEndDate = event.end;

        // Buscar el evento existente por su ID
        const eventosExistentes = await Documento.findOne();
        

        const evento = eventosExistentes.events.find(evento => evento.id === eventId);


        if (!evento) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }else {
            console.log('evento encontrado: ', evento);
        }

        

        // Actualizar la fecha de inicio y fin del evento existente
        evento.start = newStartDate;
        evento.end = newEndDate;

        if(newResource){
            const newResourceId = newResource.id;
            evento.resourceId = newResourceId;

        }

        // Guardar el evento actualizado en la base de datos
        await eventosExistentes.save();

        console.log('Evento modificado:', evento);
        res.status(200).json({ mensaje: 'Evento modificado correctamente', evento: evento });
    } catch (error) {
        console.error('Error al modificar el evento:', error);
        res.status(500).json({ error });
    }
}

module.exports = {
    obtenerEventos,
    obtenerEventoPorId,
    agregarEvento,
    editarEvento,
    eliminarEvento,
    modificarEvento
};

