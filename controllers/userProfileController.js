const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const NotFoundError = require('../common/error/not-found-error');
const BadRequestError = require('../common/error/bad-request-error');

async function showUserProfile(req, res, next) {
    res.render("vistaPerfilUsuario", {
        layout: 'userProfile',
        req: req
    });
}

async function updateUserFullName(req, res, next) {
    const email = req.session.email;
    const { firstName, lastName} = req.body;

    console.log(email);
    console.log(req.body);

    if (!email || (!firstName && !lastName)) {
        return next(new BadRequestError("Missing info in request"));
    }

    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }

    try {
        const userToUpdate = await Usuario.findOneAndUpdate({ email }, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        if (firstName) { req.session.firstName = updateFields.firstName; }
        if (lastName) { req.session.lastName = updateFields.lastName; }
        console.log("Editaste tu información con éxito");
        res.status(200).json({ userToUpdate });
    
    } catch(err) {
        return next(err);
    }
}

// Maybe this function is not completely necessary.
async function updateUserFullNameById(req, res, next) {
    const { uuid } = req.params;
    const { firstName, lastName } = req.body;

    if (!uuid || (!firstName && !lastName)) {
        return next(new BadRequestError("Missing info in URL or request"));
    }

    const updateFields = {};
    if (firstName) { updateFields.firstName = firstName; }
    if (lastName) { updateFields.lastName = lastName; }

    try {
        const userToUpdate = await Usuario.findByIdAndUpdate(uuid, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        req.session.email = updateFields.email;
        console.log("Usuario editado con éxito");
        res.status(200).json({ userToUpdate });

    } catch(err) {
        return next(err);
    }
}

async function updateUserEmail(req, res, next) {
    const email = req.session.email;
    const { oldEmail, newEmail, confirmNewEmail} = req.body;

    console.log(email);
    console.log(req.body);

    if (!email || !oldEmail || !newEmail || !confirmNewEmail) {
        return next(new BadRequestError("Missing info in session cookie or request"));
    }

    if(oldEmail != email || newEmail == oldEmail || confirmNewEmail != newEmail){
        return next(new BadRequestError("Bad email"));
    }
    
    const updateFields = {
        email: confirmNewEmail
    };    

    try {
        const userToUpdate = await Usuario.findOneAndUpdate({ email: oldEmail }, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        req.session.email = updateFields.email;
        console.log("Editaste tu dirección con éxito");
        res.status(200).json({ userToUpdate });

    } catch(err) {
        return next(err);
    }
}

// Maybe this function is not completely necessary.
async function updateUserEmailById(req, res, next) {
    const email = req.session.email;
    const { uuid } = req.params;
    const { oldEmail, newEmail, confirmNewEmail} = req.body;

    if (!email || !oldEmail || !newEmail || !confirmNewEmail) {
        return next(new BadRequestError("Missing info in session cookie request"));
    }

    if(oldEmail != email || newEmail == oldEmail || confirmNewEmail != newEmail){
        return next(new BadRequestError("Bad email"));
    }

    const updateFields = {
        email: confirmNewEmail
    };

    try {
        const userToUpdate = await Usuario.findByIdAndUpdate(uuid, updateFields, { new: true });
        if (!userToUpdate) {
            throw new NotFoundError("User not found");
        }

        req.session.email = updateFields.email;
        console.log("Editaste tu dirección con éxito");
        res.status(200).json({ userToUpdate });

    } catch (err) {
        return next(err);
    }
}

async function updateUserPassword(req, res, next) {
    const { email } = req.session;
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    console.log(email);
    console.log(req.body);

    if (!email || !oldPassword || !newPassword || !confirmNewPassword) {
        return next(new BadRequestError("Missing info in session cookie or request"));
    }

    try {
        const user = await Usuario.findOne({ email });
        if (!user) {
            throw new NotFoundError("User not found");
        }

        const passwordMatch = await bcrypt.compare(oldPassword, user.password);
        if (!passwordMatch) {
            return next(new BadRequestError("Incorrect password"));
        }

        if (newPassword === oldPassword) {
            return next(new BadRequestError("Passwords must be different"));
        }

        if (newPassword !== confirmNewPassword) {
            return next(new BadRequestError("Different passwords"));
        }

        user.password = newPassword;
        await user.save();

        console.log("Contraseña actualizada con éxito");
        res.status(200).json({ message: "Contraseña actualizada con éxito" });

    } catch (err) {
        return next(err);
    }
}

// Maybe this function is not completely necessary.
async function updateUserPasswordById(req, res, next) {
    const { uuid } = req.params;
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    if (!uuid || !oldPassword || !newPassword || !confirmNewPassword) {
        return next(new BadRequestError("Missing info in URL or request"));
    }

    try {
        const user = await Usuario.findById(uuid);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        const passwordMatch = await bcrypt.compare(oldPassword, user.password);
        if (!passwordMatch) {
            return next(new BadRequestError("Incorrect password"));
        }

        if (newPassword === oldPassword) {
            return next(new BadRequestError("Passwords must be different"));
        }

        if (newPassword !== confirmNewPassword) {
            return next(new BadRequestError("Differente passwords"));
        }

        user.password = newPassword;
        await user.save();

        console.log("Contraseña actualizada con éxito");
        res.status(200).json({ message: "Contraseña actualizada con éxito" });

    } catch (err) {
        return next(err);
    }
}

module.exports = {
    showUserProfile,
    updateUserFullName,
    updateUserFullNameById,
    updateUserEmail,
    updateUserEmailById,
    updateUserPassword,
    updateUserPasswordById
}