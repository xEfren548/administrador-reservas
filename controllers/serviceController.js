const BadRequestError = require('../common/error/bad-request-error');
const NotFoundError = require('../common/error/not-found-error');
const Service = require('../models/Servicio');
const { check } = require("express-validator");

// No uuid validator has been implemented for those functions that take parameters form the URL.
const createServiceValidators = [
    check('service')
        .notEmpty().withMessage('Service is required')
        .isLength({ max: 255 }).withMessage('Service must be less than 255 characters')
        .custom(async (value, { req }) => {
            const service = await Service.findOne({ service: value });
            if (service) {
                throw new NotFoundError("Service alerady exists");
            }
            return true;
        }),
    check('description')
        .notEmpty().withMessage('Description is required')
        .isLength({ max: 255 }).withMessage('Description must be less than 255 characters'),
    check('supplier')
        .notEmpty().withMessage('Supplier name is required')
        .isLength({ max: 255 }).withMessage("Supplier name must be less than 255 characters"),
    check('serviceManager')
        .notEmpty().withMessage('Service manager name is required')
        .isLength({ max: 255 }).withMessage("Service manager name must be less than 255 characters"),
    check('basePrice')
        .notEmpty().withMessage('Base price is required')
        .isNumeric().withMessage('Base price must be a number')
        .toFloat(),
    check('firstCommission')
        .notEmpty().withMessage('Base price is required')
        .isNumeric().withMessage('First commission must be a number')
        .toFloat(),
    check('firstUser')
        .notEmpty().withMessage('First user name is required')
        .isLength({ max: 255 }).withMessage("First user name must be less than 255 characters"),
    check('secondCommission')
        .notEmpty().withMessage('Base price is required')
        .isNumeric().withMessage('Second commission must be a number')
        .toFloat(),
    check('secondUser')
        .notEmpty().withMessage('Second user name is required')
        .isLength({ max: 255 }).withMessage("Second user name must be less than 255 characters"),
    check('finalPrice')
        .notEmpty().withMessage('Final price is required')
        .isNumeric().withMessage('Final price must be a number')
        .toFloat(),
];

async function mostrarServicios(req, res, next) { 
    try {
        const servicios = await Service.find({}).lean();
        res.render('serviciosAdicionales', {
            layout: 'services',
            servicios: servicios
        });
    } catch (err) {
        return next(err);
    }
}

const editServiceValidators = [
    check('service')
        .isLength({ max: 255 }).withMessage('Service must be less than 255 characters')
        .custom(async (value, { req }) => {
            const service = await Service.findOne({ service: value });
            if (!service) {
                throw new NotFoundError("Service not found");
            }
            return true;
        }),
    check('description')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage('Description must be less than 255 characters'),
    check('supplier')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Supplier name must be less than 255 characters"),
    check('serviceManager')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Service manager name must be less than 255 characters"),
    check('basePrice')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Base price must be a number')
        .toFloat(),
    check('firstCommission')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('First commission must be a number')
        .toFloat(),
    check('firstUser')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("First user name must be less than 255 characters"),
    check('secondCommission')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Second commission must be a number')
        .toFloat(),
    check('secondUser')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Second user name must be less than 255 characters"),
    check('finalPrice')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Final price must be a number')
        .toFloat(),
    check()
        .custom((value, { req }) => {
            const { description, supplier, serviceManager, basePrice, firstCommission, firstUser, secondCommission, secondUser, finalPrice } = req.body;
            if((!description && !supplier && !serviceManager && !basePrice && !firstCommission && !firstUser && !secondCommission && !secondUser && !finalPrice)){
                throw new BadRequestError("There should be at least one field to update.")
            }
            return true;
        })
];

const deleteServiceValidators = [
    check('service')
        .notEmpty().withMessage('Service is required')
        .isLength({ max: 255 }).withMessage('Service must be less than 255 characters')
        .custom(async (value, { req }) => {
            const service = await Service.findOne({ service: value });
            if (!service) {
                throw new NotFoundError("Service not found");
            }
            return true;
        })
];

async function createService(req, res, next) {
    const { service, description, supplier, serviceManager, basePrice, firstCommission, firstUser, secondCommission, secondUser, finalPrice } = req.body;
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
            throw new NotFoundError("Service not found");
        }

        console.log("Servicio editado con éxito");
        res.status(200).json({ serviceToUpdate });
    } catch(err) {
        return next(err);
    }
}

// Maybe this function is not completely necessary.
// This function can update service's name (its unique identifier).
async function editServiceById(req, res, next) {
    const { uuid } = req.params;
    const { service, description, supplier, serviceManager, basePrice, firstCommission, firstUser, secondCommission, secondUser, finalPrice } = req.body;
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
            throw new NotFoundError("Service not found");
        }

        console.log("Servicio editado con éxito");
        res.status(200).json({ serviceToUpdate });
    } catch(err){
        return next(err);
    }
}

async function deleteService(req, res, next) {  
    const { service } = req.body;

    try {
        const serviceToDelete = await Service.findOneAndDelete({ service: service });
        if (!serviceToDelete) {
            throw new NotFoundError("Service not found");
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

    try {
        await Service.findByIdAndDelete(uuid);

        console.log("Servicio eliminado con éxito");
        res.status(200).json({ success: true });
    } catch(err) {
        return next(err);
    }    
}

module.exports = {
    createServiceValidators,
    editServiceValidators,
    deleteServiceValidators,
    createService,
    editService,
    editServiceById,
    deleteService,
    deleteServiceById,
    mostrarServicios
}