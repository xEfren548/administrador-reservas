const mongoose = require('mongoose');
const Pago = require('../models/Pago');
const logController = require('../controllers/logController');
const utilidadesController = require('../controllers/utilidadesController');
const Utilidades = require('../models/Utilidades');
const Habitacion = require('../models/Habitacion');
const Documento = require('../models/Evento');

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

        const allReservations = await Documento.findOne();
        const reservacion = allReservations.events.find(event => event._id.toString() === reservacionId);

        const chaletId = reservacion.resourceId;

        const allChalets = await Habitacion.findOne();
        const chalet = allChalets.resources.find(chalet => chalet._id.toString() === chaletId.toString());
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
            await utilidadesController.altaComisionReturn({
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

                await utilidadesController.altaComisionReturn({
                    monto: pagoActual.monto,
                    concepto: `Comisión negativa por Recepción de pago ${pagoActual.reservacionId}`,
                    fecha: new Date(fechaPago),
                    idUsuario: utilidadEliminada.idUsuario,
                    idReserva: reservacionId
                })
            }

        }

        if (pagoActual.metodoPago === "Recibio dueño" && metodoPago !== "Recibio dueño") {
            const utilidadDelPago = await Utilidades.findOne({ idReserva: reservacionId, monto: -pagoActual.importe });

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
        res.status(500).json({ mensaje: 'Hubo un error al editar el pago.' });

    }
}

async function eliminarPago(req, res) {
    try {
        const { id } = req.params;

        if (req.session.privilege !== "Administrador") {
            return res.status(403).json({ mensaje: 'No tienes permiso para eliminar un pago.' });
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

        if (req.session.privilege !== "Administrador") {
            return res.status(403).json({ mensaje: 'No tienes permiso para registrar un pago.' });
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
            res.status(500).json({ mensaje: 'Hubo un error al registrar el pago.' });
        }

        const utilidad = {
            monto: -importe,
            concepto: "Comisión negativa por liquidación de cabaña en efectivo",
            fecha: fechaPago,
            idUsuario: req.session.id,
            idReserva: reservacionId
        }
        
        await utilidadesController.altaComisionReturn(utilidad)

        res.status(200).send({success: true})

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ mensaje: 'Hubo un error al registrar el pago.' });
    }
}


module.exports = {
    obtenerPagos,
    obtenerPagoPorId,
    registrarPago,
    editarPago,
    eliminarPago,
    liquidarReservaDueno

}