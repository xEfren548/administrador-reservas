const moment = require('moment');
const Habitacion = require('../models/Habitacion');

/** Función para mapear las propiedades de NyN a Channex */
async function mapProperties(req, res) {
    const Habitaciones = await Habitacion.find({}).lean();

    const mappedHabitaciones = Habitaciones.map((hab) => {
        const { propertyDetails } = hab;
        const { location } = hab;
        return {
            property: {
                "title": propertyDetails.name,
                "currency": "MXN",
                "content": {
                    "description": hab.accomodationDescription
                },
                "email": propertyDetails.email,
                "phone": propertyDetails.phoneNumber,
                "zip_code": location.postalCode ? location.postalCode.toString() : null,
                "country": "MX",
                "timezone": "America/Mexico_City",
                "state": location.state,
                "city": location.population,
                "address": location.address,
                "longitude": location.longitude ? dmsToDecimal(location.longitude) : null,
                "latitude": location.latitude ? dmsToDecimal(location.latitude) : null,
                "group_id": "b5fcd225-d31f-4588-a828-686f7e2b32a4"
            }
        };
    });

    res.json(mappedHabitaciones);
}

function dmsToDecimal(dmsStr) {
    const s = String(dmsStr).replace(/[^\d.]/g, '');
    // separar parte entera y decimales de los segundos
    const [intPart, decPart = ''] = s.split('.');
    // grados = primeros (len-4) dígitos
    const degLen = intPart.length - 4;
    const degrees = parseInt(intPart.slice(0, degLen), 10);
    const minutes = parseInt(intPart.slice(degLen, degLen + 2), 10);
    const seconds = parseInt(intPart.slice(degLen + 2), 10)
        + Number('0.' + decPart);
    return degrees + (minutes / 60) + (seconds / 3600);
}

module.exports = { mapProperties };