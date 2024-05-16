const jwt = require("jsonwebtoken");
const Habitacion = require('../models/Habitacion');
const NotFoundError = require("../common/error/not-found-error");
const BadRequestError = require("../common/error/bad-request-error");
const {check} = require("express-validator");
const ftp = require('basic-ftp');
const Usuario = require("../models/Usuario");
const fs = require('fs');

const showCreateChaletViewValidators = [
    check()
        .custom(async (value, { req }) => {
            const admin = await Usuario.findOne({privilege: "Administrador"});
            if(!admin){
                throw new NotFoundError('No administrator found');
            }
            return true;
        }),
    check()
        .custom(async (value, { req }) => {
            const admin = await Usuario.findOne({privilege: "Limpieza"});
            if(!admin){
                throw new NotFoundError('No janitor found');
            }
            return true;
        }),
];

const createChaletValidators = [
    // propertyDetails validations.
    check('propertyDetails.accomodationType')
        .notEmpty().withMessage('Accommodation type is required')
        .isLength({ max: 255 }).withMessage("Accomodation type must be less than 255 characters")
        .isIn(['Habitación', 'Cabaña']).withMessage('Invalid accomodation type'),
    check('propertyDetails.name')
        .notEmpty().withMessage('Name is required')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid property name format")
        .isLength({ max: 255 }).withMessage("Name must be less than 255 characters")
        .custom(async (value, { req }) => {
            const chalets = await Habitacion.findOne();
            const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === value);
            if(chalet){
                throw new NotFoundError('Chalet name already taken');
            }
            return true;
        }),
    check('propertyDetails.phoneNumber')
        .notEmpty().withMessage('Phone is required')
        .matches(/^\+?[0-9]{10,15}$/).withMessage('Invalid phone number format')
        .isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 digits'),
    check('propertyDetails.email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const chalets = await Habitacion.findOne();
            const chalet = chalets.resources.find(chalet => chalet.propertyDetails.email === value);
            if(chalet){
                throw new NotFoundError('Chalet email already taken');
            }
            return true;
        }),
    check('propertyDetails.website')
        .notEmpty().withMessage('Website is required')
        .isLength({ max: 255 }).withMessage("Name must be less than 255 characters"),
    check('propertyDetails.minOccupancy')
        .notEmpty().withMessage('Minimum occupancy is required')
        .isNumeric().withMessage('Minimum occupancy must be a number'),
    check('propertyDetails.maxOccupancy')
        .notEmpty().withMessage('Maximum occupancy is required')
        .isNumeric().withMessage('Maximum occupancy must be a number'),
    check('propertyDetails.tourLicense')
        .notEmpty().withMessage('Tour license is required'),

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
    check('additionalInfo.capacity')
        .notEmpty().withMessage('Capacity is required')
        .isNumeric().withMessage('Capacity must be a number'),
    check('additionalInfo.extraCleaningCost')
        .notEmpty().withMessage('Extra cleaning cost is required')
        .isNumeric().withMessage('Extra cleaning cost must be a number'),

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
    check('location.weatherWidget')
        .notEmpty().withMessage('Weather widget is required'),
    check('location.iFrame')
        .notEmpty().withMessage('iFrame is required'),

    // accomodationDescription validations.
    check('accomodationDescription')
        .notEmpty().withMessage('Accommodation description is required'),

    // additionalAccomodationDescription validations.
    check('additionalAccomodationDescription')
        .notEmpty().withMessage('Additional accommodation description is required'),

    // touristicRate validations.
    check('touristicRate')
        .notEmpty().withMessage('Touristic rate is required'),

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
            const admin = await Usuario.findOne({email: value, privilege: "Administrador"});
            if(!admin){
                throw new NotFoundError('Administrator does not exist');
            }
            return true;
        }),
    check("others.janitor")
        .notEmpty().withMessage("Janitor's name is required")
        .isLength({ max: 255 }).withMessage("Janitor's name must be less than 255 characters")
        .custom(async (value, { req }) => {
            const admin = await Usuario.findOne({email: value, privilege: "Limpieza"});
            if(!admin){
                throw new NotFoundError('Janitor does not exist');
            }
            return true;
        }),
];

const uploadChaletFilesValidators = [
    check()
    .custom(async (value, { req }) => {
        if(!req.files){
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
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid property name format")
        .isLength({ max: 255 }).withMessage("Name must be less than 255 characters")
        .custom(async (value, { req }) => {
            if (value) { // Verifica si se proporciona un valor antes de realizar la validación
                const chalets = await Habitacion.findOne();
                const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === value);
                if(!chalet){
                    throw new NotFoundError('Chalet not found');
                }
            }
            return true;
        }),
    check('propertyDetails.phoneNumber')
        .optional({ checkFalsy: true })
        .matches(/^\+?[0-9]{10,15}$/).withMessage('Invalid phone number format')
        .isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 digits'),
    check('propertyDetails.email')
        .optional({ checkFalsy: true })
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            if (value) { // Verifica si se proporciona un valor antes de realizar la validación
                const chalets = await Habitacion.findOne();
                const chalet = chalets.resources.find(chalet => chalet.propertyDetails.email === value);
                if(!chalet){
                    throw new NotFoundError('Chalet email not found');
                }
            }
            return true;
        }),
    check('propertyDetails.website')
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Name must be less than 255 characters"),
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
    check('additionalInfo.capacity')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Capacity must be a number'),
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
    check('location.weatherWidget')
        .optional({ checkFalsy: true }),
    check('location.iFrame')
        .optional({ checkFalsy: true }),

    // accomodationDescription validations.
    check('accomodationDescription')
        .optional({ checkFalsy: true }),

    // additionalAccomodationDescription validations.
    check('additionalAccomodationDescription')
        .optional({ checkFalsy: true }),

    // touristicRate validations.
    check('touristicRate')
        .optional({ checkFalsy: true }),

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
                const admin = await Usuario.findOne({email: value, privilege: "Administrador"});
                if(!admin){
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
                const admin = await Usuario.findOne({email: value, privilege: "Limpieza"});
                if(!admin){
                    throw new NotFoundError('Janitor does not exist');
                }
            }
            return true;
        }),
];

async function showChaletsData(req, res, next){
    try {
        const chalets = await Habitacion.find();
        res.send(chalets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

async function showChaletsView(req, res, next){
    try {  
        const admins = await Usuario.find({privilege: "Administrador"}).lean();
        if (!admins) {
            throw new NotFoundError("No admin found");
        }

        const janitors = await Usuario.find({privilege: "Limpieza"}).lean();
        if (!janitors) {
            throw new NotFoundError("No janitor found");
        }

        res.render('vistaCabanas', {
            admins: admins,
            janitors: janitors
        });
    } catch (error) {
        console.log(error);
        return next(error);
    }
}

async function createChalet(req, res, next) {
    //console.log(req.body);

    const { propertyDetails, accommodationFeatures, additionalInfo, accomodationDescription, additionalAccomodationDescription, touristicRate, legalNotice, location, others} = req.body;
    console.log(req.body);
    
    const admin = await Usuario.findOne({email: others.admin, privilege: "Administrador"});
    if (!admin) {
        throw new NotFoundError("Admin not found");
    }

    const janitor = await Usuario.findOne({email: others.janitor, privilege: "Limpieza"});
    if (!janitor) {
        throw new NotFoundError("Janitor not found");
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
        }
    };

    try{ 
        const chalets = await Habitacion.findOne();
        chalets.resources.push(chaletToAdd);
        await chalets.save();
        
        console.log("Cabaña agregada con éxito");
        req.session.chaletAdded = chalets.resources[chalets.resources.length - 1].propertyDetails.name;
        console.log("Respuesta del servidor:", { chaletAdded: req.session.chaletAdded });

        res.status(200).json({ success: true, message: "Cabaña agregada con éxito "});
    } catch(err){
        console.log(err);
        return next(err);
    }
}

async function uploadChaletFiles(req, res, next) {
    //console.log("entraupload")
    //console.log(req.files);

    const client = new ftp.Client();

    try {
        const chalets = await Habitacion.findOne();
        var chalet = "";
        if (req.session.chaletAdded){
            //console.log("entra")
            //console.log(req.session.chaletAdded)
            chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === req.session.chaletAdded);
            //console.log(chalets)
        }else if (req.session.chaletUpdated){
            chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === req.session.chaletUpdated);
        }
        //console.log(chalet)
        if(!chalet){
            throw new NotFoundError('Chalet does not exists');
        }
        //console.log(req.session)
        await client.access({
            host: 'integradev.site',
            user: 'navarro@navarro.integradev.site',
            password: 'Nav@rro2024',
            secure: false
        });

        for (let i = 0; i < req.files.length; i++) {
            //console.log(req.files[i].path);
            const localFilePath = req.files[i].path;
            const remoteFileName = req.session.chaletAdded + '-' + req.files[i].filename;
            await client.uploadFrom(localFilePath, remoteFileName);
            console.log(`Archivo '${remoteFileName}' subido con éxito`);
            //console.log(chalet.images)
            chalet.images.push(remoteFileName);
            await chalets.save();

            fs.unlink(localFilePath, (err) => {
                if (err) {
                    console.error('Error al eliminar el archivo local:', err);
                } else {
                    console.log('Archivo local eliminado con éxito');
                }
            });
        }

        console.log("Archivos subidos con éxito");
        res.status(200).json( { success: true, message: "Archivos subidos con éxito" } );
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
    }
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

        for(const chalet of chalets){
            if(chalet.hasOwnProperty("images")){
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

function getImageFileName(imagePath) {
    return imagePath.split('/').pop();
}

async function showEditChaletsView(req, res, next){
    try {
        var chalets = await Habitacion.findOne().lean();
        chalets = chalets.resources;
        console.log(chalets);
        for(const chalet of chalets){
            const admin = await Usuario.findById(chalet.others.admin); 
            console.log("ADMIIIN : ", admin);
            chalet.others.admin = [admin.email, admin.firstName + " " + admin.lastName];
        }
        for(const chalet of chalets){
            const janitor = await Usuario.findById(chalet.others.janitor); 
            chalet.others.janitor = [janitor.email, janitor.firstName + " " + janitor.lastName];
        }
        const admins = await Usuario.find({privilege: "Administrador"}).lean();
        const janitors = await Usuario.find({privilege: "Limpieza"}).lean();
        //console.log("CHALETS: ", chalets);
        //console.log("CHALETS2222: ", chalets[0].others.admin[0]);
        //console.log("ADMINS: ", admins);
        //console.log("JANITORS: ", janitors);
        
        // This could go on login.
        if(req.session.filesRetrieved !== undefined){
            getChaletFiles(chalets);
            req.session.filesRetrieved = true; 
        }
        console.log("Images downloaded successfully ");

        res.render('vistaEditarCabana', {
            chalets: chalets,
            admins: admins,
            janitors: janitors
        });
    } catch (error) {
        console.error('Error:', error);
        return next(error);
    }
}

async function editChalet(req, res, next){
    const { propertyDetails, accommodationFeatures, additionalInfo, accomodationDescription, additionalAccomodationDescription, touristicRate, legalNotice, location, others,images} = req.body;

    //console.log("imagenes" + images.imagesarray);
    //console.log(propertyDetails.name);
    const admin = await Usuario.findOne({email: others.admin, privilege: "Administrador"});
    if (!admin) {
        throw new NotFoundError("Admin not found");
    }
    const janitor = await Usuario.findOne({email: others.janitor, privilege: "Limpieza"});
    if (!janitor) {
        throw new NotFoundError("Janitor not found");
    }
    
    const newArrivalTime = new Date();
    newArrivalTime.setHours(parseInt(others.arrivalTime.split(':')[0], 10));
    newArrivalTime.setMinutes(parseInt(others.arrivalTime.split(':')[1], 10));
    const newDepartureTime = new Date();
    newDepartureTime.setHours(parseInt(others.departureTime.split(':')[0], 10));
    newDepartureTime.setMinutes(parseInt(others.departureTime.split(':')[1], 10));

    const chalet = {
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
        },
        images
    };

    try{ 
        const habitacion = await Habitacion.findOne();
        let chalets = habitacion.resources;
    
        const indexToUpdate = chalets.findIndex(chalet => chalet.propertyDetails.name === propertyDetails.name);
        if (indexToUpdate === -1) {
            throw new NotFoundError("Chalet not found");
        }
        chalets[indexToUpdate] = chalet;    

        await Habitacion.findOneAndUpdate({}, { resources: chalets });

        console.log("Cabaña actualizada con éxito");
        req.session.chaletUpdated = chalets[indexToUpdate].propertyDetails.name;
        console.log("Respuesta del servidor:", { chaletUpdated: req.session.chaletUpdated });

        res.status(200).json({ success: true, message: "Cabaña ediatda con éxito"});
    } catch(err){
        console.log(err);
        return next(err);
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
    showEditChaletsView,
    editChalet,
    showChaletsData
}