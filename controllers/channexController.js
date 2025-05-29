const moment = require('moment');
const axios = require('axios');
const Habitacion = require('../models/Habitacion');
const AirbnbChannel = require('../models/AirbnbChannel');

// Configuración de Channex API
const CHANNEX_BASE_URL = process.env.NODE_ENV === 'development' ? process.env.DEV_CHANNEX_API_URL : process.env.CHANNEX_BASE_URL;
const USER_API_KEY = process.env.CHANNEX_USER_API_KEY;

const channex = axios.create({
    baseURL: CHANNEX_BASE_URL,
    headers: {
        'user-api-key': USER_API_KEY,
        'Content-Type': 'application/json'
    }
});


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

async function webhookReceptor(req, res) {
    try {
        console.log(req.body);
        // const event = req.body.data[0];
        const event = req.body;

        const { id: liveFeedId, attributes } = event;
        const { event: eventType } = attributes;

        let payload;
        if (eventType === 'inquiry') {
            // Pre-approval por defecto (bloquea instant booking)
            payload = { resolution: { type: 'preapproval', block_instant_booking: true } };
        } else if (eventType === 'reservation_request') {
            // Aceptar reserva regularmente
            payload = { resolution: { accept: 'accept' } };
        } else if (eventType === 'alteration_request') {
            // Aceptar alteración
            payload = { resolution: { accept: 'accept' } };
        } else if (eventType === 'test') {
            // Aceptar reserva regularmente
            payload = { resolution: { accept: 'accept' } };
        } else {
            return res.status(400).send('Evento no reconocido');
        }

        await channex.post(`/api/v1/live_feed/${liveFeedId}/resolve`, payload);
        res.status(200).send('OK');
    } catch (err) {
        console.error('Webhook error:', err.response ? err.response.data : err.message);
        res.status(500).send('Error al procesar evento');
    }
}

async function airbnbConnection(req, res) {
    const { properties, minStayType, groupId, redirect_uri, token, state } = req.query;
    try {
        let propsParam;
        if (typeof properties === 'string') {
            // ya es JSON válido
            propsParam = properties;
        } else {
            // si viniera como array, lo serializamos
            propsParam = JSON.stringify(properties);
        }
        const params = {
            properties: propsParam,
            min_stay_type: minStayType,
            group_id: groupId,
            redirect_uri: redirect_uri,
            token,
            state
        }
        console.log(CHANNEX_BASE_URL)
        console.log("params", params)
        const response = await channex.get('/api/v1/meta/airbnb/connection_link', {
            params: {
                properties: propsParam,
                min_stay_type: minStayType,
                group_id: groupId,
                redirect_uri: redirect_uri,
                token
            }
        });
        const { url } = response.data.data.attributes;
        // res.redirect(url);
        res.json({ url });
    } catch (err) {
        console.error('Error obteniendo connection link:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: 'No se pudo obtener el enlace de conexión' });
    }
}

async function oauthAirbnb(req, res) {
    const { channel_id, token: internalUserId, success } = req.query;

    if (success !== 'true') {
        return res.status(400).send('Conexión fallida');
    }

    try {
        // 1) Obtener tokens desde Channex
        const resp = await channex.get(`/api/v1/channels/${channel_id}`);

        const settings = resp.data.data.attributes.settings;
        const { access_token, refresh_token, expires_at, user_id: airbnbUserId } = settings.tokens;

        // 2) Guardar (upsert) en Mongo
        await AirbnbChannel.findOneAndUpdate(
            { channelId: channel_id },
            {
                internalUserId,
                accessToken: access_token,
                refreshToken: refresh_token,
                // expires_at es UNIX timestamp en segundos
                expiresAt: new Date(expires_at * 1000),
                airbnbUserId
            },
            { upsert: true, new: true }
        );

        // 3) Notificar éxito al usuario
        return res.send('Airbnb conectado exitosamente');
    } catch (err) {
        console.error('Error guardando OAuth Airbnb:', err.response?.data || err.message);
        return res.status(500).json({ error: 'No se pudo guardar la conexión' });
    }
}

async function mapPropertiesAirbnb(req, res) {
    const { channelId } = req.params;
    const mappingData = req.body; // { property_id, listing_id, price_mapping?, ... }
    try {
        const response = await channex.post(`/api/v1/channels/${channelId}/mappings`, mappingData);
        res.json(response.data);
    } catch (err) {
        console.error('Error en mapeo:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: 'Fallo en la creación de mapeo' });
    }
}

async function activateChannel(req, res) {
    const { channelId } = req.params;
    try {
        const response = await channex.post(`/api/v1/channels/${channelId}/activate`);
        res.json(response.data);
    } catch (err) {
        console.error('Error activando canal:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: 'No se pudo activar el canal' });
    }
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

module.exports = {
    mapProperties,
    webhookReceptor,
    airbnbConnection,
    oauthAirbnb,
    mapPropertiesAirbnb,
    activateChannel
};