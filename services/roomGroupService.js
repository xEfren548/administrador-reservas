/**
 * Servicio para manejo de grupos de habitaciones
 * 
 * Este módulo proporciona funciones para:
 * - Encontrar habitaciones disponibles dentro de un grupo
 * - Seleccionar aleatoriamente una habitación del grupo
 * - Consultar disponibilidad de grupos
 */

const mongoose = require('mongoose');
const Habitacion = require('../models/Habitacion');
const Documento = require('../models/Evento');
const BloqueoFechas = require('../models/BloqueoFechas');
const BloqueoInversionistas = require('../models/BloqueoInversionistas');

/**
 * Obtiene todas las habitaciones de un grupo
 * @param {string} groupName - Nombre del grupo (ej: "Milan")
 * @returns {Promise<Array>} - Lista de habitaciones del grupo
 */
async function getRoomsInGroup(groupName) {
    return await Habitacion.find({
        roomGroup: groupName,
        isGrouped: true,
        isActive: true
    }).sort({ roomNumber: 1 });
}

/**
 * Verifica si una habitación específica está disponible en un rango de fechas
 * @param {ObjectId} roomId - ID de la habitación
 * @param {Date} arrivalDate - Fecha de llegada
 * @param {Date} departureDate - Fecha de salida
 * @returns {Promise<boolean>} - true si está disponible
 */
async function isRoomAvailable(roomId, arrivalDate, departureDate) {
    const mongooseRoomId = new mongoose.Types.ObjectId(roomId);
    
    // Ajustar fechas para la búsqueda
    const arrivalDateObj = new Date(arrivalDate);
    const departureDateObj = new Date(departureDate);
    arrivalDateObj.setUTCHours(17, 30, 0, 0);
    departureDateObj.setUTCHours(13, 0, 0, 0);
    
    const arrivalDateISO = arrivalDateObj.toISOString();
    const departureDateISO = departureDateObj.toISOString();
    
    // Verificar reservaciones existentes
    const overlappingReservation = await Documento.findOne({
        resourceId: mongooseRoomId,
        status: { $nin: ["cancelled", "no-show", "playground"] },
        $and: [
            { arrivalDate: { $lt: departureDateISO } },
            { departureDate: { $gt: arrivalDateISO } }
        ]
    });
    
    if (overlappingReservation) {
        return false;
    }
    
    // Verificar bloqueos de fechas
    const fechaAjustada = new Date(arrivalDate);
    fechaAjustada.setUTCHours(6);
    const departureDateAjustada = new Date(departureDate);
    departureDateAjustada.setUTCHours(6);
    
    let currentDate = new Date(fechaAjustada);
    currentDate.setUTCHours(17);
    
    while (currentDate <= departureDateAjustada) {
        const fechasBloqueadas = await BloqueoFechas.findOne({
            date: currentDate,
            habitacionId: mongooseRoomId,
            type: 'bloqueo'
        });
        
        if (fechasBloqueadas) {
            return false;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Verificar bloqueos de inversionistas
    const bloqueoInversionista = await BloqueoInversionistas.findOne({
        habitacionId: mongooseRoomId,
        $and: [
            { startDate: { $lte: departureDateAjustada } },
            { endDate: { $gte: fechaAjustada } }
        ]
    });
    
    if (bloqueoInversionista) {
        return false;
    }
    
    return true;
}

/**
 * Encuentra todas las habitaciones disponibles en un grupo para un rango de fechas
 * @param {string} groupName - Nombre del grupo
 * @param {Date} arrivalDate - Fecha de llegada
 * @param {Date} departureDate - Fecha de salida
 * @returns {Promise<Array>} - Lista de habitaciones disponibles
 */
async function findAvailableRoomsInGroup(groupName, arrivalDate, departureDate) {
    const roomsInGroup = await getRoomsInGroup(groupName);
    const availableRooms = [];
    
    for (const room of roomsInGroup) {
        const isAvailable = await isRoomAvailable(room._id, arrivalDate, departureDate);
        if (isAvailable) {
            availableRooms.push(room);
        }
    }
    
    return availableRooms;
}

/**
 * Selecciona aleatoriamente una habitación disponible de un grupo
 * @param {string} groupName - Nombre del grupo
 * @param {Date} arrivalDate - Fecha de llegada
 * @param {Date} departureDate - Fecha de salida
 * @returns {Promise<Object|null>} - Habitación seleccionada o null si no hay disponibles
 */
async function findAvailableRoomInGroup(groupName, arrivalDate, departureDate) {
    const availableRooms = await findAvailableRoomsInGroup(groupName, arrivalDate, departureDate);
    
    if (availableRooms.length === 0) {
        return null;
    }
    
    // Seleccionar aleatoriamente
    const randomIndex = Math.floor(Math.random() * availableRooms.length);
    return availableRooms[randomIndex];
}

/**
 * Obtiene información de disponibilidad de un grupo
 * @param {string} groupName - Nombre del grupo
 * @param {Date} arrivalDate - Fecha de llegada
 * @param {Date} departureDate - Fecha de salida
 * @returns {Promise<Object>} - Información de disponibilidad
 */
async function getGroupAvailability(groupName, arrivalDate, departureDate) {
    const roomsInGroup = await getRoomsInGroup(groupName);
    const availableRooms = await findAvailableRoomsInGroup(groupName, arrivalDate, departureDate);
    
    // Obtener información de la primera habitación del grupo (representativa)
    const representativeRoom = roomsInGroup[0];
    
    return {
        groupName: groupName,
        totalRooms: roomsInGroup.length,
        availableCount: availableRooms.length,
        isAvailable: availableRooms.length > 0,
        // Información del grupo (de la habitación representativa)
        groupInfo: representativeRoom ? {
            accomodationType: representativeRoom.propertyDetails?.accomodationType,
            maxOccupancy: representativeRoom.propertyDetails?.maxOccupancy,
            minOccupancy: representativeRoom.propertyDetails?.minOccupancy,
            images: representativeRoom.images,
            basePrice: representativeRoom.others?.basePrice,
            description: representativeRoom.accomodationDescription
        } : null,
        // Lista de habitaciones disponibles (por si se necesita mostrar cuáles)
        availableRooms: availableRooms.map(r => ({
            id: r._id,
            name: r.propertyDetails?.name,
            roomNumber: r.roomNumber
        }))
    };
}

/**
 * Obtiene todos los grupos de habitaciones activos
 * @returns {Promise<Array>} - Lista de grupos con sus habitaciones
 */
async function getAllGroups() {
    const groups = await Habitacion.aggregate([
        { $match: { isGrouped: true, isActive: true } },
        {
            $group: {
                _id: '$roomGroup',
                totalRooms: { $sum: 1 },
                rooms: {
                    $push: {
                        _id: '$_id',
                        name: '$propertyDetails.name',
                        roomNumber: '$roomNumber',
                        propertyDetails: '$propertyDetails'
                    }
                },
                // Tomar datos de la primera habitación como representativa
                representativeRoom: { $first: '$$ROOT' }
            }
        },
        { $sort: { _id: 1 } }
    ]);
    
    return groups.map(group => ({
        groupName: group._id,
        totalRooms: group.totalRooms,
        rooms: group.rooms.sort((a, b) => a.roomNumber - b.roomNumber),
        groupInfo: {
            accomodationType: group.representativeRoom.propertyDetails?.accomodationType,
            maxOccupancy: group.representativeRoom.propertyDetails?.maxOccupancy,
            minOccupancy: group.representativeRoom.propertyDetails?.minOccupancy,
            images: group.representativeRoom.images,
            basePrice: group.representativeRoom.others?.basePrice
        }
    }));
}

/**
 * Verifica si un nombre de habitación corresponde a un grupo
 * @param {string} roomIdentifier - Nombre de habitación o nombre de grupo
 * @returns {Promise<Object>} - { isGroup: boolean, groupName?: string, room?: Object }
 */
async function resolveRoomOrGroup(roomIdentifier) {
    // Primero buscar como habitación individual
    const room = await Habitacion.findOne({ 'propertyDetails.name': roomIdentifier });
    
    if (room) {
        // Si la habitación está agrupada, devolver info del grupo
        if (room.isGrouped) {
            return {
                isGroup: true,
                groupName: room.roomGroup,
                room: room
            };
        }
        // Habitación individual no agrupada
        return {
            isGroup: false,
            room: room
        };
    }
    
    // Buscar como nombre de grupo
    const groupRoom = await Habitacion.findOne({ roomGroup: roomIdentifier, isGrouped: true });
    
    if (groupRoom) {
        return {
            isGroup: true,
            groupName: roomIdentifier,
            room: null
        };
    }
    
    // No se encontró ni habitación ni grupo
    return {
        isGroup: false,
        room: null
    };
}

/**
 * Obtiene disponibilidad de múltiples grupos para un rango de fechas
 * @param {Date} arrivalDate - Fecha de llegada
 * @param {Date} departureDate - Fecha de salida
 * @returns {Promise<Array>} - Lista de grupos con su disponibilidad
 */
async function getAllGroupsAvailability(arrivalDate, departureDate) {
    const groups = await getAllGroups();
    const availability = [];
    
    for (const group of groups) {
        const groupAvailability = await getGroupAvailability(
            group.groupName,
            arrivalDate,
            departureDate
        );
        availability.push(groupAvailability);
    }
    
    return availability;
}

module.exports = {
    getRoomsInGroup,
    isRoomAvailable,
    findAvailableRoomsInGroup,
    findAvailableRoomInGroup,
    getGroupAvailability,
    getAllGroups,
    resolveRoomOrGroup,
    getAllGroupsAvailability
};
