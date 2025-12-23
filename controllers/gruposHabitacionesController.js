const Habitacion = require('../models/Habitacion');
const roomGroupService = require('../services/roomGroupService');

/**
 * Render the room groups management view
 * No data is passed - everything is loaded via API
 */
async function renderGruposHabitacionesView(req, res, next) {
    try {
        res.render('gruposHabitacionesView');
    } catch (error) {
        console.error('Error rendering grupos habitaciones view:', error);
        next(error);
    }
}

/**
 * Get all room groups with their rooms
 */
async function getGrupos(req, res, next) {
    try {
        const grupos = await roomGroupService.getAllGroups();
        res.json(grupos);
    } catch (error) {
        console.error('Error getting grupos:', error);
        res.status(500).json({ message: 'Error al obtener grupos' });
    }
}

/**
 * Create a new room group
 */
async function createGrupo(req, res, next) {
    try {
        const { groupName, habitacionIds } = req.body;

        if (!groupName || !habitacionIds || habitacionIds.length < 2) {
            return res.status(400).json({ 
                message: 'Se requiere nombre del grupo y al menos 2 habitaciones' 
            });
        }

        // Check if group name already exists
        const existingGroup = await Habitacion.findOne({ roomGroup: groupName });
        if (existingGroup) {
            return res.status(400).json({ 
                message: 'Ya existe un grupo con ese nombre' 
            });
        }

        // Update each habitacion with the group info
        for (let i = 0; i < habitacionIds.length; i++) {
            await Habitacion.findByIdAndUpdate(habitacionIds[i], {
                roomGroup: groupName,
                roomNumber: i + 1,
                isGrouped: true
            });
        }

        res.status(200).json({ message: 'Grupo creado exitosamente' });
    } catch (error) {
        console.error('Error creating grupo:', error);
        res.status(500).json({ message: 'Error al crear el grupo' });
    }
}

/**
 * Add a room to an existing group
 */
async function addRoomToGroup(req, res, next) {
    try {
        const { groupName, habitacionId } = req.body;

        if (!groupName || !habitacionId) {
            return res.status(400).json({ 
                message: 'Se requiere nombre del grupo y ID de habitación' 
            });
        }

        // Get the current max room number in the group
        const maxRoom = await Habitacion.findOne({ roomGroup: groupName })
            .sort({ roomNumber: -1 })
            .lean();
        
        const nextRoomNumber = maxRoom ? (maxRoom.roomNumber || 0) + 1 : 1;

        await Habitacion.findByIdAndUpdate(habitacionId, {
            roomGroup: groupName,
            roomNumber: nextRoomNumber,
            isGrouped: true
        });

        res.status(200).json({ message: 'Habitación agregada al grupo' });
    } catch (error) {
        console.error('Error adding room to group:', error);
        res.status(500).json({ message: 'Error al agregar habitación al grupo' });
    }
}

/**
 * Remove a room from its group
 */
async function removeRoomFromGroup(req, res, next) {
    try {
        const { habitacionId } = req.params;

        // Validate habitacionId
        if (!habitacionId || habitacionId === 'undefined') {
            return res.status(400).json({ message: 'ID de habitación no válido' });
        }

        // Get the room to find its group
        const room = await Habitacion.findById(habitacionId);
        if (!room) {
            return res.status(404).json({ message: 'Habitación no encontrada' });
        }

        if (!room.roomGroup) {
            return res.status(400).json({ message: 'La habitación no pertenece a ningún grupo' });
        }

        // Check how many rooms are in the group
        const roomsInGroup = await Habitacion.countDocuments({ roomGroup: room.roomGroup });
        
        if (roomsInGroup <= 2) {
            return res.status(400).json({ 
                message: 'No se puede quitar la habitación. Un grupo debe tener al menos 2 habitaciones. Si deseas eliminar el grupo completo, usa la opción de eliminar grupo.' 
            });
        }

        // Remove room from group
        await Habitacion.findByIdAndUpdate(habitacionId, {
            roomGroup: null,
            roomNumber: null,
            isGrouped: false
        });

        res.status(200).json({ message: 'Habitación removida del grupo' });
    } catch (error) {
        console.error('Error removing room from group:', error);
        res.status(500).json({ message: 'Error al remover habitación del grupo' });
    }
}

/**
 * Delete an entire group (ungroup all rooms)
 */
async function deleteGrupo(req, res, next) {
    try {
        const { groupName } = req.params;

        const result = await Habitacion.updateMany(
            { roomGroup: groupName },
            {
                roomGroup: null,
                roomNumber: null,
                isGrouped: false
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'Grupo no encontrado' });
        }

        res.status(200).json({ message: 'Grupo eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting grupo:', error);
        res.status(500).json({ message: 'Error al eliminar el grupo' });
    }
}

/**
 * Update group name
 */
async function updateGrupo(req, res, next) {
    try {
        const { groupName } = req.params;
        const { newGroupName } = req.body;

        if (!newGroupName) {
            return res.status(400).json({ message: 'Se requiere el nuevo nombre del grupo' });
        }

        // Check if new name already exists
        const existingGroup = await Habitacion.findOne({ roomGroup: newGroupName });
        if (existingGroup) {
            return res.status(400).json({ message: 'Ya existe un grupo con ese nombre' });
        }

        const result = await Habitacion.updateMany(
            { roomGroup: groupName },
            { roomGroup: newGroupName }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'Grupo no encontrado' });
        }

        res.status(200).json({ message: 'Grupo actualizado exitosamente' });
    } catch (error) {
        console.error('Error updating grupo:', error);
        res.status(500).json({ message: 'Error al actualizar el grupo' });
    }
}

// ==========================================
// ENDPOINTS DE DISPONIBILIDAD (para app)
// ==========================================

/**
 * Get a specific group info
 */
async function getGrupoByName(req, res, next) {
    try {
        const { groupName } = req.params;
        const rooms = await roomGroupService.getRoomsInGroup(groupName);
        
        if (rooms.length === 0) {
            return res.status(404).json({ message: `Grupo "${groupName}" no encontrado` });
        }
        
        res.json({
            groupName,
            totalRooms: rooms.length,
            rooms: rooms.map(r => ({
                _id: r._id,
                name: r.propertyDetails?.name,
                roomNumber: r.roomNumber,
                isActive: r.isActive
            }))
        });
    } catch (error) {
        console.error('Error getting grupo:', error);
        res.status(500).json({ message: 'Error al obtener grupo' });
    }
}

/**
 * Get availability for a specific group
 */
async function getGrupoAvailability(req, res, next) {
    try {
        const { groupName } = req.params;
        const { arrivalDate, departureDate } = req.query;
        
        if (!arrivalDate || !departureDate) {
            return res.status(400).json({ message: 'Se requieren arrivalDate y departureDate' });
        }
        
        const availability = await roomGroupService.getGroupAvailability(
            groupName,
            new Date(arrivalDate),
            new Date(departureDate)
        );
        
        res.json(availability);
    } catch (error) {
        console.error('Error getting availability:', error);
        res.status(500).json({ message: 'Error al consultar disponibilidad' });
    }
}

/**
 * Get availability for ALL groups
 */
async function getAllGroupsAvailability(req, res, next) {
    try {
        const { arrivalDate, departureDate } = req.query;
        
        if (!arrivalDate || !departureDate) {
            return res.status(400).json({ message: 'Se requieren arrivalDate y departureDate' });
        }
        
        const availability = await roomGroupService.getAllGroupsAvailability(
            new Date(arrivalDate),
            new Date(departureDate)
        );
        
        res.json(availability);
    } catch (error) {
        console.error('Error getting all groups availability:', error);
        res.status(500).json({ message: 'Error al consultar disponibilidad de grupos' });
    }
}

/**
 * Find an available room in a group (random selection)
 */
async function findAvailableRoom(req, res, next) {
    try {
        const { groupName } = req.params;
        const { arrivalDate, departureDate } = req.body;
        
        if (!arrivalDate || !departureDate) {
            return res.status(400).json({ message: 'Se requieren arrivalDate y departureDate' });
        }
        
        const availableRoom = await roomGroupService.findAvailableRoomInGroup(
            groupName,
            new Date(arrivalDate),
            new Date(departureDate)
        );
        
        if (!availableRoom) {
            return res.status(404).json({ 
                message: `No hay habitaciones disponibles en el grupo "${groupName}" para las fechas seleccionadas` 
            });
        }
        
        res.json({
            _id: availableRoom._id,
            name: availableRoom.propertyDetails?.name,
            roomNumber: availableRoom.roomNumber,
            groupName: groupName,
            maxOccupancy: availableRoom.propertyDetails?.maxOccupancy,
            basePrice: availableRoom.others?.basePrice
        });
    } catch (error) {
        console.error('Error finding available room:', error);
        res.status(500).json({ message: 'Error al buscar habitación disponible' });
    }
}

/**
 * Resolve if an identifier is a room or a group
 */
async function resolveIdentifier(req, res, next) {
    try {
        const { identifier } = req.params;
        const result = await roomGroupService.resolveRoomOrGroup(identifier);
        
        res.json({
            identifier,
            isGroup: result.isGroup,
            groupName: result.groupName || null,
            room: result.room ? {
                _id: result.room._id,
                name: result.room.propertyDetails?.name,
                isGrouped: result.room.isGrouped,
                roomGroup: result.room.roomGroup,
                roomNumber: result.room.roomNumber
            } : null
        });
    } catch (error) {
        console.error('Error resolving identifier:', error);
        res.status(500).json({ message: 'Error al resolver identificador' });
    }
}

module.exports = {
    renderGruposHabitacionesView,
    getGrupos,
    createGrupo,
    addRoomToGroup,
    removeRoomFromGroup,
    deleteGrupo,
    updateGrupo,
    // Availability endpoints
    getGrupoByName,
    getGrupoAvailability,
    getAllGroupsAvailability,
    findAvailableRoom,
    resolveIdentifier
};