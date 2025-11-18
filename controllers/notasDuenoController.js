const Evento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const mongoose = require('mongoose');

/**
 * Agregar nota del dueño a una reserva
 */
async function agregarNotaDueno(req, res) {
    try {
        const { id: reservaId } = req.params;
        const { texto } = req.body;
        const duenoId = req.session.id;

        if (!texto || texto.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'El texto de la nota es requerido' 
            });
        }

        const reserva = await Evento.findById(reservaId);

        if (!reserva) {
            return res.status(404).json({ 
                success: false, 
                message: 'Reserva no encontrada' 
            });
        }

        // Validar que sea el dueño de la propiedad
        const chalet = await Habitacion.findById(reserva.resourceId);
        if (!chalet || chalet.others.owner.toString() !== duenoId) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes permisos para agregar notas a esta reserva' 
            });
        }

        // Agregar nota
        reserva.notasDueno.push({
            texto: texto.trim(),
            autor: duenoId,
            fecha: new Date()
        });

        await reserva.save();

        res.json({
            success: true,
            message: 'Nota agregada exitosamente',
            nota: reserva.notasDueno[reserva.notasDueno.length - 1]
        });

    } catch (error) {
        console.error('Error agregando nota:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Obtener notas del dueño de una reserva
 */
async function obtenerNotasDueno(req, res) {
    try {
        const { id: reservaId } = req.params;
        const duenoId = req.session.id;

        const reserva = await Evento.findById(reservaId)
            .populate('notasDueno.autor', 'firstName lastName')
            .lean();

        if (!reserva) {
            return res.status(404).json({ 
                success: false, 
                message: 'Reserva no encontrada' 
            });
        }

        // Validar permisos
        const chalet = await Habitacion.findById(reserva.resourceId);
        if (!chalet || chalet.others.owner.toString() !== duenoId) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes permisos para ver notas de esta reserva' 
            });
        }

        res.json({
            success: true,
            notas: reserva.notasDueno || []
        });

    } catch (error) {
        console.error('Error obteniendo notas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Eliminar nota del dueño
 */
async function eliminarNotaDueno(req, res) {
    try {
        const { id: reservaId, notaId } = req.params;
        const duenoId = req.session.id;

        const reserva = await Evento.findById(reservaId);

        if (!reserva) {
            return res.status(404).json({ 
                success: false, 
                message: 'Reserva no encontrada' 
            });
        }

        // Validar permisos
        const chalet = await Habitacion.findById(reserva.resourceId);
        if (!chalet || chalet.others.owner.toString() !== duenoId) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes permisos para eliminar notas de esta reserva' 
            });
        }

        // Buscar y eliminar nota
        const notaIndex = reserva.notasDueno.findIndex(
            n => n._id.toString() === notaId
        );

        if (notaIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Nota no encontrada' 
            });
        }

        reserva.notasDueno.splice(notaIndex, 1);
        await reserva.save();

        res.json({
            success: true,
            message: 'Nota eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error eliminando nota:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    agregarNotaDueno,
    obtenerNotasDueno,
    eliminarNotaDueno
};
