// middlewares/sessionFromToken.js
import jwt from 'jsonwebtoken';
import Usuario from './../../models/Usuario.js';

export async function sessionFromToken(req, res, next) {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

        console.log(token);

        if (!token) {
            req.session = null;
            return next();
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        const payload = jwt.verify(token, JWT_SECRET); // lanza si inválido/expirado

        // Opción A (rápida): construir session SOLO con el payload
        // req.session = {
        //   token, // opcional
        //   userId: payload.sub,
        //   email: payload.email,
        //   privilege: payload.privilege,
        //   role: payload.role,
        //   // assignedChalets: payload.assignedChalets || [],
        // };

        // Opción B (más “fiel” a tu session original): reconsultar DB para traer TODO
        const user = await Usuario.findById(payload.id).lean();
        if (!user) {
            req.session = null;
            return res.status(401).json({ message: 'Invalid user' });
        }

        req.session = {
            token, // útil si en algún sitio lo reenvías
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            privilege: user.privilege,
            id: user._id,
            userId: user._id.toString(),
            profileImageUrl: user.profileImageUrl ?? null,
            role: user.role,
            assignedChalets: user.assignedChalets ?? [],
        };

        // (Opcional) alias común:
        req.user = req.session;

        return next();
    } catch (err) {
        // Si el token es inválido/expiró, deja la session en null
        req.session = null;
        return res.status(401).json({ message: 'Unauthorized' });
    }
}
