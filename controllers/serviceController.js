const BadRequestError = require('../common/error/bad-request-error');
const NotFoundError = require('../common/error/not-found-error');
const Service = require('../models/Servicio');
const Usuario = require('../models/Usuario');
const { check } = require("express-validator");

// No uuid validator has been implemented for those functions that take parameters form the URL.
const showServicesValidators = [
    check()
        .custom(async (value, { req }) => {
            const services = await Service.find({});
            if (!services) {
                throw new NotFoundError("No services available");
            }
            return true;
        }),
    check()
        .custom(async (value, { req }) => {
            const users = await Usuario.find({});
            if (!users) {
                throw new NotFoundError("No users available");
            }
            return true;
        }),
    check()
        .custom(async (value, { req }) => {
            const additionalServiceUsers = await Usuario.find({ privilege: "Servicios adicionales" });
            if (!additionalServiceUsers) {
                throw new NotFoundError("No janitors available");
            }
            return true;
        }),
];

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
        .notEmpty().withMessage('Supplier email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const supplier = await Usuario.findOne({ email: value });
            if (!supplier) {
                throw new NotFoundError("Supplier does not exist");
            }
            return true;
        }),
    check('serviceManager')
        .notEmpty().withMessage('Service manager email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const serviceManager = await Usuario.findOne({ email: value, privilege: "Servicios adicionales" });
            if (!serviceManager) {
                throw new NotFoundError("Service manager does not exist");
            }
            return true;
        }),
    check('basePrice')
        .notEmpty().withMessage('Base price is required')
        .isNumeric().withMessage('Base price must be a number')
        .toFloat(),
    check('firstCommission')
        .notEmpty().withMessage('First commission is required')
        .isNumeric().withMessage('First commission must be a number')
        .toFloat(),
    check('firstUser')
        .notEmpty().withMessage('First user email is required')
        .isEmail().withMessage('Invalid first user email format')
        .custom(async (value, { req }) => {
            const janitor1 = await Usuario.findOne({ email: value, privilege: "Servicios adicionales" });
            if (!janitor1) {
                throw new NotFoundError("Janitor does not exist");
            }
            return true;
        }),
    check('secondCommission')
        .notEmpty().withMessage('Second commission is required')
        .isNumeric().withMessage('Second commission must be a number')
        .toFloat(),
    check('secondUser')
        .notEmpty().withMessage('Second user email is required')
        .isEmail().withMessage('Invalid second user email format')
        .custom(async (value, { req }) => {
            const janitor2 = await Usuario.findOne({ email: value, privilege: "Servicios adicionales" });
            if (!janitor2) {
                throw new NotFoundError("Janitor 2 does not exist");
            }
            return true;
        }),
    check('finalPrice')
        .notEmpty().withMessage('Final price is required')
        .isNumeric().withMessage('Final price must be a number')
        .toFloat(),
];

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
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const janitor1 = await Usuario.findOne({ email: value, privilege: "Servicios adicionales" });
            if (!janitor1) {
                throw new NotFoundError("Janitor 1 does not exists");
            }
            return true;
        }),
    check('secondCommission')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Second commission must be a number')
        .toFloat(),
    check('secondUser')
        .optional({ checkFalsy: true })
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const janitor2 = await Usuario.findOne({ email: value, privilege: "Servicios adicionales" });
            if (!janitor2) {
                throw new NotFoundError("Janitor 2 does not exists");
            }
            return true;
        }),
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

async function mostrarServicios(req, res, next) { 
    try {
        const services = await Service.find({});
        if (!services) {
            throw new NotFoundError("No services found");
        }

        const promises = services.map(async service => {
            const supplier = await Usuario.findById(service.supplier);
            const serviceManager = await Usuario.findById(service.serviceManager);
            const firstUser = await Usuario.findById(service.firstUser);
            const secondUser = await Usuario.findById(service.secondUser);
            if (!supplier || !serviceManager || !firstUser || !secondUser) {
                throw new NotFoundError("Error finding related users");
            }

            return {
                service: service.service,
                description: service.description,
                supplier: supplier.firstName + ' ' + supplier.lastName,
                serviceManager: serviceManager.firstName + ' ' + serviceManager.lastName,
                basePrice: service.basePrice,
                firstCommission: service.firstCommission,
                firstUser: firstUser.firstName + ' ' + firstUser.lastName,
                secondCommission: service.secondCommission,
                secondUser: secondUser.firstName + ' ' + secondUser.lastName,
                finalPrice: service.finalPrice,
            };
        });
        const services2 = await Promise.all(promises);

        const users = await Usuario.find({}).lean();
        if (!users) {
            throw new NotFoundError("No users found");
        }

        const additionalServiceUsers = await Usuario.find({ privilege: "Servicios adicionales" }).lean();
        if (!additionalServiceUsers) {
            throw new NotFoundError("No additional service found");
        }

        res.render('serviciosAdicionales', {
            layout: 'services',
            services: services2,
            users: users,
            additionalServiceUsers: additionalServiceUsers
        });
    } catch (err) {
        return next(err);
    }
}

async function createService(req, res, next) {
    const { service, description, supplier, serviceManager, basePrice, firstCommission, firstUser, secondCommission, secondUser, finalPrice } = req.body;
    
    const supplierToAdd = await Usuario.findOne({email: supplier});
    if(!supplierToAdd){
        throw new NotFoundError("Supplier not found");
    }

    const serviceManagerToAdd = await Usuario.findOne({email: serviceManager});
    if(!serviceManagerToAdd){
        throw new NotFoundError("Service manager not found");
    }

    const firstUserToAdd = await Usuario.findOne({email: firstUser});
    if(!firstUserToAdd){
        throw new NotFoundError("First user not found");
    }
    
    const secondUserToAdd = await Usuario.findOne({email: secondUser});
    if(!secondUserToAdd){
        throw new NotFoundError("Second user not found");
    }

    const serviceToAdd = new Service({
        service,
        description,
        supplier: supplierToAdd._id,
        serviceManager: serviceManagerToAdd._id,
        basePrice,
        firstCommission,
        firstUser: firstUserToAdd._id,
        secondCommission,
        secondUser: secondUserToAdd._id,
        finalPrice
    });

    try {
        await serviceToAdd.save();

        res.status(200).json({ success: true, message: "Servicio agregado con éxito" });
    } catch (err) {
        console.log(err);
        return next(err);
    }
}

async function editService(req, res, next) {
    const { service, description, supplier, serviceManager, basePrice, firstCommission, firstUser, secondCommission, secondUser, finalPrice } = req.body;
    const updateFields = {};
    if (description) { updateFields.description = description; }
    if (supplier) { 
        const supplierToAdd = await Usuario.findOne({email: supplier});
        if(!supplierToAdd){
            throw new NotFoundError("Supplier not found");
        }
        updateFields.supplier = supplierToAdd._id; 
    }
    if (serviceManager) {
        const serviceManagerToAdd = await Usuario.findOne({email: serviceManager});
        if(!serviceManagerToAdd){
            throw new NotFoundError("Service manager not found");
        }
        updateFields.serviceManager = serviceManagerToAdd._id; 
    }
    if (basePrice) { updateFields.basePrice = basePrice; }
    if (firstCommission) { updateFields.firstCommission = firstCommission; }
    if (firstUser) { 
        const firstUserToAdd = await Usuario.findOne({email: firstUser});
        if(!firstUserToAdd){
            throw new NotFoundError("First user not found");
        }
        updateFields.firstUser = firstUserToAdd._id; 
    }
    if (secondCommission) { updateFields.secondCommission = secondCommission; }
    if (secondUser) { 
        const secondUserToAdd = await Usuario.findOne({email: secondUser});
        if(!secondUserToAdd){
            throw new NotFoundError("First user not found");
        }
        updateFields.secondUser = secondUserToAdd._id; 
    }
    if (finalPrice) { updateFields.finalPrice = finalPrice; }

    try {
        const serviceToUpdate = await Service.findOneAndUpdate({ service }, updateFields, { new: true });
        if (!serviceToUpdate) {
            throw new NotFoundError("Service not found");
        }

        res.status(200).json({ success: true, message: "Servicio editado con éxito" });
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

        res.status(200).json({ success: true, message: "Servicio eliminado con éxito" });
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
    showServicesValidators,
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