const mongoose = require('mongoose');
const Pago = require('../models/Pago');

async function obtenerPagos(idReservacion) {
    try {
        const pagos = await Pago.find({ reservacionId: idReservacion }).lean();
        return pagos;
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
            reservacionId: reservacionId.toString(),
            notas
        });
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
        res.status(200).json({ mensaje: 'Pago eliminado correctamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ mensaje: 'Hubo un error al eliminar el pago.' });
    }
}



module.exports = {
    obtenerPagos,
    registrarPago,
    editarPago,
    eliminarPago,

}