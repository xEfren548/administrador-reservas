const express = require('express');
const moment = require('moment');
const router = express.Router();
const rackLimpiezaController = require('../controllers/rackLimpiezaController');
const RackLimpieza = require('../models/RackLimpieza');


router.get('/rackLimpieza', async (req, res) => {
    try {
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
            const serviceDate = moment.tz(service.fecha, "America/Mexico_City");
            return serviceDate.isSameOrAfter(fechaHoy) && serviceDate.isBefore(unaSemana);
        });

        // Procesar los servicios obtenidos
        services.forEach(service => {
            service._id = service._id.toString();
            service.id_reserva = service.id_reserva.toString();
            service.fecha = moment.utc(service.fecha).format('DD-MM-YYYY');
            service.fechaLlegada = service.checkIn ?  moment.utc(service.checkIn).format('DD-MM-YYYY'): "-";
            service.fechaSalida = service.checkOut ? moment.utc(service.checkOut).format('DD-MM-YYYY') : "-";
        });

        console.log(services)

        services.sort((a, b) => {
            if (a.status === "Pendiente" && b.status !== "Pendiente") return -1;
            if (a.status !== "Pendiente" && b.status === "Pendiente") return 1;
            return moment(b.fecha, 'DD-MM-YYYY') - moment(a.fecha, 'DD-MM-YYYY');
        });

        res.render('rackLimpieza', {
            services: services
        });

    } catch (error) {
        console.log(error.message);
        res.send({ error: error.message });
    }
});


router.get('/api/racklimpieza', rackLimpiezaController.getAllServices)
router.post('/api/racklimpieza', rackLimpiezaController.createService)
router.post('/api/racklimpieza/reservations', rackLimpiezaController.createServiceForReservation)
router.put('/api/racklimpieza/:id', rackLimpiezaController.modifyService);
router.delete('/api/racklimpieza/:id', rackLimpiezaController.deleteService);







module.exports = router;