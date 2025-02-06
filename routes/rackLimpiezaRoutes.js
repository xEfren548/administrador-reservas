const express = require('express');
const moment = require('moment');
const router = express.Router();
const rackLimpiezaController = require('../controllers/rackLimpiezaController');
const RackLimpieza = require('../models/RackLimpieza');
const Documento = require('../models/Evento');
const Roles = require('../models/Roles');

router.get('/rackLimpieza', async (req, res) => {
    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "VIEW_CLEANING";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para ver los servicios de limpieza");
        }
        const usuarioLogueado = req.session.userId;
        let services; 

        if (req.session.privilege === 'Limpieza'){
            services = await RackLimpieza.find({encargadoLimpieza: usuarioLogueado}).lean();
        } else {
            services = await RackLimpieza.find().lean();
        }

        const fechaHoy = moment.tz("America/Mexico_City").startOf('day')
        const unaSemana = moment.tz("America/Mexico_City").add(7, 'days').endOf('day'); // Fin del día dentro de una semana

        services = services.filter(service => {
            const serviceDate = service.checkIn ? moment.tz(service.checkIn, "America/Mexico_City") : moment.tz(service.fecha, "America/Mexico_City");
            return serviceDate.isSameOrAfter(fechaHoy) && serviceDate.isBefore(unaSemana);
        });

        // Procesar los servicios obtenidos
        const processedServices = [];
        for (const service of services) {
            service._id = service._id.toString();
            service.id_reserva = service.id_reserva.toString();
            service.fecha = moment.utc(service.fecha).format('DD-MM-YYYY');

            const reserva = await Documento.findById(service.id_reserva).lean();
            if (reserva) {
                service.fechaLlegada = moment.utc(reserva.arrivalDate).format('DD-MM-YYYY');
                service.fechaSalida = moment.utc(reserva.departureDate).format('DD-MM-YYYY');
                processedServices.push(service);
            }
        }

        processedServices.sort((a, b) => {
            if (a.status === "Pendiente" && b.status !== "Pendiente") return -1;
            if (a.status !== "Pendiente" && b.status === "Pendiente") return 1;
            return moment(a.fechaLlegada, 'DD-MM-YYYY') - moment(b.fechaLlegada, 'DD-MM-YYYY');
        });

        res.render('rackLimpieza', {
            services: processedServices,
            privilege: req.session.privilege
        });

    } catch (error) {
        console.log(error.message);
        res.send({ error: error.message });
    }
});

router.get('/racklimpieza-calendar', async (req, res) => {
    res.render('rackLimpiezaCalendar');
});


router.get('/api/racklimpieza', rackLimpiezaController.getAllServices)
router.get('/api/racklimpieza/calendardata', rackLimpiezaController.dataForRackLimpiezaCalendar)
router.post('/api/racklimpieza', rackLimpiezaController.createService)
router.post('/api/racklimpieza/reservations', rackLimpiezaController.createServiceForReservation)
router.put('/api/racklimpieza/:id', rackLimpiezaController.modifyService);
router.delete('/api/racklimpieza/:id', rackLimpiezaController.deleteService);







module.exports = router;