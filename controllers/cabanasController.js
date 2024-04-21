const jwt = require("jsonwebtoken");
const Habitacion = require('../models/Habitacion');
const NotFoundError = require("../common/error/not-found-error");
const BadRequestError = require("../common/error/bad-request-error");
const {check} = require("express-validator");
const ftp = require('basic-ftp');
const bcrypt = require('bcrypt');

const createChaletValidators = [
    // propertyDetails validations.
    check('propertyDetails.accomodationType')
        .notEmpty().withMessage('Accommodation type is required')
        .isLength({ max: 255 }).withMessage("Accomodation type must be less than 255 characters")
        .isIn(['Habitación', 'Cabaña']).withMessage('Invalid accomodation type'),
    check('propertyDetails.name')
        .notEmpty().withMessage('Name is required')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']+$/).withMessage("Invalid property name format")
        .isLength({ max: 255 }).withMessage("Name must be less than 255 characters"),
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
        .notEmpty().withMessage('Legal notice is required')
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

async function createChalet(req, res, next) {
    console.log(req.body);

    const { propertyDetails, accommodationFeatures, additionalInfo, accomodationDescription, additionalAccomodationDescription, touristicRate, legalNotice, location, images} = req.body;
    
    const chaletToAdd = {
        propertyDetails, 
        accommodationFeatures, 
        additionalInfo, 
        accomodationDescription, 
        additionalAccomodationDescription, 
        touristicRate, 
        legalNotice, 
        location, 
        images
    };

    try{ 
        const chalets = await Habitacion.findOne();
        chalets.resources.push(chaletToAdd);
        await chalets.save();
        
        console.log("Cabaña agregada con éxito");
        req.session.chaletAdded = chalets.resources[chalets.resources.length - 1].propertyDetails.name;
        console.log("Respuesta del servidor:", { chaletAdded: req.session.chaletAdded });
        res.status(200).json({ success: true });
    } catch(err){
        console.log(err);
        return next(err);
    }
}

async function uploadChaletFiles(req, res, next) {
    console.log(req.files);

    const client = new ftp.Client();

    try {
        await client.access({
            host: 'integradev.site',
            user: 'navarro@integradev.site',
            password: 'Nav@rro2024',
            secure: false
        });

        await client.cd('cabanas-navarro');
        for (let i = 0; i < req.files.length; i++) {
            const localFilePath = req.files[i].path;
            //const remoteFileName = req.files[i].filename;
            const remoteFileName = await bcrypt.hash(req.session.chaletAdded, 10) + '-' + req.files[i].filename;
            await client.uploadFrom(localFilePath, remoteFileName);
            console.log(`Archivo '${remoteFileName}' subido con éxito`);
        }

        console.log("Archivos subidos con éxito");
        res.status(200).json( { message: "Archivos subidos con éxito" } );
    } catch (error) {
        console.error("Error:", error);
    } finally {
        delete req.session.chaletAdded;
        await client.close();
    }
}

module.exports = {
    createChaletValidators,
    uploadChaletFilesValidators,
    createChalet,
    uploadChaletFiles
}