const moment = require('moment');

const Aprobaciones = require('../models/Aprobaciones');
const Reservas = require('../models/Evento');
const Clientes = require('../models/Cliente');
const Usuarios = require('../models/Usuario');
const utilidadesController = require('../controllers/utilidadesController');
const eventController = require('../controllers/eventController');

async function showApprovalsView(req, res, next) {
    try {
        const privilege = req.session.privilege;

        if (privilege !== "Administrador") {
            throw new Error("El usuario no tiene permiso para ver la pantalla de aprobaciones");
        }

        const aprobaciones = await Aprobaciones.find().sort({ createdAt: -1 }).lean();
        console.log(aprobaciones);

        for (let aprobacion of aprobaciones) {
            aprobacion.createdAt = moment(aprobacion.createdAt).format('DD/MM/YYYY');
            aprobacion.updatedAt = moment(aprobacion.updatedAt).format('DD/MM/YYYY');
            const vendedor = await Usuarios.findById(aprobacion.sellerId).lean();
            aprobacion.sellerName = vendedor.firstName + " " + vendedor.lastName;
            const cliente = await Clientes.findById(aprobacion.clientId).lean();
            aprobacion.clientName = cliente.firstName + " " + cliente.lastName;
            const reserva = await Reservas.findById(aprobacion.reservationId).lean();
            aprobacion.currentPrice = reserva.total;
            
            const currentArrivalDate = moment.utc(reserva.arrivalDate).format('DD/MM/YYYY');
            const currentDepartureDate = moment.utc(reserva.departureDate).format('DD/MM/YYYY');
            aprobacion.currentDates = currentArrivalDate + " - " + currentDepartureDate;

            const newArrivalDate = moment.utc(aprobacion.dateChanges[0].newArrivalDate).format('DD/MM/YYYY');
            const newDepartureDate = moment.utc(aprobacion.dateChanges[0].newDepartureDate).format('DD/MM/YYYY');
            aprobacion.newDates = newArrivalDate + " - " + newDepartureDate;


            
        }
        
        console.log(aprobaciones);
        res.render('aprobacionesView', {
            requests: aprobaciones
        });

    } catch (error) {
        console.log(error);
        return next(error);
    }
}

async function getRequests(req, res, next) {
    try {
        const { status, sellerId, clientId, startDate, endDate } = req.query;

        // Build filter object
        const filter = {};

        if (status && ['Pendiente', 'Aprobada', 'Rechazada'].includes(status)) {
            filter.status = status;
        }

        if (sellerId) {
            filter.sellerId = sellerId;
        }

        if (clientId) {
            filter.clientId = clientId;
        }

        // Date range filter
        if (startDate || endDate) {
            filter.createdAt = {};

            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }

            if (endDate) {
                filter.createdAt.$lte = new Date(endDate);
            }
        }

        // Get requests with filters and sort by newest first
        const requests = await Aprobaciones.find(filter)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: requests.length,
            data: requests
        });

    } catch (error) {
        console.error('Error fetching date change requests:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching date change requests',
            error: error.message
        });
    }
}

async function updateRequestStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { status, rejectionReason, approvedBy } = req.body;

        // Validate status
        if (!status || !['Aprobada', 'Rechazada'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "Aprobada" or "Rechazada"'
            });
        }

        // If rejecting, reason is required
        if (status === 'Rechazada' && !rejectionReason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        // If approving, approvedBy is required
        if (status === 'Aprobada' && !approvedBy) {
            return res.status(400).json({
                success: false,
                message: 'Approver ID is required'
            });
        }

        let filter = {};
        const aprobacion = await Aprobaciones.findById(id);
        if (!aprobacion) {
            return res.status(404).json({
                success: false,
                message: 'Aprobacion no encontrada'
            });
        }

        const params = {
            reservationId: aprobacion.reservationId,
            arrivalDate: aprobacion.dateChanges[0].newArrivalDate,
            departureDate: aprobacion.dateChanges[0].newDepartureDate,
            newPrice: aprobacion.newPrice
        };
        

        // Find and update the request
        const updateData = {
            status,
            updatedAt: Date.now()
        };

        if (status === 'Rechazada') {
            updateData.rejectionReason = rejectionReason;
        }

        if (status === 'Aprobada') {
            const editarEvento = await eventController.editarEventoBackend(params);
            if (editarEvento.isInstanceOf(Error)) {
                throw new Error(editarEvento.message);
            }

            const nuevasComisiones = await comisionController.crearComisionesBackend(params);
            if (nuevasComisiones.isInstanceOf(Error)) {
                throw new Error(nuevasComisiones.message);
            }


            updateData.approvedBy = approvedBy;
        }

        const updatedRequest = await Aprobaciones.findOneAndUpdate(
            filter,
            updateData,
            { new: true }
        );

        if (!updatedRequest) {
            return res.status(404).json({
                success: false,
                message: 'Date change request not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Request ${status === 'Aprobada' ? 'approved' : 'rejected'} successfully`,
            data: updatedRequest
        });

    } catch (error) {
        console.error('Error updating date change request:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating date change request',
            error: error.message
        });
    }
}

async function deleteRequest(req, res, next) {
    try {
        const { id } = req.params;

        // Find by requestId (CR-XXXX) or MongoDB _id
        let filter = {};
        if (mongoose.Types.ObjectId.isValid(id)) {
            filter._id = id;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
        }

        const deletedRequest = await Aprobaciones.findOneAndDelete(filter);

        if (!deletedRequest) {
            return res.status(404).json({
                success: false,
                message: 'Date change request not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Date change request deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting date change request:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting date change request',
            error: error.message
        });
    }
}
async function createRequest(req, res, next) {
    try {
        const {
            clientId,
            dateChanges,
            mainReason,
            reservationId,
            newPrice
        } = req.body;

        console.log(req.body);

        // Validate required fields
        if (!clientId || !dateChanges || !mainReason || !reservationId || !newPrice) {
            return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
        }

        // Validate dateChanges array
        if (!dateChanges.newArrivalDate || !dateChanges.newDepartureDate) {
            return res.status(400).json({
                success: false,
                message: 'Las fechas de llegada y salida son requeridas'
            });
        }

        // Validate reservationId
        const reservation = await Reservas.findById(reservationId);
        if (!reservation) {
            return res.status(400).json({ success: false, message: 'Reserva no encontrada' });
        }

        const cliente = await Clientes.findById(clientId);
        if (!cliente) {
            return res.status(400).json({ success: false, message: 'Cliente no encontrado' });
        }

        const sellerId = req.session.id;

        const seller = await Usuarios.findById(sellerId);
        if (!seller) {
            return res.status(400).json({ success: false, message: 'Vendedor no encontrado' });
        }

        // Create new request
        const newRequest = new Aprobaciones({
            sellerId,
            clientId,
            dateChanges,
            mainReason,
            newPrice,
            reservationId: reservation._id,
            status: 'Pendiente'
        });

        // Save to database
        await newRequest.save();

        res.status(201).json({
            success: true,
            message: 'Date change request created successfully',
            data: newRequest
        });

    } catch (error) {
        console.error('Error creating date change request:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}



module.exports = {
    showApprovalsView,
    updateRequestStatus,
    deleteRequest,
    createRequest,
    getRequests
}