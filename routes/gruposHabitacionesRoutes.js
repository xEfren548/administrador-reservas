const express = require('express');
const router = express.Router();
const gruposHabitacionesController = require('../controllers/gruposHabitacionesController');

// View route
router.get('/grupos-habitaciones', gruposHabitacionesController.renderGruposHabitacionesView);

// ==========================================
// API CRUD Routes
// ==========================================
router.get('/api/grupos-habitaciones', gruposHabitacionesController.getGrupos);
router.post('/api/grupos-habitaciones', gruposHabitacionesController.createGrupo);
router.put('/api/grupos-habitaciones/:groupName', gruposHabitacionesController.updateGrupo);
router.delete('/api/grupos-habitaciones/:groupName', gruposHabitacionesController.deleteGrupo);
router.post('/api/grupos-habitaciones/add-room', gruposHabitacionesController.addRoomToGroup);
router.delete('/api/grupos-habitaciones/room/:habitacionId', gruposHabitacionesController.removeRoomFromGroup);

// ==========================================
// API Availability Routes (for app)
// ==========================================
router.get('/api/grupos-habitaciones/availability/all', gruposHabitacionesController.getAllGroupsAvailability);
router.get('/api/grupos-habitaciones/resolve/:identifier', gruposHabitacionesController.resolveIdentifier);
router.get('/api/grupos-habitaciones/:groupName/details', gruposHabitacionesController.getGrupoByName);
router.get('/api/grupos-habitaciones/:groupName/availability', gruposHabitacionesController.getGrupoAvailability);
router.post('/api/grupos-habitaciones/:groupName/find-available', gruposHabitacionesController.findAvailableRoom);

module.exports = router;
