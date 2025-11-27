const BadRequestError = require('../common/error/bad-request-error');
const NotFoundError = require('../common/error/not-found-error');
const Cliente = require('../models/Cliente');
const ClientesWeb = require('../models/ClienteWeb');
const logController = require('../controllers/logController');
const { check } = require("express-validator");
const Roles = require("../models/Roles");
const permissions = require('../models/permissions');

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
        .isEmail().withMessage('Invalid email format'),
    check('identificationType')
        .optional({ checkFalsy: true })
        .isIn(['INE', 'Pasaporte', 'Licencia de conducir']).withMessage('Invalid identification type'),
    check('identificationNumber')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage('Identification number must be less than 255 characters'),
    check()
        .custom((value, { req }) => {
            const { firstName, lastName, phone, address, identificationType, identificationNumber } = req.body;
            if ((!firstName && !lastName && !phone && !address && !identificationType && !identificationNumber)) {
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

async function showClientsView(req, res, next) {
    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            return next(new BadRequestError("El usuario no tiene un rol definido, contacte al administrador"));
        }

        const permittedRole = "VIEW_CLIENTS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            return next(new BadRequestError("El usuario no tiene permiso para ver clientes"));
        }
        const clients = await Cliente.find({}).lean();
        res.render('vistaClientes', {
            clients: clients
        });
    } catch (err) {
        return next(err);
    }
}

async function showAllClients(req, res, next) {
    try {
        const clients = await Cliente.find();
        res.send(clients);
    } catch (err) {
        return next(err);
    }
}
async function showClients(req, res, next) {
    try {
        const { id } = req.params;
        console.log(id);
        const clients = await Cliente.find({ _id: id });
        res.send(clients);
    } catch (err) {
        return next(err);
    }
}

// CREATE_CLIENTS
async function createClient(req, res, next) {
    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            // return res.status(500).json({ message: "El usuario no tiene un rol definido, contacte al administrador" });
            throw new BadRequestError("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "CREATE_CLIENTS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            // return res.status(500).json({ message: "El usuario no tiene permiso para crear clientes" });
            throw new BadRequestError("El usuario no tiene permiso para crear clientes");
        }
        const { firstName, lastName, phone, address, email, identificationType, identificationNumber } = req.body;
        if (email !== null) {
            const client = await Cliente.findOne({ email: email });
            if (client) {
                throw new BadRequestError("Email already exists");
            }

        }
        const clienteToAdd = new Cliente({
            firstName,
            lastName,
            phone,
            address,
            email: email || null,
            identificationType,
            identificationNumber
        });

        await clienteToAdd.save();

        console.log("Cliente agregado con éxito");
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'registration',
            acciones: `Cliente agregado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);
        res.status(200).json({ success: true, message: "Client successfully created", client: clienteToAdd });
    } catch (err) {
        return next(err);
    }
}

async function createClientLocal(firstName, lastName, cellphone, reqUser) {
    console.log("Entrando a la funcion")
    console.log(firstName, lastName, cellphone, reqUser)

    const existingClient = await Cliente.findOne({ phone: cellphone });
    if (existingClient) {
        console.log("Cliente ya existe")
        return existingClient;
    }
    
    const clienteToAdd = new Cliente({
        firstName: firstName,
        lastName: lastName,
        phone: cellphone,
    });

    console.log(clienteToAdd)

    try {
        await clienteToAdd.save();

        console.log("Cliente agregado con éxito");
        const logBody = {
            fecha: Date.now(),
            idUsuario: reqUser.id,
            type: 'registration',
            acciones: `Cliente agregado por ${reqUser.firstName} ${reqUser.lastName}`,
            nombreUsuario: `${reqUser.firstName} ${reqUser.lastName}`
        }

        await logController.createBackendLog(logBody);
        return clienteToAdd
    } catch (err) {
        console.log(err)
        return null;
    }
}

// EDIT_CLIENTS
async function editClient(req, res, next) {
    
    const { id, firstName, lastName, phone, address, email, identificationType, identificationNumber } = req.body;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    if (email) { updateFields.email = email; }
    if (phone) { updateFields.phone = phone; }
    if (address) { updateFields.address = address; }
    if (identificationType) { updateFields.identificationType = identificationType; }
    if (identificationNumber) { updateFields.identificationNumber = identificationNumber; }
    
    try {
        const userRole = req.session.role;
    
        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            throw new BadRequestError("El usuario no tiene un rol definido, contacte al administrador");
        }
    
        const permittedRole = "EDIT_CLIENTS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new BadRequestError("El usuario no tiene permiso para editar clientes");
        }
        
        const clienteToUpdate = await Cliente.findOneAndUpdate({ _id: id }, updateFields, { new: true });
        if (!clienteToUpdate) {
            throw new NotFoundError("Client not found");
        }

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'modification',
            acciones: `Cliente editado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);

        console.log("Cliente editado con éxito");
        res.status(200).json({ success: true, message: "Cliente editado con éxito" });
    } catch (err) {
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

        if (email) {
            const existingClient = await Cliente.findOne({ email: email, _id: { $ne: uuid } });
            if (existingClient) {
                return res.status(400).json({
                    error: [{ message: "El email ya se encuentra asociado a otro cliente" }]
                });
            }
        }

        const clienteToUpdate = await Cliente.findByIdAndUpdate(uuid, updateFields, { new: true });
        if (!clienteToUpdate) {
            throw new NotFoundError("Client not found");
        }

        console.log("Cliente editado con éxito");
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'modification',
            acciones: `Cliente editado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);
        res.status(200).json({ clienteToUpdate });
    } catch (err) {
        console.log(err)
        return next(err);
    }
}

async function deleteClient(req, res, next) {
    const { email } = req.body;

    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "DELETE_CLIENTS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso eliminar clientes.");
        }

        const clientToDelete = await Cliente.findOneAndDelete({ email });
        if (!clientToDelete) {
            throw new NotFoundError("Client not found");
        }

        console.log("Cliente eliminado con éxito");
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'elimination',
            acciones: `Cliente eliminado por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);
        res.status(200).json({ success: true, message: "Cliente eliminado con éxito" });
    } catch (err) {
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
    } catch (err) {
        return next(err);
    }
}

// Espacio para clientes WEB


async function renderClientsWebView(req, res) {
    try {
        // Obtener todos los clientes web (sin populate de favoritos por ahora)
        const clientsWeb = await ClientesWeb.find().lean();

        // Estadísticas generales
        const totalClients = clientsWeb.length;
        
        // Clientes registrados este mes
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const newThisMonth = clientsWeb.filter(client => 
            new Date(client.createdAt) >= startOfMonth
        ).length;

        // Clientes activos (con último login en los últimos 30 días)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const activeClients = clientsWeb.filter(client => 
            client.lastLogin && new Date(client.lastLogin) >= thirtyDaysAgo
        ).length;

        // Clientes verificados
        const verifiedClients = clientsWeb.filter(client => client.isEmailVerified).length;

        // Métodos de registro
        const registrationMethods = {
            email: clientsWeb.filter(client => client.registrationMethod === 'email').length,
            google: clientsWeb.filter(client => client.registrationMethod === 'google').length,
            facebook: clientsWeb.filter(client => client.registrationMethod === 'facebook').length
        };

        // Clientes por mes (últimos 6 meses)
        const monthlyStats = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
            const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() - i + 1, 0);
            const count = clientsWeb.filter(client => {
                const createdDate = new Date(client.createdAt);
                return createdDate >= monthStart && createdDate <= monthEnd;
            }).length;
            
            monthlyStats.push({
                month: monthStart.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
                count: count
            });
        }

        res.render('vistaClientesWeb', {
            clientsWeb: clientsWeb,
            stats: {
                total: totalClients,
                newThisMonth: newThisMonth,
                active: activeClients,
                verified: verifiedClients,
                registrationMethods: registrationMethods,
                monthlyStats: monthlyStats,
                verificationRate: totalClients > 0 ? Math.round((verifiedClients / totalClients) * 100) : 0,
                activeRate: totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0
            },
            layout: 'tailwindMain'
        });
    } catch (err) {
        console.error('Error in renderClientsWebView:', err);
        res.status(500).render('error', { message: 'Error loading clients data' });
    }
}













module.exports = {
    createClientValidators,
    editClientValidators,
    deleteClientValidators,
    showClientsView,
    showClients,
    showAllClients,
    createClient,
    createClientLocal,
    editClient,
    editClientById,
    deleteClient,
    deleteClientById,
    renderClientsWebView
}