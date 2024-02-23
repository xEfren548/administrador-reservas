const Documento = require('../models/Evento');

async function agregarEvento(req, res) {
    try {
        const nuevoEvento = {
            id: "6",
            resourceId: "5",
            title: "Nuevo Evento",
            start: "2024-02-25",
            end: "2024-02-27",
            url: "https://example.com/",
            total: 2000
        };

        // Encuentra el documento existente
        const documento = await Documento.findOne();

        // Agrega el nuevo evento al arreglo de eventos del documento
        documento.events.push(nuevoEvento);

        // Guarda el documento actualizado
        await documento.save();

        console.log('Nuevo evento agregado:', nuevoEvento);
        res.status(201).json({ mensaje: 'Nuevo evento agregado', evento: nuevoEvento });
    } catch (error) {
        console.error('Error al agregar evento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

module.exports = {
    agregarEvento
};
