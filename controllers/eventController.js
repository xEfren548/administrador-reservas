const Documento = require('../models/Evento');
const { nanoid } = require('nanoid');


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
        //     start: event_start_date,
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

module.exports = {
    agregarEvento
};
