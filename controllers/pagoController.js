const mongoose = require('mongoose');
const Pago = require('../models/Pago');
const logController = require('../controllers/logController');
const utilidadesController = require('../controllers/utilidadesController');
const Utilidades = require('../models/Utilidades');
const Habitacion = require('../models/Habitacion');
const Documento = require('../models/Evento');
const moment = require('moment');

async function obtenerPagos(idReservacion) {
    try {
        const pagos = await Pago.find({ reservacionId: idReservacion }).lean();
        return pagos;
    } catch (error) {
        console.log(error.message);
    }
}

async function obtenerPagoPorId(req, res) {
    try {
        const { id } = req.params;
        const pago = await Pago.findById(id);
        res.send(pago);
    } catch (error) {
        console.log(error.message);
    }
}

async function registrarPago(req, res) {
    try {
        const { fechaPago, importe, metodoPago, codigoOperacion, reservacionId, notas } = req.body;

        if (req.session.privilege !== "Administrador") {
            return res.status(403).json({ mensaje: 'No tienes permiso para registrar un pago.' });
        }

        // const allReservations = await Documento.findOne();
        // const reservacion = allReservations.events.find(event => event._id.toString() === reservacionId);
        const reservacion = await Documento.findById(reservacionId).lean();

        const chaletId = reservacion.resourceId;

        // const allChalets = await Habitacion.findOne();
        // const chalet = allChalets.resources.find(chalet => chalet._id.toString() === chaletId.toString());
        const chalet = await Habitacion.findById(chaletId).lean();
        const chaletOwner = chalet.others.owner;

        console.log("chalet id: ", chaletId);
        const pago = new Pago({
            fechaPago: new Date(fechaPago),
            importe,
            metodoPago,
            codigoOperacion,
            reservacionId: reservacionId.toString(),
            notas
        });
        await pago.save();

        if (metodoPago === "Recibio dueño"){
            await altaComisionReturnC({
                monto: -importe ,
                concepto: `Comisión negativa por Recepción de pago ${chalet.propertyDetails.name}`,
                fecha: new Date(fechaPago),
                idUsuario: chaletOwner,
                idReserva: reservacionId
            })
        }

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: reservacionId,
            acciones: `Pago registrado por ${req.session.firstName} ${req.session.lastName}.IdReserva: ${reservacionId}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }
        
        await logController.createBackendLog(logBody);
        res.status(201).json({ mensaje: 'Pago registrado correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: error.message });
    }
}

async function editarPago(req, res) {
    try {
        const { id } = req.params;
        const { fechaPago, importe, metodoPago, codigoOperacion, reservacionId, notas } = req.body;

        if (req.session.privilege !== "Administrador") {
            return res.status(403).json({ mensaje: 'No tienes permiso para editar un pago.' });
        }

        const pagoActual = await Pago.findById(id);
        if (!pagoActual) {
            return res.status(404).json({ mensaje: 'Pago no encontrado.' });
        }

        // if (pagoActual.metodoPago === "Recibio dueño" && metodoPago !== "Recibio dueño") {

        // }

        if (pagoActual.metodoPago === "Recibio dueño" && metodoPago === "Recibio dueño") {
            if (!mongoose.Types.ObjectId.isValid(reservacionId)) {
                console.error("Invalid reservacionId:", reservacionId);
                return res.status(400).json({ mensaje: "ID de reservación no válido." });
            }
            console.log("reservacionId: ", reservacionId)
            console.log("monto: ",-pagoActual.importe)

            const utilidadDelPago = await Utilidades.findOne({ idReserva: new mongoose.Types.ObjectId(reservacionId), monto: -pagoActual.importe });
            console.log("utilidad del pago: ", utilidadDelPago)

            if (utilidadDelPago) {
                const utilidadEliminada = await Utilidades.findOneAndDelete({ idReserva: reservacionId, monto: -pagoActual.importe });
                console.log("utilidad eliminada: ")
                console.log(utilidadEliminada)
                if (!utilidadEliminada) {
                    return res.status(500).json({ mensaje: 'Hubo un error al eliminar la utilidad.' });
                }

                await altaComisionReturnC({
                    monto: -importe,
                    concepto: `Comisión negativa por Recepción de pago`,
                    fecha: new Date(fechaPago),
                    idUsuario: utilidadEliminada.idUsuario,
                    idReserva: reservacionId
                })
            }

        }

        if (pagoActual.metodoPago === "Recibio dueño" && metodoPago !== "Recibio dueño") {
            const utilidadDelPago = await Utilidades.findOne({ idReserva: reservacionId, monto: -pagoActual.importe });
            if (!mongoose.Types.ObjectId.isValid(reservacionId)) {
                console.error("Invalid reservacionId:", reservacionId);
                return res.status(400).json({ mensaje: "ID de reservación no válido." });
            }

            if (utilidadDelPago) {
                const utilidadEliminada = await Utilidades.findOneAndDelete({ idReserva: reservacionId, monto: -pagoActual.importe });
                console.log("utilidad eliminada: ")
                console.log(utilidadEliminada)

                if (!utilidadEliminada) {
                    return res.status(500).json({ mensaje: 'Hubo un error al eliminar la utilidad.' });
                }
            }

        }

        const pago = await Pago.findByIdAndUpdate(id, {
            fechaPago: new Date(fechaPago),
            importe,
            metodoPago,
            codigoOperacion,
            notas
        });
        console.log(pago)
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: reservacionId,
            acciones: `Pago editado por ${req.session.firstName} ${req.session.lastName}.IdReserva: ${reservacionId}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }
        
        await logController.createBackendLog(logBody);
        res.status(200).json({ mensaje: 'Pago editado correctamente.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ mensaje: 'Hubo un error al editar el pago: ' + e.message + '.' });

    }
}

async function eliminarPago(req, res) {
    try {
        const { id } = req.params;

        if (req.session.privilege !== "Administrador") {
            return res.status(403).json({ mensaje: 'No tienes permiso para eliminar un pago.' });
        }

        const pagoActual = await Pago.findById(id);
        if (!pagoActual) {
            return res.status(404).json({ mensaje: 'Pago no encontrado.' });
        }

        const reservacionId = pagoActual.reservacionId;

        if (pagoActual.metodoPago === "Recibio dueño") {
            if (!mongoose.Types.ObjectId.isValid(reservacionId)) {
                console.error("Invalid reservacionId:", reservacionId);
                return res.status(400).json({ mensaje: "ID de reservación no válido." });
            }
            console.log("reservacionId: ", reservacionId)
            console.log("monto: ",-pagoActual.importe)

            const utilidadDelPago = await Utilidades.findOne({ idReserva: new mongoose.Types.ObjectId(reservacionId), monto: -pagoActual.importe });
            console.log("utilidad del pago: ", utilidadDelPago)

            if (utilidadDelPago) {
                const utilidadEliminada = await Utilidades.findOneAndDelete({ idReserva: reservacionId, monto: -pagoActual.importe });
                console.log("utilidad eliminada: ")
                console.log(utilidadEliminada)
                if (!utilidadEliminada) {
                    return res.status(500).json({ mensaje: 'Hubo un error al eliminar la utilidad.' });
                }
            }

        }
        
        await Pago.findByIdAndDelete(id);

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'elimination',
            acciones: `Pago eliminado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }
        
        await logController.createBackendLog(logBody);
        res.status(200).json({ mensaje: 'Pago eliminado correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ mensaje: 'Hubo un error al eliminar el pago.' });
    }
}

async function liquidarReservaDueno(req, res, next){
    try {
        const { fechaPago, importe, metodoPago, codigoOperacion, reservacionId, notas } = req.body;

        if (req.session.privilege !== "Administrador" && req.session.privilege !== "Dueño de cabañas") {
            return res.status(403).json({ mensaje: 'No tienes permiso para liquidar un pago.' });
        }

        // const reservas = await Documento.find().lean();
        // const reservacion = reservas[0].events.find(event => event._id.toString() === reservacionId.toString());

        const reservacion = await Documento.findById(reservacionId).lean();

        if (!reservacion) {
            return res.status(404).json({ mensaje: 'Reservación no encontrada.' });
        }

        if (reservacion.status === "no-show" || reservacion.status === "cancelled") {
            return res.status(400).json({ mensaje: 'La reservación ya ha sido liquidada.' });
        }

        const pago = new Pago({
            fechaPago: new Date(fechaPago),
            importe,
            metodoPago,
            codigoOperacion,
            reservacionId: reservacionId.toString(),
            notas
        });
        const pagoConfirmation = await pago.save();

        if (!pagoConfirmation){
            return res.status(500).json({ mensaje: 'Hubo un error al registrar el pago en su confirmación' });
        }
        
        await altaComisionReturnC({
            monto: -importe,
            concepto: "Comisión negativa por liquidación de cabaña en efectivo",
            fecha: fechaPago,
            idUsuario: req.session.id,
            idReserva: reservacionId
        })

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            acciones: `Liquidación realizada por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`,
            idReserva: reservacionId
        }
        
        await logController.createBackendLog(logBody);

        res.status(200).send({success: true})

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ mensaje: error.message });
    }
}

async function altaComisionReturnC(req, res) {
    try {
        const { monto, concepto, fecha, idUsuario, idReserva, idServicio } = req

        if (monto !== null) {

            const newUtilidad = new Utilidades({
                monto,
                concepto,
                fecha,
                idUsuario,
                idReserva,
                idServicio
            })
            const savedUtilidad = await newUtilidad.save()
            if (savedUtilidad) {
                console.log("Utility created successfully.")
            } else {
                console.log("'Failed to create utility.'")
            }
        }
    } catch (error) {
        console.log(error.message);
        // res.status(200).send('Something went wrong while creating utility.');
    }
}

async function renderPagos(req, res) {
    try {
        const pagos = await Pago.find().lean();
        const habitacionesExistentes = await Habitacion.find().lean();
        const reservasExistentes = await Documento.find().lean();
        const reservas = reservasExistentes


        const nombreCabañas = habitacionesExistentes.map(habitacion => ({
            id: habitacion._id.toString(),
            name: habitacion.propertyDetails?.name || 'Nombre no disponible', // Validar y asignar un valor predeterminado
        }));
        // console.log(pagos)
        const pagosFormateados = pagos.map(pago => {
            const reserva = reservas.find(reserva => reserva._id.toString() === pago.reservacionId?.toString());
            const cabaña = reserva 
            ? nombreCabañas.find(cabaña => cabaña.id === reserva.resourceId?.toString())
            : null;
            
            return{
                ...pago,
                fecha: moment.utc(pago.fechaPago).format('DD/MM/YYYY'),
                chalet: cabaña ? cabaña.name : 'N/A',
                
            }
            
        })
        // console.log(pagosFormateados)
        pagosFormateados.sort((a, b) => moment(b.fechaPago, 'DD-MM-YYYY').valueOf() - moment(a.fechaPago, 'DD-MM-YYYY').valueOf());
        res.render('vistaPagos', { pagos: pagosFormateados });
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
}

module.exports = {
    obtenerPagos,
    obtenerPagoPorId,
    registrarPago,
    editarPago,
    eliminarPago,
    liquidarReservaDueno,
    renderPagos
}