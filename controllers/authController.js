const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Usuario = require('../models/Usuario');
const BadRequestError = require("../common/error/bad-request-error");
const { check } = require("express-validator");

const validators = [
    check('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const user = await Usuario.findOne({ email: value });
            if (!user) {
                throw new Error('Email not registered');
            }
            return true;
        }),
    check('password')
        .notEmpty().withMessage('Password is required')
        /*
        .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character')
        */
        .custom(async (value, { req }) => {
            const user = await Usuario.findOne({ email: req.session.email });
            const passwordMatch = await bcrypt.compare(value, user.password);
            if (!passwordMatch) {
                throw new BadRequestError("Wrong password");
            }
            return true;
        }),
];

async function login(req, res, next) {
    const { email, password } = req.body;
    console.log("Login attempt with email:", email);

    try {
        const user = await Usuario.findOne({ email });
        if (!user) {
            return next(new BadRequestError("Wrong credentials"));
        }

        const pwdEqual = await bcrypt.compare(password, user.password);
        if (!pwdEqual) {
            return next(new BadRequestError("Wrong credentials"));
        }

        // Generating authentiation token.
        const token = jwt.sign({ email, userId: user._id }, "secret_key", { expiresIn: "5h" });

        // Saving user's cookies.
        req.session = {
            token,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            privilege: user.privilege,
            id: user._id,
            privilege: user.privilege,
            userId: user._id.toString(),
            profileImageUrl: user.profileImageUrl,
            role: user.role,
            assignedChalets: user.assignedChalets
        };

        console.log("Usuario logeado con éxito");
        // Uncomment the following line in order to test it on the browser.
        console.log(req.session);
        const redirectToCalendar = ['Administrador', 'Vendedor']
        const redirectToTheirChalets = ['Dueño de cabañas', 'Colaborador de dueño de cabañas']
        const redirectToUtilities = ['Inversionistas', 'Limpieza', 'Servicios adicionales']

        const userPrivilege = req.session.privilege;

        if (redirectToCalendar.includes(userPrivilege)) {
            res.redirect('/');
        } else if (redirectToTheirChalets.includes(userPrivilege)) {
            res.redirect('/api/calendar/duenos')
        } else if (redirectToUtilities.includes(userPrivilege)) {
            res.redirect('/api/mostrar-utilidades')
        } else {
            res.redirect('/api/dashboard');

        }


        // Uncomment the following line in order to test it on Postman.
        //res.status(200).json( req.session );
    } catch (err) {
        return next(err);
    }
}

async function loginToken(req, res, next) {
    const { email, password } = req.body;
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) throw new Error('Missing JWT_SECRET');

        const user = await Usuario.findOne({ email }).lean();
        if (!user) {
            return res.status(401).json({ message: 'Wrong credentials' });
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return res.status(401).json({ message: 'Wrong credentials' });
        }

        // Solo lo mínimo indispensable dentro del token (sub, email, roles)
        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                role: user.role,
                privilege: user.privilege,
                profileImageUrl: user.profileImageUrl,
                firstName: user.firstName,
                lastName: user.lastName,
                // Puedes incluir assignedChalets si lo consultan MUCHO en cada request
                assignedChalets: user.assignedChalets ?? [],
            },
            JWT_SECRET,
            { expiresIn: '7d', algorithm: 'HS256' }
            // { expiresIn: '1m', algorithm: 'HS256' }
        );

        // Respuesta compatible con tu app actual (solo token).
        // Si quieres, añade "user" para precargar datos en memoria (no obligatorio).
        return res.json({
            token,
            // user: {
            //   id: user._id,
            //   firstName: user.firstName,
            //   lastName: user.lastName,
            //   email: user.email,
            //   privilege: user.privilege,
            //   role: user.role,
            //   assignedChalets: user.assignedChalets ?? [],
            //   profileImageUrl: user.profileImageUrl ?? null,
            // },
        });
    } catch (err) {
        return next(err);
    }
}

async function logout(req, res, next) {
    req.session = null;
    console.log("Successfully logged out")
    res.redirect('/login');
}

module.exports = {
    validators,
    login,
    loginToken,
    logout
}


