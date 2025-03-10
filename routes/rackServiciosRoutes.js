const express = require('express');
const moment = require('moment');
const router = express.Router();
const rackServiciosController = require('../controllers/rackServiciosController');
const Roles = require('../models/Roles')


router.get('/rackservicios', async (req, res) => {
    try {

        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "VIEW_RACK_SERVICES";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para ver los servicios");
        }

        let services = await rackServiciosController.getAllRackServicesMongo(req, res); // Pass req and res to the controller function
        services.forEach(service => {
            service._id = service._id.toString();
            service.id_reserva = service.id_reserva.toString();
            service.fecha = moment.utc(service.fecha).format('DD-MM-YYYY');
        });

        const fechaHoy = moment.tz("America/Mexico_City").startOf('day')
        const unaSemana = moment.tz("America/Mexico_City").add(7, 'days').endOf('day'); // Fin del día dentro de una semana

        services = services.filter(service => {
            const serviceDate = moment.tz(service.fecha, "America/Mexico_City");
            return serviceDate.isSameOrAfter(fechaHoy) && serviceDate.isBefore(unaSemana);
        });


        services.sort((a, b) => {
            if (a.status === "Pendiente" && b.status !== "Pendiente") return -1;
            if (a.status !== "Pendiente" && b.status === "Pendiente") return 1;
            return moment(b.fecha, 'DD-MM-YYYY') - moment(a.fecha, 'DD-MM-YYYY');
        });



        res.render('rackServicios', {
            services: services
        });

    } catch (error) {
        console.log(error.message);
        res.send({ error: error.message });
    }
});

router.get('/api/rackservicios', rackServiciosController.getAllRackServices)
router.post('/api/rackservicios', rackServiciosController.createRackService)
router.put('/api/rackservicios/:id', rackServiciosController.modifyRackService);
router.delete('/api/rackservicios/:id', rackServiciosController.deleteRackService);

module.exports = router;