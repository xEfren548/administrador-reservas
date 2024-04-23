const BadRequestError = require('../common/error/bad-request-error');
const NotFoundError = require('../common/error/not-found-error');
const Cliente = require('../models/Cliente');
const {check} = require("express-validator");

const createClientValidators = [
    check('firstName')
        .notEmpty().withMessage('First name is required')
        .isLength({ max: 255 }).withMessage("First name must be less than 255 characters"),
    check('lastName')
        .notEmpty().withMessage('Last name is required')
        .isLength({ max: 255 }).withMessage("Last name must be less than 255 characters"),
    check('phone')
        .notEmpty().withMessage('Phone is required')
        .matches(/^\+?[0-9]{10,15}$/).withMessage('Invalid phone number format')
        .isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 digits'),
    check('address')
        .notEmpty().withMessage('Address is required')
        .isLength({ max: 255 }).withMessage('Address must be less than 255 characters'),
    check('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const cliente = await Cliente.findOne({ email: value });
            if (cliente) {
                throw new BadRequestError("Email already exists");
            }
            return true;
        }),
    check('identificationType')
        .notEmpty().withMessage('Identification type is required')
        .isIn(['INE', 'Pasaporte', 'Licencia de conducir']).withMessage('Invalid identification type'),
    check('identificationNumber')
        .notEmpty().withMessage('Identification number is required')
        .isLength({ max: 255 }).withMessage('Identification number must be less than 255 characters')
];

const editClientValidators = [
    check('firstName')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("First name must be less than 255 characters"),
    check('lastName')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Last name must be less than 255 characters"),
    check('phone')
        .optional({ checkFalsy: true })
        .matches(/^\+?[0-9]{10,15}$/).withMessage('Invalid phone number format')
        .isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 digits'),
    check('address')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage('Address must be less than 255 characters'),
    check('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const user = await Cliente.findOne({ email: value });
            if (!user) {
                throw new NotFoundError('Email not registered');
            }
            return true;
        }),
    check('identificationType')
        .optional({ checkFalsy: true })
        .isIn(['INE', 'Pasaporte', 'Licencia de conducir']).withMessage('Invalid identification type'),
    check('identificationNumber')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage('Identification number must be less than 255 characters'),
    check()
        .custom((value, { req }) => {
            const { firstName, lastName, phone, address, identificationType, identificationNumber } = req.body;
            if((!firstName && !lastName && !phone && !address && !identificationType && !identificationNumber)){
                throw new BadRequestError("There should be at least one field to update.")
            }
            return true;
        })
];

const deleteClientValidators = [
    check('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const user = await Cliente.findOne({ email: value });
            if (!user) {
                throw new NotFoundError('Email not registered');
            }
            return true;
        }),
];

async function showClientsView(req, res, next){
    try {
        const clients = await Cliente.find({}).lean();
        res.render('vistaClientes', {
            layout: 'clientes',
            clients: clients
        });
    } catch (err) {
        return next(err);
    }
}

async function createClient(req, res, next) {
    const { firstName, lastName, phone, address, email, identificationType, identificationNumber } = req.body;
    const clienteToAdd = new Cliente({
        firstName,
        lastName,
        phone,
        address,
        email,
        identificationType,
        identificationNumber
    });

    try {
        await clienteToAdd.save();

        console.log("Cliente agregado con éxito");
        res.status(200).json({ success: true });
    } catch (err) {
        return next(err);
    }
}

async function editClient(req, res, next) {
    const { firstName, lastName, phone, address, email, identificationType, identificationNumber } = req.body;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    if (phone) { updateFields.phone = phone; }
    if (address) { updateFields.address = address; }
    if (identificationType) { updateFields.identificationType = identificationType; }
    if (identificationNumber) { updateFields.identificationNumber = identificationNumber; }

    try {
        const clienteToUpdate = await Cliente.findOneAndUpdate({ email }, updateFields, { new: true });
        if (!clienteToUpdate) {
            throw new NotFoundError("Client not found");
        }

        console.log("Cliente editado con éxito");
        res.status(200).json({ clienteToUpdate });
    } catch(err) {
        return next(err);
    }
}

// Maybe this function is not completely necessary.
// This function can update user's email (its unique identifier).
async function editClientById(req, res, next) {   
    const { uuid } = req.params;
    const { firstName, lastName, phone, address, email, identificationType, identificationNumber } = req.body;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    if (phone) { updateFields.phone = phone; }
    if (address) { updateFields.address = address; }
    if (email) { updateFields.email = email; }
    if (identificationType) { updateFields.identificationType = identificationType; }
    if (identificationNumber) { updateFields.identificationNumber = identificationNumber; }

    try {
        const clienteToUpdate = await Cliente.findByIdAndUpdate(uuid, updateFields, { new: true });
        if (!clienteToUpdate) {
            throw new NotFoundError("Client not found");
        }

        console.log("Cliente editado con éxito");
        res.status(200).json({ clienteToUpdate });
    } catch(err) {
        console.log(err)
        return next(err);
    }
}

async function deleteClient(req, res, next) {
    const { email } = req.body;

    try {
        const clientToDelete = await Cliente.findOneAndDelete({ email });
        if (!clientToDelete) {
            throw new NotFoundError("Client not found");
        }

        console.log("Cliente eliminado con éxito");
        res.status(200).json({ success: true });
    } catch(err) {
        return next(err);
    }    
}

// Maybe this function is not completely necessary.
async function deleteClientById(req, res, next) {
    const { uuid } = req.params;

    if (!uuid) {
        return next(new BadRequestError("Missing info in URL"));  
    }

    try {
        await Cliente.findByIdAndDelete(uuid);

        console.log("Cliente eliminado con éxito");
        res.status(200).json({ success: true });
    } catch(err) {
        return next(err);
    }    
}

module.exports = {
    createClientValidators,
    editClientValidators,
    deleteClientValidators,
    showClientsView,
    createClient,
    editClient,
    editClientById,
    deleteClient,
    deleteClientById
}