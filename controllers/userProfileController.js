const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');
const NotFoundError = require('../common/error/not-found-error');
const BadRequestError = require('../common/error/bad-request-error');
const sendPassword = require("../utils/email");

const {check} = require("express-validator");

// No uuid validator has been implemented for those functions that take parameters form the URL.
const nameValidator = [
    check()
        .custom((value, {req}) => {
            if(!req.session.email){
                throw new BadRequestError('Missing email cookie'); 
            }
            return true;
        }),
    check()
        .custom(async (value, { req }) => {
            const user = await Usuario.findOne({ email: req.session.email });
            if (!user) {
                throw new NotFoundError("User not found");
            }
            return true;
        }),
    check(['firstName', 'lastName'])
        .optional({ checkFalsy: true })
        .isLength({ max: 255 }).withMessage("Full name must be less than 255 characters"),
    check()
        .custom((value, {req}) => {
            const { firstName, lastName} = req.body;
            if (!firstName && !lastName) {
                throw new BadRequestError("Missing info in request");
            }
            return true;
    }),
];

const emailValidator = [
    check()
        .custom((value, {req}) => {
            if(!req.session.email){
                throw new Error('Missing email cookie'); 
            }
            return true;
        }),
    check('oldEmail')
        .notEmpty().withMessage('Old email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const user = await Usuario.findOne({ email: value });
            if (!user) {
                throw new Error('Email not registered');
            }
            return true;
        }),
    check('newEmail', 'confirmNewEmail')
        .notEmpty().withMessage('New email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const user = await Usuario.findOne({ email: value });
            if (user) {
                throw new Error('Email already taken');
            }
            return true;
        }),
    check()
        .custom((value, { req }) => {
            const { oldEmail, newEmail, confirmNewEmail } = req.body;
            if(!oldEmail && !newEmail && !confirmNewEmail){
                throw new BadRequestError("Missing information in request");
            }
            if (oldEmail !== req.session.email) {
                throw new BadRequestError('Given email does not match your current email');
            }
            if (newEmail === oldEmail) {
                throw new BadRequestError('New email must be different than old one');
            }
            if (confirmNewEmail !== newEmail) {
                throw new BadRequestError('Confirm new email');
            }
            return true;
        })
];

const passwordValidator = [
    check()
        .custom((value, {req}) => {
            if(!req.session.email){
                throw new BadRequestError('Missing email cookie'); 
            }
            return true;
        }),
    check()
        .custom(async (value, { req }) => {
            const user = await Usuario.findOne({ email: req.session.email });
            if (!user) {
                throw new NotFoundError("User not found");
            }
            return true;
        }),
    check(['oldPassword', 'newPassword', 'confirmNewPassword'])
        .notEmpty().withMessage('Password is required'),
        /*
        .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
        */
    check()
        .custom(async (value, {req}) => {
            const { oldPassword, newPassword, confirmNewPassword } = req.body;
            if(!oldPassword && !newPassword && !confirmNewPassword){
                throw new BadRequestError("Missing information in request");
            }
            const user = await Usuario.findOne({ email: req.session.email });
            const passwordMatch = await bcrypt.compare(oldPassword, user.password);
            if (!passwordMatch) {
                throw new BadRequestError("That's not your current password");
            }
            if (newPassword === oldPassword) {
                throw new BadRequestError("New password must be different");
            }
            if (newPassword !== confirmNewPassword) {
                throw new BadRequestError("Confirm passwords");
            }
            return true;
        }),
];

async function showUserProfile(req, res, next) {
    console.log(req.session)
    res.render("vistaPerfilUsuario", {
        req: req
    });
}

async function updateUserFullName(req, res, next) {
    const email = req.session.email;
    const { firstName, lastName} = req.body;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }
    
    try{
        const userToUpdate = await Usuario.findOneAndUpdate({email }, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        if (firstName) { req.session.firstName = updateFields.firstName; }
        if (lastName) { req.session.lastName = updateFields.lastName; }
        
        res.status(200).json({ success: true, message: "Nombre editado con éxito" });
    } catch(err){
        return next(err);
    }    
}

// Maybe this function is not completely necessary.
async function updateUserFullNameById(req, res, next) {
    const { uuid } = req.params;
    const { firstName, lastName } = req.body;
    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; } 
    
    try{
        const userToUpdate = await Usuario.findByIdAndUpdate(uuid,updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        if (firstName) { req.session.firstName = updateFields.firstName; }
        if (lastName) { req.session.lastName = updateFields.lastName; }

        res.status(200).json({ userToUpdate });
    } catch(err){
        return next(err);
    }
}

async function updateUserEmail(req, res, next) {
    const { oldEmail, confirmNewEmail} = req.body;   
    const updateFields = {
        email: confirmNewEmail
    };  

    try{
        const userToUpdate = await Usuario.findOneAndUpdate({ email:oldEmail }, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        req.session.email = updateFields.email;

        sendPassword(userToUpdate.email, userToUpdate.password, userToAdd.privilege)

    
        res.status(200).json({ success: true, message: "Email editado con éxito" });
    } catch(err){
        return next(err);
    }
}

// Maybe this function is not completely necessary.
async function updateUserEmailById(req, res, next) {
    const { uuid } = req.params;
    const { confirmNewEmail} = req.body;
    const updateFields = {
        email: confirmNewEmail
    };
    
    try{
        const userToUpdate = await Usuario.findByIdAndUpdate(uuid,updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        req.session.email = updateFields.email;
        
        console.log("Editaste tu dirección con éxito");
        res.status(200).json({ userToUpdate });
    } catch(err){
        return next(err);
    }
}

async function updateUserPassword(req, res, next) {
    const email = req.session.email;
    const { newPassword } = req.body;

    try{
        const userToUpdate = await Usuario.findOne({ email });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        userToUpdate.password = newPassword;
        await userToUpdate.save();
    
        res.status(200).json({ success: true, message: "Contraseña editada con éxito" });
    } catch(err){
        return next(err);
    }
}

// Maybe this function is not completely necessary.
async function updateUserPasswordById(req, res, next) {
    const { uuid } = req.params;
    const { newPassword } = req.body;
    
    try{
        const userToUpdate = await Usuario.findById(uuid);
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        user.password = newPassword;
        await user.save();

        console.log("Contraseña actualizada con éxito");
        res.status(200).json({ message: "Contraseña actualizada con éxito" });
    } catch(err){
        return next(err);
    }
}

async function updateProfileImage(req, res) {
    const userId = req.session.id;
    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }

        const user = await Usuario.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        await client.access({
            host: 'integradev.site',
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        });

        const file = req.files.profileImage;
        console.log(file)
        const localFilePath = file.path;
        console.log(localFilePath)
        const remoteFileName = `profile_${userId}.jpg`;

        await client.uploadFrom(localFilePath, remoteFileName);
        console.log(`Archivo '${remoteFileName}' subido con éxito`);

        user.profileImageUrl = `https://navarro.integradev.site/navarro/${remoteFileName}`;

        fs.unlink(localFilePath, (err) => {
            if (err) {
                console.error('Error al eliminar el archivo local:', err);
            } else {
                console.log('Archivo local eliminado con éxito');
            }
        });

        res.status(200).send("Profile image updated successfully.");
    } catch (error) {
        res.status(500).json({ message: error.message });
    } finally {
        client.close();
    }
}

module.exports = {
    nameValidator,
    emailValidator,
    passwordValidator,
    showUserProfile,
    updateUserFullName,
    updateUserFullNameById,
    updateUserEmail,
    updateUserEmailById,
    updateUserPassword,
    updateUserPasswordById,
    updateProfileImage
}