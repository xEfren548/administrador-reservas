const Service = require('../models/Servicio');

async function createService(req, res, next) {
    const { service, description, supplier, serviceManager, basePrice, firstCommission, firstUser, secondCommission, secondUser, finalPrice } = req.body;

    console.log(req.body);
    if (!service || !description || !supplier || !serviceManager || !basePrice || !firstCommission || !firstUser || !secondCommission || !secondUser || !finalPrice) {
        const error = new Error("Falta información en el request");
        error.status = 400;
        return next(error);
    }

    const serviceToAdd = new Service({
        service,
        description,
        supplier,
        serviceManager,
        basePrice,
        firstCommission,
        firstUser,
        secondCommission,
        secondUser,
        finalPrice
    });

    try {
        await serviceToAdd.save();

        console.log("Servicio agregado con éxito");
        res.status(200).json({ success: true });

    } catch (err) {
        console.log(err);
        return next(err);
    }
}

async function editService(req, res, next) {
    const { service, description, supplier, serviceManager, basePrice, firstCommission, firstUser, secondCommission, secondUser, finalPrice } = req.body;

    console.log(req.body);
    if (!service || (!description && !supplier && !serviceManager && !basePrice && !firstCommission && !firstUser && !secondCommission && !secondUser && !finalPrice)) {
        const error = new Error("Falta información en el request.");
        error.status = 400;    
        return next(error);
    }

    const updateFields = {};
    if (description) { updateFields.description = description; }
    if (supplier) { updateFields.supplier = supplier; }
    if (serviceManager) { updateFields.serviceManager = serviceManager; }
    if (basePrice) { updateFields.basePrice = basePrice; }
    if (firstCommission) { updateFields.firstCommission = firstCommission; }
    if (firstUser) { updateFields.firstUser = firstUser; }
    if (secondCommission) { updateFields.secondCommission = secondCommission; }
    if (secondUser) { updateFields.secondUser = secondUser; }
    if (finalPrice) { updateFields.finalPrice = finalPrice; }

    try {
        const serviceToUpdate = await Service.findOneAndUpdate({ service }, updateFields, { new: true });

        if (!serviceToUpdate) {
            const error = new Error("El servicio no fue encontrado.");
            error.status = 404;
            throw error;
        }

        console.log("Servicio editado con éxito");
        res.status(200).json({ serviceToUpdate });
    
    } catch(err) {
        return next(err);
    }
}

// Maybe this function is not completely necessary.
async function editServiceById(req, res, next) {
    const { uuid } = req.params;
    const { service, description, supplier, serviceManager, basePrice, firstCommission, firstUser, secondCommission, secondUser, finalPrice } = req.body;

    if (!uuid || (!service && !description && !supplier && !serviceManager && !basePrice && !firstCommission && !firstUser && !secondCommission && !secondUser && !finalPrice)) {
        const error = new Error("Falta información en el request.");
        error.status = 400;    
        return next(error);
    }

    const updateFields = {};
    if (service) { updateFields.service = service; }
    if (description) { updateFields.description = description; }
    if (supplier) { updateFields.supplier = supplier; }
    if (serviceManager) { updateFields.serviceManager = serviceManager; }
    if (basePrice) { updateFields.basePrice = basePrice; }
    if (firstCommission) { updateFields.firstCommission = firstCommission; }
    if (firstUser) { updateFields.firstUser = firstUser; }
    if (secondCommission) { updateFields.secondCommission = secondCommission; }
    if (secondUser) { updateFields.secondUser = secondUser; }
    if (finalPrice) { updateFields.finalPrice = finalPrice; }

    try{
        const serviceToUpdate = await Service.findByIdAndUpdate(uuid, updateFields, { new: true });

        if (!serviceToUpdate) {
            const error = new Error("El servicio no fue encontrado.");
            error.status = 404;
            throw error;
        }

        console.log("Servicio editado con éxito");
        res.status(200).json({ serviceToUpdate });
    
    } catch(err){
        console.log(err)
        return next(err);
    }
}

async function deleteService(req, res, next) {
    const { service } = req.body;

    if (!service) {
        const error = new Error("Falta información en el request.");
        error.status = 400;    
        return next(error);   
    }

    try {
        // Buscar el servicio por su nombre
        const serviceToDelete = await Service.findOneAndDelete({ service: service });

        if (!serviceToDelete) {
            // Si no se encuentra el servicio, devolver un error
            const error = new Error("El servicio no fue encontrado.");
            error.status = 404;
            throw error;
        }

        console.log("Servicio eliminado con éxito");
        res.status(200).json({ success: true });
    } catch(err) {
        return next(err);
    }    
}

// Maybe this function is not completely necessary.
async function deleteServiceById(req, res, next) {
    const { uuid } = req.params;

    if (!uuid) {
        const error = new Error("Falta información en el request.");
        error.status = 400;    
        return next(error);   
    }

    try {
        await Service.findByIdAndDelete(uuid);

        console.log("Servicio eliminado con éxito");
        res.status(200).json({ success: true });
    } catch(err) {
        return next(err);
    }    
}

module.exports = {
    createService,
    editService,
    editServiceById,
    deleteService,
    deleteServiceById
}