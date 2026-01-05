const Documento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const Utilidades = require('../models/Utilidades');
const mongoose = require('mongoose');
const moment = require('moment');

/**
 * Obtiene resumen de cartera del dueño
 */
async function obtenerCarteraDueno(req, res) {
    try {
        const duenoId = req.session.id;
        const { fechaInicio, fechaFin } = req.query;

        // Obtener habitaciones del dueño
        const habitaciones = await Habitacion.find({ 'others.owner': duenoId }).lean().sort({ 'propertyDetails.name': 1 });
        const habitacionIds = habitaciones.map(h => h._id);

        if (habitacionIds.length === 0) {
            return res.json({
                success: true,
                data: {
                    totalExternas: 0,
                    desglose: []
                }
            });
        }

        // Filtro de fechas
        const filtroFechas = {};
        if (fechaInicio && fechaFin) {
            filtroFechas.departureDate = {
                $gte: new Date(fechaInicio),
                $lte: new Date(fechaFin)
            };
        }

        // Ganancias de reservas externas
        const reservasExternas = await Documento.aggregate([
            {
                $match: {
                    resourceId: { $in: habitacionIds },
                    tipoReserva: 'reserva-externa',
                    'infoReservaExterna.estadoPago': { $in: ['Pagado', 'Parcial'] },
                    ...filtroFechas
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$infoReservaExterna.gananciaNetaDueno' }
                }
            }
        ]);

        const totalExternas = reservasExternas[0]?.total || 0;

        // Desglose detallado (solo externas)
        const desglose = await obtenerDesgloseDueno(duenoId, habitacionIds, fechaInicio, fechaFin);

        res.json({
            success: true,
            data: {
                totalExternas,
                desglose
            }
        });

    } catch (error) {
        console.error('Error obteniendo cartera:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Obtiene desglose detallado de ganancias (solo externas)
 */
async function obtenerDesgloseDueno(duenoId, habitacionIds, fechaInicio, fechaFin) {
    const filtroFechas = fechaInicio && fechaFin ? {
        departureDate: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin)
        }
    } : {};

    // Solo Reservas Externas
    const reservasExternas = await Documento.find({
        resourceId: { $in: habitacionIds },
        tipoReserva: 'reserva-externa',
        'infoReservaExterna.estadoPago': { $in: ['Pagado', 'Parcial'] },
        ...filtroFechas
    })
    .populate('resourceId', 'propertyDetails.name')
    .lean();

    const detalleExternas = reservasExternas.map(reserva => ({
        tipo: 'Reserva Externa',
        reservaId: reserva._id,
        habitacion: reserva.resourceId?.propertyDetails?.name || 'N/A',
        fechaLlegada: moment(reserva.arrivalDate).format('DD/MM/YYYY'),
        fechaSalida: moment(reserva.departureDate).format('DD/MM/YYYY'),
        noches: reserva.nNights,
        plataforma: reserva.infoReservaExterna?.plataforma || 'N/A',
        precioTotal: reserva.infoReservaExterna?.precioExternoTotal || 0,
        comisionPlataforma: reserva.infoReservaExterna?.comisionPlataforma || 0,
        monto: reserva.infoReservaExterna?.gananciaNetaDueno || 0,
        concepto: `Ganancia ${reserva.infoReservaExterna?.plataforma || 'externa'}`
    }));

    return detalleExternas.sort((a, b) => 
        new Date(b.fechaSalida.split('/').reverse().join('-')) - 
        new Date(a.fechaSalida.split('/').reverse().join('-'))
    );
}

/**
 * Exportar cartera a Excel (envía datos estructurados)
 */
async function exportarCarteraExcel(req, res) {
    try {
        const duenoId = req.session.id;
        const { fechaInicio, fechaFin } = req.query;

        const habitaciones = await Habitacion.find({ 'others.owner': duenoId }).lean();
        const habitacionIds = habitaciones.map(h => h._id);

        const desglose = await obtenerDesgloseDueno(duenoId, habitacionIds, fechaInicio, fechaFin);

        // Calcular total de externas
        const totalExternas = desglose.reduce((sum, d) => sum + d.monto, 0);

        res.json({
            success: true,
            data: {
                periodo: {
                    inicio: fechaInicio ? moment(fechaInicio).format('DD/MM/YYYY') : 'Inicio',
                    fin: fechaFin ? moment(fechaFin).format('DD/MM/YYYY') : 'Actual'
                },
                desglose,
                resumen: {
                    totalExternas
                }
            }
        });

    } catch (error) {
        console.error('Error exportando cartera:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    obtenerCarteraDueno,
    obtenerDesgloseDueno,
    exportarCarteraExcel
};
