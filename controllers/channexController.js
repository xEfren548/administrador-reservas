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

async function getChannexProperties(channelId) {
    try {
        const propiedades = await Habitacion.find().lean();
        const resp = await channex.get(`/api/v1/channels/${channelId}/action/listings`);
        // const chProps = resp.data.data.relationships.properties.data.map((prop) => prop.id);
        // const chProps = resp.data.data.relationships.properties.data;
        const chProps = resp.data.data.listing_id_dictionary.values;
        console.log(chProps)
        // return resp.data;
        return { propiedades, chProps };

    } catch (err) {
        console.error('Error al obtener propiedades de Channex:', err.response ? err.response.data : err.message);
        return err;
    }
}

async function showCreatedPropertiesAirbnb(req, res) {
 // 1. Obtén propiedades locales
        const propiedades = await Habitacion.find().lean();

        // 2. Llama a Channex para traer las propiedades dadas de alta (opciones)
        const resp = await channex.get('/api/v1/properties/options');
        // Ajusta el path según la estructura real del response de tu API Channex
        const channexOptions = resp.data.data; // [{id, ...}, ...]

        const channexIds = channexOptions.map(opt => opt.id);

        // 3. Marca si existe realmente en Channex
        const propiedadesMarcadas = propiedades.map(hab => ({
            ...hab,
            existeEnChannex: hab.channexPropertyId ? channexIds.includes(hab.channexPropertyId) : false
        }));

        // 4. Renderiza la vista channexProperties (usa el nombre de archivo .hbs correcto)
        res.render('channexProperties', { propiedades: propiedadesMarcadas });
}

async function dashboardChannexFull(req, res) {
    if (!req.session.channelId) return res.redirect('/api/channex/home?error=Debe+conectar+Airbnb');
    try {
        // 1. Trae todas las propiedades locales
        const propiedades = await Habitacion.find().lean();

        // 2. Trae los IDs válidos de propiedades en Channex
        const respChannex = await channex.get('/api/v1/properties/options');
        const channexOptions = respChannex.data.data;
        const channexIds = channexOptions.map(opt => opt.id);


        // 4. Trae listings de Airbnb (todos los disponibles)
        const respListings = await channex.get(`/api/v1/channels/${req.session.channelId}/action/listings`);
        const chProps = respListings.data.data.listing_id_dictionary.values;
        // console.log(chProps)

        // 3. Limpia propiedades que ya no existen en Channex
        for (const hab of propiedades) {
            if (hab.channexPropertyId && !channexIds.includes(hab.channexPropertyId)) {
                await Habitacion.updateOne(
                    { _id: hab._id },
                    { $unset: { channexPropertyId: "", isMapped: "" } }
                );
                hab.channexPropertyId = undefined;
                hab.isMapped = undefined;
            }
            if (hab.airbnbListingId) {
                const listingObj = chProps.find(l => l.id === hab.airbnbListingId);
                console.log(listingObj)
                if (listingObj.synchronization_category === null || !listingObj) {
                    await Habitacion.updateOne(
                        { _id: hab._id },
                        { $unset: { airbnbListingId: "" } }
                    );
                    hab.airbnbListingId = undefined;
                    
                }
            }
        }

        // 5. Tarifas (rate plans)
        const respRates = await channex.get('/api/v1/rate_plans');
        const ratePlans = respRates.data.data;


        // 7. Marca cada propiedad con flags útiles y mapping de listing
        const propiedadesMarcadas = propiedades.map(hab => {
            const existeEnChannex = hab.channexPropertyId && channexIds.includes(hab.channexPropertyId);

            // Tarifa
            let tarifa = null;
            if (hab.channexPropertyId) {
                const foundRate = ratePlans.find(
                    r => r.relationships.property.data.id === hab.channexPropertyId
                );
                if (foundRate) {
                    tarifa = {
                        id: foundRate.id,
                        title: foundRate.attributes.title,
                        currency: foundRate.attributes.currency
                    };
                }
            }

            // Busca si está mapeado a un listing de Airbnb
            // Si guardas el listingId en Mongo ponlo aquí. Si no, opcionalmente puedes agregar lógica para hacerlo.
            let listingId = hab.airbnbListingId || null;
            let nombreListingAirbnb = null;

            // Si el property está mapeado, busca por el ID de property si tienes esa relación guardada, o simplemente deja "listingId"
            if (listingId) {
                const listingObj = chProps.find(l => l.id === listingId);
                if (listingObj) nombreListingAirbnb = listingObj.title + ' (' + listingObj.id + ')';
                else nombreListingAirbnb = listingId;
            }

            return {
                ...hab,
                existeEnChannex,
                tarifa,
                listingId,
                nombreListingAirbnb
            };
        });

        // console.log(propiedadesMarcadas);

        // 7. Para cada listing, busca la habitación que lo tenga asignado
        const listingsMarcados = chProps.map(listing => {
            const habitacionVinculada = propiedadesMarcadas.find(h => h.listingId === listing.id);

            const flag = Boolean(habitacionVinculada);

            // Ajusta 'nombreHabitacion' al campo que use tu modelo Habitacion para mostrar el nombre
            const habitacionNombre = habitacionVinculada
                ? (habitacionVinculada.propertyDetails.name || habitacionVinculada._id)
                : null;

            return {
                id: listing.id,
                title: listing.title,
                habitacionNombre,
                listed: flag
            };
        });

        res.render('dashboardChannex', {
            propiedades: propiedadesMarcadas,
            chProps,
            listings: listingsMarcados
        });

    } catch (err) {
        console.error('Error en dashboardChannexFull:', err.response?.data || err.message);
        return res.redirect('/api/channex/home?error=Error+inesperado+obteniendo+propiedades');
    }
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
        req.session.channelId = channel_id;
        // return res.send('Airbnb conectado exitosamente');
        return res.redirect('/api/channex/dashboard');
    } catch (err) {
        console.error('Error guardando OAuth Airbnb:', err.response?.data || err.message);
        return res.status(500).json({ error: 'No se pudo guardar la conexión' });
    }
}

async function mapPropertiesAirbnb(req, res) {
    const { channelId } = req.params; // En realidad es el property_id
    const propertyId = channelId;
    const channelIdSession = req.session.channelId
    const mappingData = req.body; // { property_id, listing_id, price_mapping?, ... }
    try {
        const habitacion = await Habitacion.findOne({ channexPropertyId: propertyId });
        if (!habitacion) {
            return res.status(404).json({ message: 'No se encontró una habitacion con ese ID de channex' });
        }
        console.log("channel id: ", channelId)
        console.log("mapping data: ", mappingData)
        const response = await channex.post(`/api/v1/channels/${channelIdSession}/mappings`, mappingData);

        habitacion.airbnbListingId = mappingData.mapping.settings.listing_id;
        await habitacion.save();
        res.json(response.data);
    } catch (err) {

        if (err.response?.data?.errors?.details) {
            console.log('Error en mapeo 1:', err.response.data.errors.details);
            const details = err.response.data.errors.details;
            // Convertimos a string, venga como objeto o como otro tipo
            const msg = (typeof details === 'object')
                ? JSON.stringify(details)
                : String(details);
            return res.status(400).json({ message: msg });
        } else {
            console.error('Error en mapeo:', err.response ? err.response.data : err.message);

        }
        // console.log(err.response)
        // console.log(err.message)
        res.status(500).json({ message: 'Fallo en la creación de mapeo' });
    }
}

async function createChannexProperty(req, res) {
    const { id } = req.params;

    try {
        // 1) Obtener la habitación desde Mongo
        const hab = await Habitacion.findById(id);
        if (!hab) {
            return res.status(404).json({ error: 'Habitación no encontrada' });
        }

        if (hab.isMapped) {
            return res.status(400).json({ error: 'La habitación ya fue mapeada' });
        }

        // 2) Armar el payload para Channex
        const {
            propertyDetails,
            accomodationDescription: description,
            location
        } = hab;

        const propertyPayload = {
            property: {
                title: propertyDetails.name,
                currency: 'MXN',
                content: { description },
                email: propertyDetails.email,
                phone: propertyDetails.phoneNumber,
                zip_code: location.postalCode ? location.postalCode.toString() : null,
                country: 'MX',
                timezone: 'America/Mexico_City',
                state: location.state,
                city: location.population,
                address: location.address,
                longitude: location.longitude ? dmsToDecimal(location.longitude) : null,
                latitude: location.latitude ? dmsToDecimal(location.latitude) : null,
                group_id: 'b5fcd225-d31f-4588-a828-686f7e2b32a4'
            }
        };

        // 3) Enviar a Channex
        const response = await channex.post('/api/v1/properties', propertyPayload);

        hab.channexPropertyId = response.data.data.id;
        hab.isMapped = true;
        await hab.save();

        // 4) Devolver respuesta al cliente
        return res.json(response.data);

    } catch (err) {
        console.error('Error mapeando propiedad a Channex:', err.response?.data || err.message);
        return res.status(500).json({ error: 'Error al mapear propiedad en Channex' });
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

// Rooms and Rates

async function createRoomChannex(req, res) {
    try {
        const pmsId = req.query.pmsid;
        console.log(pmsId)
        const habitacion = await Habitacion.findById(pmsId);
        if (!habitacion) {
            return res.status(404).json({ error: 'Habitación no encontrada' });
        }
        req.body.room_type.occ_adults = habitacion.propertyDetails.maxOccupancy;
        req.body.room_type.default_occupancy = habitacion.propertyDetails.maxOccupancy;
        const resp = await channex.post('/api/v1/room_types', req.body);
        console.log(resp.data)
        res.json(resp.data);
    } catch (err) {
        console.error('Error al crear habitación en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }
}

async function createRateChannex(req, res) {
    try {
        const resp = await channex.post('/api/v1/rate_plans', req.body);
        res.json(resp.data);
    } catch (err) {
        console.error('Error al crear tarifa en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
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
    getChannexProperties,
    dashboardChannexFull,
    showCreatedPropertiesAirbnb,
    createChannexProperty,
    webhookReceptor,
    airbnbConnection,
    oauthAirbnb,
    mapPropertiesAirbnb,
    activateChannel,
    createRoomChannex,
    createRateChannex
};