const Aprobaciones = require('../models/Aprobaciones');

async function showApprovalsView(req, res, next) {
    try {
        const privilege = req.session.privilege;

        if (privilege !== "Administrador") {
            throw new Error("El usuario no tiene permiso para ver la pantalla de aprobaciones");
        }

        res.render('aprobacionesView');

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

        // Find by requestId (CR-XXXX) or MongoDB _id
        let filter = {};
        if (id.startsWith('CR-')) {
            filter.requestId = id;
        } else if (mongoose.Types.ObjectId.isValid(id)) {
            filter._id = id;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
        }

        // Find and update the request
        const updateData = {
            status,
            updatedAt: Date.now()
        };

        if (status === 'Rechazada') {
            updateData.rejectionReason = rejectionReason;
        }

        if (status === 'Aprobada') {
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
            sellerId,
            sellerName,
            clientId,
            clientName,
            dateChanges,
            mainReason
        } = req.body;

        // Validate required fields
        if (!sellerId || !sellerName || !clientId || !clientName || !dateChanges || !mainReason) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Validate dateChanges array
        if (!Array.isArray(dateChanges) || dateChanges.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'dateChanges must be an array with at least one date change'
            });
        }

        // Validate each date change entry
        for (const dateChange of dateChanges) {
            if (!dateChange.originalDate || !dateChange.newDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Each date change must have originalDate and newDate'
                });
            }

            // Convert string dates to Date objects
            dateChange.originalDate = new Date(dateChange.originalDate);
            dateChange.newDate = new Date(dateChange.newDate);

            // Validate dates
            if (isNaN(dateChange.originalDate) || isNaN(dateChange.newDate)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format'
                });
            }
        }

        // Create new request
        const newRequest = new Aprobaciones({
            sellerId,
            sellerName,
            clientId,
            clientName,
            dateChanges,
            mainReason,
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
            message: 'Error creating date change request',
            error: error.message
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