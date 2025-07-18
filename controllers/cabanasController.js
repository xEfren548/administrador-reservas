const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const moment = require("moment-timezone");
const Habitacion = require('../models/Habitacion');
const logController = require('../controllers/logController')
const TipologiasCabana = require('../models/TipologiasCabana');
const Cliente = require('../models/Cliente');
const NotFoundError = require("../common/error/not-found-error");
const BadRequestError = require("../common/error/bad-request-error");
const { check } = require("express-validator");
const ftp = require('basic-ftp');
const Usuario = require("../models/Usuario");
const fs = require('fs');

const Roles = require("../models/Roles");
const permissions = require('../models/permissions');
const Plataformas = require('../models/Plataformas');

const showCreateChaletViewValidators = [
    check()
        .custom(async (value, { req }) => {
            const admin = await Usuario.findOne({ privilege: "Administrador" });
            if (!admin) {
                throw new NotFoundError('No administrator found');
            }
            return true;
        }),
    check()
        .custom(async (value, { req }) => {
            const admin = await Usuario.findOne({ privilege: "Limpieza" });
            if (!admin) {
                throw new NotFoundError('No janitor found');
            }
            return true;
        }),
];

const createChaletValidators = [
    // propertyDetails validations.
    check('propertyDetails.accomodationType')
        .notEmpty().withMessage('Accommodation type is required')
        .isLength({ max: 255 }).withMessage("Accomodation type must be less than 255 characters"),
    check('propertyDetails.name')
        .notEmpty().withMessage('Name is required')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s0-9']+$/).withMessage("Invalid property name format")
        .isLength({ max: 255 }).withMessage("Name must be less than 255 characters")
        .custom(async (value, { req }) => {
            const chalet = await Habitacion.findOne({"propertyDetails.name": value}).lean();
            // const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === value);
            if (chalet) {
                throw new NotFoundError('Chalet name already taken');
            }
            return true;
        }),
    check('propertyDetails.phoneNumber')
        .notEmpty().withMessage('Phone is required')
        .matches(/^\+?[0-9]{10,15}$/).withMessage('Invalid phone number format')
        .isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 digits'),
    //check('propertyDetails.email')
    //    //.notEmpty().withMessage('Email is required')
    //   // .isEmail().withMessage('Invalid email format'),
    //   // .custom(async (value, { req }) => {
    //   //     const chalets = await Habitacion.findOne();
    //   //     const chalet = chalets.resources.find(chalet => chalet.propertyDetails.email === value);
    //   //     if(chalet){
    //   //         throw new NotFoundError('Chalet email already taken');
    //   //     }
    //   //     return true;
    //   // }),
    //check('propertyDetails.website')
    //    //.notEmpty().withMessage('Website is required')
    //    .isLength({ max: 255 }).withMessage("Name must be less than 255 characters"),
    check('propertyDetails.minOccupancy')
        .notEmpty().withMessage('Minimum occupancy is required')
        .isNumeric().withMessage('Minimum occupancy must be a number'),
    check('propertyDetails.maxOccupancy')
        .notEmpty().withMessage('Maximum occupancy is required')
        .isNumeric().withMessage('Maximum occupancy must be a number'),
    // accommodationFeatures validations.
    check('accommodationFeatures')
        .custom((value, { req }) => {
            for (const category in value) {
                const features = value[category];
                for (const feature in features) {
                    const fieldValue = features[feature];
                    if (typeof fieldValue !== 'boolean') {
                        throw new BadRequestError(`${category}.${feature} must be a boolean value`);
                    }
                }
            }
            return true;
        }),

    // additionalInfo validations.
    check('additionalInfo.nBeds')
        .notEmpty().withMessage('Number of beds is required')
        .isNumeric().withMessage('Number of beds must be a number'),
    check('additionalInfo.nRestrooms')
        .notEmpty().withMessage('Number of restrooms is required')
        .isNumeric().withMessage('Number of restrooms must be a number'),
    check('additionalInfo.bedroomSize')
        .notEmpty().withMessage('Bedroom size is required')
        .isNumeric().withMessage('Bedroom size must be a number'),
    check('additionalInfo.extraCleaningCost')
        .notEmpty().withMessage('cleaning cost is required')
        .isNumeric().withMessage('cleaning cost must be a number'),

    // location validations.
    check('location.state')
        .notEmpty().withMessage('State is required')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid state name format")
        .isLength({ max: 255 }).withMessage("State name must be less than 255 characters"),
    check('location.population')
        .notEmpty().withMessage('Population is required')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid population name format")
        .isLength({ max: 255 }).withMessage("Population name must be less than 255 characters"),
    check('location.addressNumber')
        .notEmpty().withMessage('Address number is required')
        .isNumeric().withMessage('Address number must be a number'),
    check('location.postalCode')
        .notEmpty().withMessage('Postal code is required')
        .isNumeric().withMessage('Postal code must be a number'),
    check('location.latitude')
        .notEmpty().withMessage('Latitude is required')
        .isNumeric().withMessage('Latitude must be a number'),
    check('location.longitude')
        .notEmpty().withMessage('Longitude is required')
        .isNumeric().withMessage('Longitude must be a number'),
    // check('location.weatherWidget')
    //     .notEmpty().withMessage('Weather widget is required'),
    check('location.iFrame')
        .notEmpty().withMessage('iFrame is required'),

    // accomodationDescription validations.
    check('accomodationDescription')
        .notEmpty().withMessage('Accommodation description is required'),

    // additionalAccomodationDescription validations.
    check('additionalAccomodationDescription')
        .notEmpty().withMessage('Additional accommodation description is required'),

    // // touristicRate validations.
    // check('touristicRate')
    //     .notEmpty().withMessage('Touristic rate is required'),

    // legalNotice validations.
    check('legalNotice')
        .notEmpty().withMessage('Legal notice is required'),

    // Other data validations.
    check('others.basePrice')
        .notEmpty().withMessage('Base price is required')
        .isNumeric().withMessage('Base price must be a number'),
    check('others.basePrice2nights')
        .notEmpty().withMessage('Base price for 2 nights is required')
        .isNumeric().withMessage('Maximum occupancy must be a number'),
    check('others.baseCost')
        .notEmpty().withMessage('Base cost is required')
        .isNumeric().withMessage('Maximum occupancy must be a number'),
    check('others.baseCost2nights')
        .notEmpty().withMessage('Base cost for 2 nights is required')
        .isNumeric().withMessage('Base cost must be a number'),
    check("others.admin")
        .notEmpty().withMessage("Administrator's name is required")
        .isLength({ max: 255 }).withMessage("Administrator's name must be less than 255 characters")
        .custom(async (value, { req }) => {
            const admin = await Usuario.findOne({ email: value, privilege: "Administrador" });
            if (!admin) {
                throw new NotFoundError('Administrator does not exist');
            }
            return true;
        }),
    check("others.janitor")
        .notEmpty().withMessage("Janitor's name is required")
        .isLength({ max: 255 }).withMessage("Janitor's name must be less than 255 characters")
        .custom(async (value, { req }) => {
            const admin = await Usuario.findOne({ email: value, privilege: "Limpieza" });
            if (!admin) {
                throw new NotFoundError('Janitor does not exist');
            }
            return true;
        }),
];

const uploadChaletFilesValidators = [
    check()
        .custom(async (value, { req }) => {
            if (!req.files) {
                throw new BadRequestError('Upload pictures of the chalet');
            }
            return true;
        })
];

const editChaletValidators = [
    // propertyDetails validations.
    check('propertyDetails.accomodationType')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Accomodation type must be less than 255 characters")
        .isIn(['Habitación', 'Cabaña']).withMessage('Invalid accomodation type'),
    check('propertyDetails.name')
        .optional({ checkFalsy: true })
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s0-9']+$/).withMessage("Invalid property name format")
        .isLength({ max: 255 }).withMessage("Name must be less than 255 characters"),
    //.custom(async (value, { req }) => {
    //    if (value) { // Verifica si se proporciona un valor antes de realizar la validación
    //        const chalets = await Habitacion.findOne();
    //        const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === value);
    //        if(!chalet){
    //            throw new NotFoundError('Chalet not found');
    //        }
    //    }
    //    return true;
    //}),
    check('propertyDetails.phoneNumber')
        .optional({ checkFalsy: true })
        .matches(/^\+?[0-9]{10,15}$/).withMessage('Invalid phone number format')
        .isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 digits'),
    // check('propertyDetails.email')
    //     .optional({ checkFalsy: true })
    //     .isEmail().withMessage('Invalid email format'),
    //     //.custom(async (value, { req }) => {
    //     //    if (value) { // Verifica si se proporciona un valor antes de realizar la validación
    //     //        const chalets = await Habitacion.findOne();
    //     //        const chalet = chalets.resources.find(chalet => chalet.propertyDetails.email === value);
    //     //        if(!chalet){
    //     //            throw new NotFoundError('Chalet email not found');
    //     //        }
    //     //    }
    //     //    return true;
    //     //}),
    // check('propertyDetails.website')
    //     .optional({ checkFalsy: true })
    //     .isLength({ max: 255 }).withMessage("Name must be less than 255 characters"),
    check('propertyDetails.minOccupancy')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Minimum occupancy must be a number'),
    check('propertyDetails.maxOccupancy')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Maximum occupancy must be a number'),
    check('propertyDetails.tourLicense')
        .optional({ checkFalsy: true }),

    // accommodationFeatures validations.
    check('accommodationFeatures')
        .optional({ checkFalsy: true })
        .custom((value, { req }) => {
            if (value) { // Verifica si se proporciona un valor antes de realizar la validación
                for (const category in value) {
                    const features = value[category];
                    for (const feature in features) {
                        const fieldValue = features[feature];
                        if (typeof fieldValue !== 'boolean') {
                            throw new BadRequestError(`${category}.${feature} must be a boolean value`);
                        }
                    }
                }
            }
            return true;
        }),

    // additionalInfo validations.
    check('additionalInfo.nBeds')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Number of beds must be a number'),
    check('additionalInfo.nRestrooms')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Number of restrooms must be a number'),
    check('additionalInfo.bedroomSize')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Bedroom size must be a number'),
    check('additionalInfo.extraCleaningCost')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Extra cleaning cost must be a number'),

    // location validations.
    check('location.state')
        .optional({ checkFalsy: true })
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid state name format")
        .isLength({ max: 255 }).withMessage("State name must be less than 255 characters"),
    check('location.population')
        .optional({ checkFalsy: true })
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid population name format")
        .isLength({ max: 255 }).withMessage("Population name must be less than 255 characters"),
    check('location.addressNumber')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Address number must be a number'),
    check('location.postalCode')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Postal code must be a number'),
    check('location.latitude')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Latitude must be a number'),
    check('location.longitude')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Longitude must be a number'),
    // check('location.weatherWidget')
    //     .optional({ checkFalsy: true }),
    check('location.iFrame')
        .optional({ checkFalsy: true }),

    // accomodationDescription validations.
    check('accomodationDescription')
        .optional({ checkFalsy: true }),

    // additionalAccomodationDescription validations.
    check('additionalAccomodationDescription')
        .optional({ checkFalsy: true }),

    // // touristicRate validations.
    // check('touristicRate')
    //     .optional({ checkFalsy: true }),

    // legalNotice validations.
    check('legalNotice')
        .optional({ checkFalsy: true }),

    // Other data validations.
    check('others.basePrice')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Base price must be a number'),
    check('others.basePrice2nights')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Maximum occupancy must be a number'),
    check('others.baseCost')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Maximum occupancy must be a number'),
    check('others.baseCost2nights')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Base cost must be a number'),
    check('others.arrivalTime')
        .optional({ checkFalsy: true })
        .toDate(),
    check('others.departureTime')
        .optional({ checkFalsy: true })
        .toDate(),
    check("others.admin")
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Administrator's name must be less than 255 characters")
        .custom(async (value, { req }) => {
            if (value) { // Verifica si se proporciona un valor antes de realizar la validación
                const admin = await Usuario.findOne({ email: value, privilege: "Administrador" });
                if (!admin) {
                    throw new NotFoundError('Administrator does not exist');
                }
            }
            return true;
        }),
    check("others.janitor")
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Janitor's name must be less than 255 characters")
        .custom(async (value, { req }) => {
            if (value) { // Verifica si se proporciona un valor antes de realizar la validación
                const admin = await Usuario.findOne({ email: value, privilege: "Limpieza" });
                if (!admin) {
                    throw new NotFoundError('Janitor does not exist');
                }
            }
            return true;
        }),
];

async function showChaletsData(req, res, next) {
    try {
        const chalets = await Habitacion.find({isActive: true})
        res.send(chalets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

// Vista Alta de Cabañas CREATE_CABINS
async function showChaletsView(req, res, next) {
    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "CREATE_CABINS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para crear cabañas");
        }

        var chalets = await Habitacion.find().lean();
        // chalets = chalets.resources;

        const mapChalets = chalets.map(chalet => {
            return {
                id: chalet._id.toString(),
                name: chalet.propertyDetails.name,
            }
        })


        const admins = await Usuario.find({ privilege: "Administrador" }).lean();
        if (!admins) {
            throw new NotFoundError("No admin found");
        }

        const janitors = await Usuario.find({ privilege: "Limpieza" }).lean();
        if (!janitors) {
            throw new NotFoundError("No janitor found");
        }

        const tipologias = await TipologiasCabana.find().lean();
        if (!tipologias) {
            throw new NotFoundError("No tipologies found");
        }
        

        const owners = await Usuario.find({ privilege: "Dueño de cabañas" }).lean();
        if (!owners) {
            throw new NotFoundError("No owners found");
        }

        const investors = await Usuario.find({ privilege: "Inversionistas" }).lean();
        if (!investors) {
            throw new NotFoundError("No investors found");
        }

        const bosqueImperial = await Usuario.findById("66a7c2f2915b94d6630b67f2").lean();
        owners.push(bosqueImperial);

        const plataformas = await Plataformas.find().lean();

        res.render('vistaCabanas', {
            chalets: mapChalets,
            admins: admins,
            janitors: janitors,
            tipologias: tipologias,
            owners: owners,
            investors: investors,
            plataformas: plataformas
        });
    } catch (error) {
        console.log(error);
        return next(error);
    }
}

async function createChalet(req, res, next) {
    //console.log(req.body);
    
    const { propertyDetails, accommodationFeatures, additionalInfo, accomodationDescription, additionalAccomodationDescription, touristicRate, legalNotice, location, others, images, files, activePlatforms } = req.body;
    
    try {
        const admin = await Usuario.findOne({ email: others.admin, privilege: "Administrador" });
        if (!admin) {
            return next(new BadRequestError("Admin not found"));
        }

        const janitor = await Usuario.findOne({ email: others.janitor, privilege: "Limpieza" });
        if (!janitor) {
            return next(new BadRequestError("Janitor not found"));  ;
        }

        const owner = await Usuario.findOne({ _id: others.owner});
        if (!owner) {
            return next(new BadRequestError("Owner not found"));  ;
        }

        const platforms = await Plataformas.find({ _id: { $in: activePlatforms } });
        if (!platforms) {
            return next(new BadRequestError("Platforms not found"));  ;
        }

        let totalTickets = 0;
        console.log("investors",others.investors);
        if (others.investors.length === 0) {
            totalTickets = 0;
        } else {
            totalTickets = others.investors.reduce((sum, investor) => sum + investor.noTickets, 0);
        }

        
        if (totalTickets !== 0 && totalTickets !== 10) {
            return next(new BadRequestError("El total de tickets de inversionistas debe ser igual a 10."));  ;
        }

        const arrivalTimeHours = parseInt(others.arrivalTimeHours);
        const arrivalTimeMinutes = parseInt(others.arrivalTimeMinutes);
        const departureTimeHours = parseInt(others.departureTimeHours);
        const departureTimeMinutes = parseInt(others.departureTimeMinutes);

        const newArrivalTime = new Date();
        newArrivalTime.setHours(arrivalTimeHours);
        newArrivalTime.setMinutes(arrivalTimeMinutes);
        const newDepartureTime = new Date();
        newDepartureTime.setHours(departureTimeMinutes);
        newDepartureTime.setMinutes(departureTimeHours);

        const chaletToAdd = {
            propertyDetails,
            accommodationFeatures,
            additionalInfo,
            accomodationDescription,
            additionalAccomodationDescription,
            touristicRate,
            legalNotice,
            location,
            others: {
                basePrice: others.basePrice,
                basePrice2nights: others.basePrice2nights,
                baseCost: others.baseCost,
                baseCost2nights: others.baseCost2nights,
                arrivalTime: newArrivalTime,
                departureTime: newDepartureTime,
                admin: admin._id,
                janitor: janitor._id,
                owner: owner._id,
                investors: others.investors
            },
            images,
            files,
            activePlatforms
        };

        
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            return next(new BadRequestError("El usuario no tiene un rol definido, contacte al administrador"))  ;
        }

        const permittedRole = "CREATE_CABINS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            return next(new BadRequestError("El usuario no tiene permiso para crear cabañas"));
        }
        // const chalets = await Habitacion.findOne();
        // chalets.resources.push(chaletToAdd);
        // await chalets.save();

        const newChalet = new Habitacion(chaletToAdd);
        await newChalet.save();

        console.log("Cabaña agregada con éxito");
        req.session.chaletAdded = newChalet.propertyDetails.name;
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'registration',
            acciones: `Cabaña creada por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);
        res.status(200).json({ success: true, message: "Cabaña agregada con éxito " });
    } catch (err) {
        console.log(err);
        return next(err);
    }
}

async function uploadChaletFiles(req, res, next) {
    console.log("entraupload")
    //console.log(req.files);

    const client = new ftp.Client();

    try {
        // const chalets = await Habitacion.findOne();
        
        var chalet = "";
        console.log(req.session)
        if (req.session.chaletAdded) {
            console.log("entra")
            //console.log(req.session.chaletAdded)
            chalet = await Habitacion.findOne({ "propertyDetails.name": req.session.chaletAdded }).lean();
            // chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === req.session.chaletAdded);
            //console.log(chalets)
        } else if (req.session.chaletUpdated) {
            chalet = await Habitacion.findOne({ "propertyDetails.name": req.session.chaletUpdated }).lean();
            // chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === req.session.chaletUpdated);
            console.log("Entra")
        }
        //console.log(chalet)
        if (!chalet) {
            throw new NotFoundError('Chalet does not exists');
        }
        //console.log(req.session)
        await client.access({
            host: 'integradev.site',
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        });


        for (let i = 0; i < req.files.length; i++) {
            //console.log(req.files[i].path);
            const localFilePath = req.files[i].path;
            const remoteFileName = req.session.chaletAdded + '-' + req.files[i].filename;
            await client.uploadFrom(localFilePath, remoteFileName);
            console.log(`Archivo '${remoteFileName}' subido con éxito`);
            //console.log(chalet.images)

            await Habitacion.updateOne(
                { "propertyDetails.name": req.session.chaletAdded || req.session.chaletUpdated },
                { $push: { images: remoteFileName } }
            );


            fs.unlink(localFilePath, (err) => {
                if (err) {
                    console.error('Error al eliminar el archivo local:', err);
                } else {
                    console.log('Archivo local eliminado con éxito');
                }
            });
        }


        console.log("Archivos subidos con éxito");
        res.status(200).json({ success: true, message: "Archivos subidos con éxito" });
    } catch (error) {
        console.log("Error:", error);
    } finally {
        client.close();
    }
}

async function uploadChaletPdf(req, res, next) {
    console.log("entra pdf")
    //console.log(req.files);
    
    const client = new ftp.Client();

    try {
        // const chalets = await Habitacion.find();
        var chalet = "";
        console.log(req.session)
        if (req.session.chaletAdded) {
            chalet = await Habitacion.findOne({ "propertyDetails.name": req.session.chaletAdded });
            // chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === req.session.chaletAdded);
            //console.log(chalets)
        } else if (req.session.chaletUpdated) {
            // chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === req.session.chaletUpdated);
            chalet = await Habitacion.findOne({ "propertyDetails.name": req.session.chaletUpdated });
        }
        //console.log(chalet)
        if (!chalet) {
            throw new NotFoundError('Chalet does not exists');
        }
        //console.log(req.session)
        await client.access({
            host: 'integradev.site',
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        });

        console.log(req.file)
        if (req.file){
            console.log("Entra a req.file")
            const file = req.file;
            const localFilePath = file.path;
            const remoteFileName = req.session.chaletAdded + '-' + file.filename;
            await client.uploadFrom(localFilePath, remoteFileName);
            console.log(`Archivo '${remoteFileName}' subido con éxito`);
            //console.log(chalet.images)
            chalet.files = [];
            chalet.files.push(remoteFileName);
            await chalet.save();

            fs.unlink(localFilePath, (err) => {
                if (err) {
                    console.error('Error al eliminar el archivo local:', err);
                } else {
                    console.log('Archivo local eliminado con éxito');
                }
            });

        }


        


        console.log("Archivos subidos con éxito");
        res.status(200).json({ success: true, message: "Archivos subidos con éxito" });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({ success: false, message: "Error uploading files", error: error.message });
    } finally {
        await client.close();
    }
}

function getFilePathFromUrl(url) {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Eliminar el primer '/' del pathname
}
async function getChaletFiles(chalets) {
    const client = new ftp.Client();

    try {
        await client.access({
            host: 'integradev.site',
            user: 'navarro@navarro.integradev.site',
            password: 'Nav@rro2024',
            secure: false
        });

        for (const chalet of chalets) {
            if (chalet.hasOwnProperty("images")) {
                for (let i = 0; i < chalet.images.length; i++) {
                    const imagePath = chalet.images[i];
                    const localFilePath = `./download/${getImageFileName(imagePath)}`;
                    await client.downloadTo(localFilePath, imagePath);
                }
            }
        }
    } catch (error) {
        console.error('Error downloading images from FTP:', error);
    } finally {
        await client.close();
    }
}

async function getChaletPdf(chalets) {
    const client = new ftp.Client();

    try {
        await client.access({
            host: 'integradev.site',
            user: 'navarro@navarro.integradev.site',
            password: 'Nav@rro2024',
            secure: false
        });

        for (const chalet of chalets) {
            if (chalet.hasOwnProperty("files")) {
                for (let i = 0; i < chalet.files.length; i++) {
                    const imagePath = chalet.files[i];
                    const localFilePath = `./download/${getImageFileName(imagePath)}`;
                    const confirmacion = await client.downloadTo(localFilePath, imagePath);
                    console.log(confirmacion)
                    
                }
            }
        }
    } catch (error) {
        console.error('Error downloading PDF from FTP:', error);
    } finally {
        await client.close();
    }
}

function getImageFileName(imagePath) {
    return imagePath.split('/').pop();
}

// Vista editar cabañas EDIT_CABINS
async function showEditChaletsView(req, res, next) {
    try {
        
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "EDIT_CABINS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para editar cabañas"); 
        }

        var chalets = await Habitacion.find().lean();
        // chalets = chalets.resources;
        for (const chalet of chalets) {
            const admin = await Usuario.findById(chalet.others.admin);
            //console.log("ADMIIIN : ", admin);
            chalet.others.admin = [admin.email, admin.firstName + " " + admin.lastName];
        }
        for (const chalet of chalets) {
            const janitor = await Usuario.findById(chalet.others.janitor);
            chalet.others.janitor = [janitor.email, janitor.firstName + " " + janitor.lastName];
        }
        for (const chalet of chalets) {
            const owner = await Usuario.findById(chalet.others.owner);
            if (!owner) {
                throw new NotFoundError("Owner not found");
            }
            console.log(owner);
            chalet.others.owner = [owner._id, owner.firstName + " " + owner.lastName];
        }
        for (const chalet of chalets) {
            // Convertir arrivalTime a un objeto moment y ajustar a UTC
            let arrivalStr = chalet.others.arrivalTime; // Asume que es un objeto Date
            let arrivalUtc = moment(arrivalStr).utc(); // Ajusta el objeto Date a UTC
            let arrival = arrivalUtc.tz('America/Mexico_City').format("HH:mm"); // Formatear solo hora
            // Convertir departureTime a un objeto moment y ajustar a UTC
            let departureStr = chalet.others.departureTime; // Asume que es un objeto Date
            let departureUtc = moment(departureStr).utc(); // Ajusta el objeto Date a UTC
                
            // Convertir a la zona horaria de 'America/Mexico_City' y extraer solo la hora
            let departure = departureUtc.tz('America/Mexico_City').format("HH:mm"); // Formatear solo hora
    
            chalet.others.arrivalTime = arrival;
            chalet.others.departureTime = departure;
        }
        const admins = await Usuario.find({ privilege: "Administrador" }).lean();
        const janitors = await Usuario.find({ privilege: "Limpieza" }).lean();
        const owners = await Usuario.find({ privilege: "Dueño de cabañas" }).lean();
        const tipologias = await TipologiasCabana.find().lean();
        if (!owners) {
            throw new NotFoundError("No owners found");
        }
        if (!tipologias) {
            throw new NotFoundError("No tipologies found");
        }

        const investors = await Usuario.find({ privilege: "Inversionistas" }).lean();
        if (!investors) {
            throw new NotFoundError("No investors found");
        }

        const bosqueImperial = await Usuario.findById("66a7c2f2915b94d6630b67f2").lean();
        owners.push(bosqueImperial);
        //console.log("CHALETS: ", chalets);
        //console.log("CHALETS2222: ", chalets[0].others.admin[0]);
        //console.log("ADMINS: ", admins);
        //console.log("JANITORS: ", janitors);

        const plataformas = await Plataformas.find().lean();
        console.log("PLATAFORMAS: ", plataformas);

        // This could go on login.
        if (req.session.filesRetrieved !== undefined) {
            getChaletFiles(chalets);
            getChaletPdf(chalets)
            req.session.filesRetrieved = true;
        }
        console.log("Images downloaded successfully ");

        res.render('vistaEditarCabana', {
            chalets: chalets,
            admins: admins,
            janitors: janitors,
            owners: owners,
            tipologias: tipologias,
            investors: investors,
            plataformas: plataformas
        });
    } catch (error) {
        console.error('Error:', error);
        return next(error);
    }
}

async function editChalet(req, res, next) {
    const { propertyDetails, accommodationFeatures, additionalInfo, accomodationDescription, additionalAccomodationDescription, touristicRate, legalNotice, location, others, images, txtChaletId, activePlatforms } = req.body;
    console.log('Entrando a edit chalet');

    console.log(others.admin);

    const adminDbg = await Usuario.findOne({ email: others.admin, privilege: "Administrador" });

    try {
        const [admin, janitor, owner] = await Promise.all([
            Usuario.findOne({ email: others.admin, $or: [{ privilege: "Administrador" }, { privilege: "Dueño de cabañas" }] }),
            Usuario.findOne({ email: others.janitor, privilege: "Limpieza" }),
            Usuario.findOne({ _id: others.owner})
        ]);
        

        if (!admin) throw new NotFoundError("Admin not found");
        if (!janitor) throw new NotFoundError("Janitor not found");
        if (!owner) throw new NotFoundError("Owner not found");

        const platforms = await Plataformas.find({ _id: { $in: activePlatforms } });
        if (!platforms) {
            throw new NotFoundError("Platforms not found");
        }

        let totalTickets = 0;
        console.log("investors",others.investors);
        if (others.investors.length === 0) {
            totalTickets = 0;
        } else {
            totalTickets = others.investors.reduce((sum, investor) => sum + investor.noTickets, 0);
        }

        
        if (totalTickets !== 0 && totalTickets !== 10) {
            return next(new BadRequestError("El total de tickets de inversionistas debe ser igual a 10."));  ;
        }        

        console.log(others.departureTime);
        console.log(others.arrivalTime);
        const newArrivalTime = new Date();
        newArrivalTime.setHours(parseInt(others.arrivalTime.split(':')[0], 10));
        newArrivalTime.setMinutes(parseInt(others.arrivalTime.split(':')[1], 10));
        const newDepartureTime = new Date();
        newDepartureTime.setHours(parseInt(others.departureTime.split(':')[0], 10));
        newDepartureTime.setMinutes(parseInt(others.departureTime.split(':')[1], 10));
        console.log(newDepartureTime);

        console.log('investors: ')
        console.log(others.investors);

        
        const chaletToUpdate = await Habitacion.findById(txtChaletId);
        if (!chaletToUpdate) {
            throw new Error("Chalet not found.")
        }

        const updatedChalet = {
            ...chaletToUpdate.toObject(), // Keep the original document structure
            propertyDetails,
            accommodationFeatures,
            additionalInfo,
            accomodationDescription,
            additionalAccomodationDescription,
            touristicRate,
            legalNotice,
            location,
            others: {
                basePrice: others.basePrice,
                basePrice2nights: others.basePrice2nights,
                baseCost: others.baseCost,
                baseCost2nights: others.baseCost2nights,
                arrivalTime: newArrivalTime,
                departureTime: newDepartureTime,
                admin: admin._id,
                janitor: janitor._id,
                owner: owner._id,
                investors: others.investors
            },
            images,
            activePlatforms
        };

        
        const updateResult = await Habitacion.updateOne({ _id: txtChaletId }, { $set: updatedChalet });
        console.log('Update Result:', JSON.stringify(updateResult, null, 2));
        if (!updateResult.modifiedCount) throw new Error("Failed to update chalet");

        // Log the entire update result for debugging

        console.log("Cabaña actualizada con éxito");
        console.log(req.session)
        req.session.chaletUpdated = updatedChalet.propertyDetails.name;
        console.log("Respuesta del servidor:", { chaletUpdated: req.session.chaletUpdated });

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'modification',
            acciones: `${updatedChalet.propertyDetails.name} modificada por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        };

        await logController.createBackendLog(logBody);

        res.status(200).json({ success: true, message: "Cabaña editada con éxito" });
    } catch (err) {
        console.error('Error en editChalet:', err); // Imprimir el error completo en la consola
        res.status(500).json({ error: 'Ocurrió un error al procesar tu solicitud.' }); // Enviar un mensaje de error conciso al cliente
    }
}

// VIEW_TIME_TREE_CALENDAR
async function renderCalendarPerChalet(req, res, next) {
    try {
        // const habitaciones = await Habitacion.find().lean();
        const privilege = req.session.privilege;
        let habitaciones = [];

        if (privilege === "Vendedor") {
            const assignedChalets = req.session.assignedChalets;
            habitaciones = await Habitacion.find({ _id: assignedChalets, isActive: true }).lean();
        } else {
            habitaciones = await Habitacion.find({ isActive: true }).lean();
        }
        if (!habitaciones) {
            throw new NotFoundError("No hay información de las cabañas o el usuario no tiene cabañas asignadas.");
        }
        const data = habitaciones;

        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "VIEW_TIME_TREE_CALENDAR";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para ver el calendario time tree");
        }
        // console.log(data);


        const chalets = data.map(chalet => ({
            name: chalet.propertyDetails.name,
            basePrice: chalet.others.basePrice,
            pax: chalet.propertyDetails.maxOccupancy,
            tipologia: chalet.propertyDetails.accomodationType,
            id: chalet._id.toString()
        }));

        const clientes = await Cliente.find({}).lean();
        if(!clientes){
            throw new NotFoundError("No client not found");
        }

        const tipologias = await TipologiasCabana.find().lean();
        if (!tipologias) {
            throw new NotFoundError("No tipologies found");
        }
        res.render('calendarPerChalet', {
            chalets: chalets,
            tipologias: tipologias,
            clientes: clientes

        })

    } catch (error) {
        res.status(500).send(error);
    }
}


async function renderCalendarPerChaletOwner(req, res, next) {
    try {
        const privilege = req.session.privilege;
        const duenoId = req.session.id;

        // Find the existing rooms   
        const habitacionesExistentes = await Habitacion.find({ isActive: true }).lean();
        if (!habitacionesExistentes) {
            return res.status(404).send('No rooms found');
        }

        const mDuenoId = new mongoose.Types.ObjectId(duenoId);

        // // Filter the rooms that belong to the owner
        let habitacionesDueno;
        if (privilege === "Inversionistas") {
            habitacionesDueno = habitacionesExistentes.filter(habitacion => {
                // Check if habitacion and investors array exists
                if (!habitacion?.others?.investors) return false;
                
                // Find if current user is an investor
                return habitacion.others.investors.some(investor => 
                    investor?.investor?.toString() === duenoId?.toString()
                );
            });
            if (habitacionesDueno.length === 0) {
                return res.render('errorView', {
                    err: 'No hay cabañas ligadas a este usuario'
                });
            }
        } else if (privilege === "Colaborador dueño") {
            const user = await Usuario.findById(duenoId).lean();
            if (!user) {
                return res.status(404).send('User not found');
            }
            habitacionesDueno = habitacionesExistentes.filter(habitacion =>
                habitacion.others.owner.equals(user.administrator)
            );
        } else {
            habitacionesDueno = habitacionesExistentes.filter(habitacion => habitacion.others.owner.toString() === duenoId);

        }
        // // Extract the IDs and names of the rooms
        const cabañaIds = habitacionesDueno.map(habitacion => habitacion._id.toString());
        const nombreCabañas = habitacionesDueno.map(habitacion => ({ id: habitacion._id.toString(), name: habitacion.propertyDetails.name }));
        
        // const cabañaIdToNameMap = {};
        // nombreCabañas.forEach(cabaña => {
        //     cabañaIdToNameMap[cabaña.id] = cabaña.name;
        // });

        // const documentos = await Documento.findOne().lean();
        // if (!documentos) {
        //     return res.status(404).send('No documents found');
        // }

        // const eventosFiltrados = await Promise.all(documentos.events.filter(evento => cabañaIds.includes(evento.resourceId.toString())))
        // console.log(eventosFiltrados)

        // const habitaciones = await Habitacion.find();
        // if (!habitaciones) {
        //     throw new NotFoundError("No room found");
        // }
        // const data = habitaciones;
        // // console.log(data);

        const chalets = habitacionesDueno.map(chalet => ({
            name: chalet.propertyDetails.name,
            basePrice: chalet.others.basePrice,
            pax: chalet.propertyDetails.maxOccupancy,
            id: chalet._id.toString()
        }));

        console.log(chalets);
        res.render('calendarPerOwnerChalet', {
            chalets: chalets,
            privilege: privilege
            // events: eventosFiltrados

        })

    } catch (error) {
        console.log(error)
        res.status(500).send(error);
    }
}

async function changeChaletStatus(req, res, next) {
    try {
        const { chaletid } = req.query;
        const { status } = req.body;
        const chalet = await Habitacion.findById(chaletid);
        if (!chalet) {
            throw new NotFoundError("No room found");
        }
        if (status !== "Activa" && status !== "Inactiva") {
            throw new BadRequestError("Estatus inválido");
        }
        chalet.isActive = (status === "Activa") ? true : false;
        await chalet.save();
        res.status(200).json({ message: "El estatus de la cabaña fue actualizado correctamente" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    showCreateChaletViewValidators,
    createChaletValidators,
    uploadChaletFilesValidators,
    editChaletValidators,
    showChaletsView,
    createChalet,
    uploadChaletFiles,
    uploadChaletPdf,
    showEditChaletsView,
    editChalet,
    showChaletsData,
    renderCalendarPerChalet,
    renderCalendarPerChaletOwner,
    changeChaletStatus
}
