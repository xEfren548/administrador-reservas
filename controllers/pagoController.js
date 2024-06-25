const mongoose = require('mongoose');
const Pago = require('../models/Pago');
const logController = require('../controllers/logController');
const utilidadesController = require('../controllers/utilidadesController');

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

        const pago = new Pago({
            fechaPago: new Date(fechaPago),
            importe,
            metodoPago,
            codigoOperacion,
            reservacionId: reservacionId.toString(),
            notas
        });
        await pago.save();

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
        res.status(500).json({ mensaje: 'Hubo un error al registrar el pago.' });
    }
}

async function editarPago(req, res) {
    try {
        const { id } = req.params;
        const { fechaPago, importe, metodoPago, codigoOperacion, reservacionId, notas } = req.body;

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