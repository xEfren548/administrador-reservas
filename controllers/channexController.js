const moment = require('moment');
const axios = require('axios');
const Habitacion = require('../models/Habitacion');
const Reservas = require('../models/Evento');
const AirbnbChannel = require('../models/AirbnbChannel');
const PrecioBaseXDia = require('../models/PrecioBaseXDia');
const Plataformas = require('../models/Plataformas');
const BloqueoFechas = require('../models/BloqueoFechas');
const utilidadesController = require('../controllers/utilidadesController');
const Documento = require('../models/Evento');
const pagoController = require('./pagoController');

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

        // 3. Trae listings de Airbnb (todos los disponibles)
        const respListings = await channex.get(`/api/v1/channels/${req.session.channelId}/action/listings`);
        const chProps = respListings.data.data.listing_id_dictionary.values;

        // 4. Limpia propiedades que ya no existen en Channex
        for (const hab of propiedades) {
            // Si channels no existe, inicialízalo para evitar errores
            // if (!hab.channels) hab.channels = {};

            // Channex property cleanup
            if (hab.channexPropertyId && !channexIds.includes(hab.channexPropertyId)) {
                await Habitacion.updateOne(
                    { _id: hab._id },
                    { $unset: { "channexPropertyId": "" }, }
                    // { $unset: { channexPropertyId: "", isMapped: "" } }
                );
                hab.channexPropertyId = undefined;
            }

            // const canal = hab.channels.find(channel => channel.channelId === req.session.channelId);

            // Airbnb listing cleanup
            // if (hab.channels.airbnbListingId) {
            //     const listingObj = chProps.find(l => l.id === hab.channels.airbnbListingId);
            //     if (!listingObj || listingObj.synchronization_category === null) {
            //         await Habitacion.updateOne(
            //             { _id: hab._id },
            //             { $unset: { "channels.airbnbListingId": "" } }
            //         );
            //         hab.channels.airbnbListingId = undefined;
            //     }
            // }
        }

        // 5. Tarifas (rate plans)
        const respRates = await channex.get('/api/v1/rate_plans');
        const ratePlans = respRates.data.data;

        // 6. Marca cada propiedad con flags útiles y mapping de listing
        const propiedadesMarcadas = propiedades.map(hab => {
            // Si channels no existe, inicialízalo para evitar errores
            // if (!hab.channels) hab.channels = {};

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
            // let listingId = hab.channels?.listingId || null;
            // let nombreListingAirbnb = null;
            let listingsChannel = [];

            if (Array.isArray(hab.channels)) {
                hab.channels.forEach(channel => {
                    if (channel.listingId) {
                        const listingObj = chProps.find(l => l.id === channel.listingId);
                        if (listingObj) {
                            listingsChannel.push(`${listingObj.title} (${listingObj.id})`);
                        } else {
                            listingsChannel.push(channel.listingId);
                        }
                    }
                })
            }

            return {
                ...hab,
                existeEnChannex,
                tarifa,
                listingsChannel
            };
        });

        // 7. Para cada listing, busca la habitación que lo tenga asignado
        const listingsMarcados = chProps.map(listing => {
            // Buscar una habitación que tenga este listingId en cualquiera de sus canales
            const habitacionVinculada = propiedadesMarcadas.find(hab => {
                return Array.isArray(hab.channels) &&
                    hab.channels.some(canal => canal.listingId === listing.id);
            });

            const flag = Boolean(habitacionVinculada);

            const habitacionNombre = habitacionVinculada
                ? (habitacionVinculada.propertyDetails?.name || habitacionVinculada._id)
                : null;

            return {
                id: listing.id,
                title: listing.title,
                habitacionNombre,
                listed: flag
            };
        });


        // console.log(propiedadesMarcadas[0])
        res.render('dashboardChannex', {
            propiedades: propiedadesMarcadas,
            chProps,
            listings: listingsMarcados,
            channelId: req.session.channelId
        });

    } catch (err) {
        console.error('Error en dashboardChannexFull:', err.response?.data || err.message);
        return res.redirect('/api/channex/home?error=Error+inesperado+obteniendo+propiedades');
    }
}

async function dashboardBooking(req, res) {
    try {
        // 1. Trae todas las habitaciones
        const propiedades = await Habitacion.find().lean();

        // 2. Limpia channexPropertyId que ya no existan en Channex
        const respChannex = await channex.get('/api/v1/properties/options');
        const channexIds = respChannex.data.data.map(opt => opt.id);
        for (const hab of propiedades) {
            if (hab.channexPropertyId && !channexIds.includes(hab.channexPropertyId)) {
                await Habitacion.updateOne(
                    { _id: hab._id },
                    { $unset: { channexPropertyId: "" } }
                );
                hab.channexPropertyId = undefined;
            }
        }

        // 5. Tarifas (rate plans)
        const respRates = await channex.get('/api/v1/rate_plans');
        const ratePlans = respRates.data.data;

        // console.log(ratePlans)

        // 3. Marca cada habitación según su propio canal de Booking
        const propiedadesMarcadas = propiedades.map(hab => {
            const existeEnChannex = Boolean(hab.channexPropertyId);

            // Tarifa
            let tarifa = null;
            if (hab.channexPropertyId) {
                console.log(ratePlans.map(r => console.log(r.relationships.room_type.data.id)))
                const foundRate = ratePlans.find(r =>
                    //r => r.relationships.property.data.id === hab.channexPropertyId
                    hab.channels.some(c => c.roomListingId === r.relationships.room_type.data.id)
                );
                if (foundRate) {
                    tarifa = {
                        id: foundRate.id,
                        title: foundRate.attributes.title,
                        currency: foundRate.attributes.currency
                    };
                    console.log(tarifa)
                }
            }

            // Busca en hab.channels el canal tipo Booking.com
            const bookingChannel = Array.isArray(hab.channels)
                ? hab.channels.find(c => c.channel === 'BookingCom')
                : null;

            // Si existe el canal y la habitación ya está creada en Channex
            const mapeadoBooking = Boolean(bookingChannel && existeEnChannex);

            return {
                ...hab,
                existeEnChannex,
                tarifa,
                mapeadoBooking,
                bookingChannelId: bookingChannel?.channelId
            };
        });

        // 4. Renderiza el template con el estado de mapeo de Booking
        res.render('dashboardBooking', {
            propiedades: propiedadesMarcadas
        });

    } catch (err) {
        console.error('Error en dashboardBooking:', err.response?.data || err.message);
        return res.redirect('/api/channex/home?error=Error+inesperado+obteniendo+propiedades+Booking');
    }
}

async function webhookReceptor(req, res) {
    try {
        console.log(req.body);
        // const event = req.body.data[0];
        const body = req.body;
        const eventType = body.event;

        let payload;
        if (eventType === 'booking_new') {
            // Pre-approval por defecto (bloquea instant booking)
            // payload = { resolution: { type: 'preapproval', block_instant_booking: true } };
            // Aceptar reserva regularmente

            const booking_id = body.payload.booking_id;
            const nNights = body.payload.count_of_nights;

            console.log("Aceptando reserva regularmente");

            const response = await channex.get(`/api/v1/bookings/${booking_id}`);
            const data = response.data.data.attributes;
            console.log(JSON.stringify(data, null, 2));

            const propertyId = data.property_id;
            const listingId = data.meta.listing_id;
            const bookingId = data.booking_id;
            const channelId = data.channel_id;
            const ota_name = data.ota_name;

            const habitacion = await Habitacion.findOne({ 'channexPropertyId': propertyId });
            if (!habitacion) {
                return res.status(404).json({ message: 'No se encontró una habitacion con ese ID de channex' });
            }

            const canal = habitacion.channels.find(channel => channel.listingId === listingId);
            if (!canal) {
                return res.status(404).json({ message: 'No se encontró un canal con ese ID' });
            }

            const arrivalDate = data.arrival_date;
            const departureDate = data.departure_date;
            const reservationDate = data.inserted_at;

            const customerName = data.customer.name;
            const customerSurname = data.customer.surname || '';
            const customerFullName = customerName + ' ' + customerSurname;
            const customerPhone = data.customer.phone || null;
            const customerMail = data.customer.email || null;

            const rooms = data.rooms[0];
            const adults = rooms.occupancy.adults || 0;
            const children = rooms.occupancy.children || 0;
            const infants = rooms.occupancyinfants || 0;
            const totalGuests = adults + children + infants;

            const nights = nNights;
            // const amount = data.amount;
            const amount = body.payload.amount;

            const resourceId = habitacion._id;
            const isDeposit = false;
            const createdBy = habitacion.others.admin;
            const maxOccupation = habitacion.propertyDetails.maxOccupancy;

            const channelInfo = {
                ota_name,
                propertyId,
                listingId,
                channelId,
                bookingId
            }


            const reservaPayload = {
                resourceId,
                arrivalDate,
                departureDate,
                maxOccupation,
                pax: totalGuests,
                nNights: nights,
                total: amount,
                isDeposit,
                createdBy,
                reservationDate,
                propertyId,
                customerFullName,
                customerPhone,
                customerMail,
                channelInfo
            };
            const eventController = require('../controllers/eventController');
            const reservaPms = await eventController.createOTAReservation(reservaPayload);

            if (!reservaPms.success) {
                throw new Error(reservaPms.message);
            }

            const { reserva } = reservaPms;

            const { costoBase, precioBase } = await calcularCostoBaseTotal(habitacion, reserva.arrivalDate, reserva.departureDate);
            console.log("COSTO BASE: " + costoBase);
            const utilidadesInfo = {
                idReserva: reserva._id,
                arrivalDate: reserva.arrivalDate,
                nNights: reserva.nNights,
                chaletName: habitacion.propertyDetails.name,
                costoBase: costoBase,
                totalSinComisiones: precioBase,
                totalPagado: amount
            }

            const crearUtilidades = utilidadesController.generarComisionOTA(utilidadesInfo);
            if (crearUtilidades instanceof Error) {
                throw new Error(crearUtilidades.message);
            }

            res.status(200).send(reserva);


        } else if (eventType === 'booking_cancellation') {
            const bookingId = body.payload.booking_id;

            const reserva = await Reservas.findOne({ 'channels.bookingId': bookingId });
            if (!reserva) {
                console.log(`No se encontró la reserva con el airbnbBookingId ${bookingId} en la base de datos.`);
                throw new Error('La reserva no fue encontrada');
            }

            console.log("Reserva a cancelar: ", reserva)

            const idReserva = reserva._id;

            const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(idReserva);

            // const pagos = await pagoController.obtenerPagos(idReserva);
            // let pagoTotal = 0
            // pagos.forEach(pago => {
            //     pagoTotal += pago.importe;
            // })

            for (const comisiones of comisionesReserva) {
                const utilidadEliminada = await utilidadesController.eliminarComisionReturn(comisiones._id);
                if (utilidadEliminada) {
                    console.log('Utilidad eliminada correctamente');
                } else {
                    throw new Error('Error al eliminar comision.');
                }
            }

            reserva.status = 'cancelled';
            const confirmacion = await reserva.save();

            if (!confirmacion) {
                throw new Error('Error al cancelar reserva');
            }

            res.status(200).send("Reserva cancelada correctamente");


            // Actualizar disponibilidad y cancelar reservacion en PMS

        } else if (eventType === 'booking_modification') {
            const bookingId = body.payload.booking_id;

            const reserva = await Reservas.findOne({ 'channels.bookingId': bookingId });
            if (!reserva) {
                console.log(`No se encontró la reserva con el airbnbBookingId ${bookingId} en la base de datos.`);
                throw new Error('La reserva no fue encontrada');
            }

            console.log("Reserva a modificar: ", reserva)

            const reservationId = reserva._id;

            const response = await channex.get(`/api/v1/bookings/${bookingId}`);
            const data = response.data.data.attributes;

            const ota_name = data.ota_name;
            const listingId = data.meta.listing_id;
            const propertyId = body.payload.propertyId;

            const habitacion = await Habitacion.findById(reserva.resourceId);
            if (!habitacion) {
                console.log(`No se encontró la habitación en la base de datos.`);
            }

            const nNights = body.payload.count_of_nights;
            const arrivalDate = data.arrival_date;
            const departureDate = data.departure_date;
            const newPrice = body.payload.amount;

            const infoReserva = {
                reservationId,
                nNights,
                arrivalDate,
                departureDate,
                newPrice
            }

            const infoSession = {
                id: reserva.createdBy,
                firstName: ota_name
            }

            const eventController = require('../controllers/eventController');
            const eventoEditado = await eventController.editarEventoBackend(infoReserva, infoSession);

            const { costoBase, precioBase } = await calcularCostoBaseTotal(habitacion, eventoEditado.arrivalDate, eventoEditado.departureDate);

            const utilidadesInfo = {
                idReserva: eventoEditado._id,
                arrivalDate: eventoEditado.arrivalDate,
                nNights: eventoEditado.nNights,
                chaletName: habitacion.propertyDetails.name,
                costoBase: costoBase,
                totalSinComisiones: precioBase,
                totalPagado: newPrice
            }
            const nuevasComisiones = await utilidadesController.generarComisionOTA(utilidadesInfo);

            res.status(200).send(eventoEditado);

        } else if (eventType === 'test') {
            // Aceptar reserva regularmente
            payload = { resolution: { accept: 'accept' } };
        } else {
            return res.status(400).send('Evento no reconocido');
        }

        // await channex.post(`/api/v1/live_feed/${liveFeedId}/resolve`, payload);
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
        const habitacion = await Habitacion.findOne({ "channexPropertyId": propertyId });
        if (!habitacion) {
            return res.status(404).json({ message: 'No se encontró una habitacion con ese ID de channex' });
        }

        const response = await channex.post(`/api/v1/channels/${channelIdSession}/mappings`, mappingData);

        const canal = habitacion.channels.find(channel => channel.channelId === channelIdSession);
        if (!canal) {
            return res.status(404).json({ message: 'No se encontró un canal con ese ID' });
        }
        canal.listingId = mappingData.mapping.settings.listing_id;
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

        if (hab.channexPropertyId) {
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
        const habitacion = await Habitacion.findById(pmsId);
        if (!habitacion) {
            return res.status(404).json({ error: 'Habitación no encontrada' });
        }

        const plataformas = await Plataformas.find({
            _id: { $in: habitacion.activePlatforms }
        });

        if (!plataformas || plataformas.length === 0) {
            throw new Error('La habitación no tiene plataformas activas. Activala desde Editar Cabaña');
        }
        req.body.room_type.occ_adults = habitacion.propertyDetails.maxOccupancy;
        req.body.room_type.default_occupancy = habitacion.propertyDetails.maxOccupancy;

        const sameChannel = habitacion.channels.find(channel => channel.channelId === req.session.channelId);
        if (sameChannel) return res.status(400).json({ error: 'La habitación ya fue mapeada en este canal' });

        const resp = await channex.post('/api/v1/room_types', req.body);

        habitacion.channels.push({
            channelId: req.session.channelId,
            roomListingId: resp.data.data.attributes.id
        })

        // habitacion.channels.roomListingId = resp.data.data.attributes.id;
        await habitacion.save();
        res.json(resp.data);
    } catch (err) {
        console.error('Error al crear habitación en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }
}
async function createBookingRoom(req, res) {
    try {
        const pmsId = req.query.pmsid;
        const ota_name = req.query.ota_name;
        const habitacion = await Habitacion.findById(pmsId);
        if (!habitacion) {
            return res.status(404).json({ error: 'Habitación no encontrada' });
        }
        let plataformas = []
        if (ota_name) {
            plataformas = await Plataformas.find({
                nombre: ota_name.toUpperCase()
            });
        }

        if (!plataformas || plataformas.length === 0) {
            throw new Error('La habitación no tiene plataformas activas. Activala desde Editar Cabaña');
        }
        req.body.room_type.occ_adults = habitacion.propertyDetails.maxOccupancy;
        req.body.room_type.default_occupancy = habitacion.propertyDetails.maxOccupancy;

        const resp = await channex.post('/api/v1/room_types', req.body);

        if (Array.isArray(habitacion.channels)) {
            habitacion.channels.push({
                roomListingId: resp.data.data.attributes.id
            })
        }

        // habitacion.channels.roomListingId = resp.data.data.attributes.id;
        await habitacion.save();
        res.json(resp.data);
    } catch (err) {
        if (err.response?.data?.errors?.details?.title) {
            console.log('Error en mapeo 1:', err.response.data.errors.details);
            return res.status(400).json({ error: err.response?.data?.errors?.details?.title[0] });
        }
        console.error('Error al crear room en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }
}

async function createRateBooking(req, res) {
    try {
        const pmsId = req.query.pmsid;
        const roomId = req.body.rate_plan.room_type_id;
        const habitacion = await Habitacion.findById(pmsId);
        if (!habitacion) {
            return res.status(404).json({ error: 'Habitación no encontrada' });
        }
        if (!habitacion.channexPropertyId || habitacion.channels.length === 0)
            throw new Error('La habitación no está creada en Channex');

        const resp = await channex.post('/api/v1/rate_plans', req.body);
        const canal = habitacion.channels.find(channel => channel.roomListingId === roomId);
        if (!canal) {
            throw new Error('No se pudo encontrar el canal');
        }

        canal.rateListingId = resp.data.data.attributes.id;
        await habitacion.save();

        //const updatePrices = await updateChannexPrices(pmsId, "Booking");
        //const updateAvailability = await updateChannexAvailability(pmsId);
        //const createWebhook = await createPropertyWebhook(habitacion.channexPropertyId);
        //if (!updatePrices || !updateAvailability) {
        //    throw new Error('No se pudo actualizar precios o disponibilidad');
        //}
        res.json(resp.data);
    } catch (err) {
        console.error('Error al crear tarifa en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }
}
async function createRateChannex(req, res) {
    try {
        const pmsId = req.query.pmsid;
        const channelId = req.session.channelId;
        const habitacion = await Habitacion.findById(pmsId);
        if (!habitacion) {
            return res.status(404).json({ error: 'Habitación no encontrada' });
        }
        if (!habitacion.channexPropertyId || habitacion.channels.length === 0)
            throw new Error('La habitación no está creada en Channex');

        const resp = await channex.post('/api/v1/rate_plans', req.body);
        const canal = habitacion.channels.find(channel => channel.channelId === channelId);
        if (!canal) {
            throw new Error('No se pudo encontrar el canal');
        }

        canal.rateListingId = resp.data.data.attributes.id;
        await habitacion.save();

        const updatePrices = await updateChannexPrices(pmsId);
        const updateAvailability = await updateChannexAvailability(pmsId);
        const createWebhook = await createPropertyWebhook(habitacion.channexPropertyId);
        if (!updatePrices || !updateAvailability) {
            throw new Error('No se pudo actualizar precios o disponibilidad');
        }
        res.json(resp.data);
    } catch (err) {
        console.error('Error al crear tarifa en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }
}

async function updateChannexPrices(habitacionId, ota_name = null) {
    // 0) Validaciones básicas
    const habitacion = await Habitacion.findById(habitacionId);
    if (!habitacion) throw new Error('Habitación no encontrada');
    if (!habitacion.channexPropertyId || habitacion.channels.length === 0)
        throw new Error('La habitación no está mapeada en Channex (falta channels.channexPropertyId)');

    const propertyId = habitacion.channexPropertyId;
    const defaultPrice = habitacion.others.basePrice2nights;


    const comisiones = await utilidadesController.calcularComisionesOTA()
    console.log("comisiones OTA", comisiones)

    // 1) Fechas: desde hoy hasta 1 año después
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    // 2) Cargar plataformas activas
    let plataformas = []
    if (ota_name) {
        plataformas = await Plataformas.find({
            nombre: ota_name.toUpperCase()
        });

        if (!plataformas || plataformas.length === 0) {
            throw new Error(`No se encontraron plataformas con el nombre ${ota_name}`);
        }
    } else {
        plataformas = await Plataformas.find({
            _id: { $in: habitacion.activePlatforms }
        });
    }

    if (!plataformas || plataformas.length === 0) {
        throw new Error('La habitación no tiene plataformas activas. Activala desde Editar Cabaña');
    }

    console.log("plataformas", plataformas)

    // 3) Traer todos los registros de PrecioBaseXDia
    const priceRecords = await PrecioBaseXDia
        .find({ habitacionId: habitacion._id })
        .sort({ fecha: 1 });

    // 4) Construir el array de valores para el payload
    const values = [];

    const canales = habitacion.channels

    for (const canal of canales) {
        for (const plat of plataformas) {
            const daily = [];
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const iso = d.toISOString().slice(0, 10);
                const rec = priceRecords.find(r =>
                    r.fecha.toISOString().slice(0, 10) === iso
                );
                const base = rec ? rec.precio_base_2noches : defaultPrice;
                let price = base;
                if (plat.aumentoFijo != null) {
                    price += plat.aumentoFijo;
                } else if (plat.aumentoPorcentual != null) {
                    price = Math.round(base * (1 + plat.aumentoPorcentual / 100));
                }
                price += comisiones
                daily.push({ date: iso, price });
            }

            // Agrupar en rangos de precio igual
            let curr = null;
            for (const { date, price } of daily) {
                if (!curr || curr.rate !== price) {
                    if (curr) {
                        values.push({
                            property_id: propertyId,
                            rate_plan_id: canal.rateListingId,
                            date_from: curr.start,
                            date_to: curr.end,
                            rate: curr.rate * 100
                        });
                    }
                    curr = { start: date, end: date, rate: price };
                } else {
                    curr.end = date;
                }
            }
            if (curr) {
                values.push({
                    property_id: propertyId,
                    rate_plan_id: canal.rateListingId,
                    date_from: curr.start,
                    date_to: curr.end,
                    rate: curr.rate * 100
                });
            }
        }

    }

    const payload = { values };
    const response = await channex.post('/api/v1/restrictions', payload);

    // Siempre regresa fecha límite usada
    return {
        data: response.data,
        fechaLimite: endDate.toISOString().slice(0, 10)
    };
}

async function updateChannexAvailability(habitacionId) {
    // 0) Validaciones básicas
    const habitacion = await Habitacion.findById(habitacionId);
    if (!habitacion) throw new Error('Habitación no encontrada');
    if (!habitacion.channexPropertyId || habitacion.channels.length === 0) {
        throw new Error('La habitación debe estar mapeada en Channex (channels.channexPropertyId) y tener roomListingId');
    }

    const propertyId = habitacion.channexPropertyId;
    // const roomTypeId = canal.roomListingId;

    // 1) Rango: hoy hasta 1 año después
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Un día antes, para dar margen
    const marginDate = new Date(today);
    marginDate.setDate(marginDate.getDate() - 1);

    const endDate = new Date(today);
    endDate.setFullYear(endDate.getFullYear() + 1);

    // 2) Traer bloqueos y reservas
    let bloqueos = await BloqueoFechas
        .find({ habitacionId: habitacion._id, type: 'bloqueo' })
        .sort({ date: 1 });

    const reservas = await Reservas.find({
        resourceId: habitacion._id,
        arrivalDate: { $lte: endDate }, // Reservas que terminan antes del fin de rango
        departureDate: { $gte: marginDate }, // Reservas que empiezan después del margen
        status: { $nin: ['cancelled', 'no-show'] }
    });

    // 4) Generar set de fechas no disponibles (bloqueos + reservas)
    const noDisponibles = new Set(
        bloqueos.map(b => {
            const d = new Date(b.date);
            d.setHours(0, 0, 0, 0);
            return d.toISOString().slice(0, 10);
        })
    );
    // Marca todas las fechas de cada reserva como no disponibles
    for (const reserva of reservas) {
        let curr = new Date(reserva.arrivalDate);
        curr.setHours(0, 0, 0, 0);
        const checkout = new Date(reserva.departureDate);
        checkout.setHours(0, 0, 0, 0);
        checkout.setDate(checkout.getDate() - 1); // <<--- RESTA 1 día al departureDate

        // Por cada día de la reserva
        while (curr <= checkout) {
            noDisponibles.add(curr.toISOString().slice(0, 10));
            curr.setDate(curr.getDate() + 1);
        }
    }

    // 4) Recorrer el rango de fechas completo
    const values = [];
    let curr = null;

    const canales = habitacion.channels

    for (const canal of canales) {

        for (let d = new Date(marginDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const iso = d.toISOString().slice(0, 10);
            const disponible = noDisponibles.has(iso) ? 0 : 1;
            if (!curr || curr.availability !== disponible) {
                if (curr) {
                    values.push({
                        property_id: propertyId,
                        room_type_id: canal.roomListingId,
                        date_from: curr.start,
                        date_to: curr.end,
                        availability: curr.availability
                    });
                }
                curr = { start: iso, end: iso, availability: disponible };
            } else {
                curr.end = iso;
            }
        }
        if (curr) {
            values.push({
                property_id: propertyId,
                room_type_id: canal.roomListingId,
                date_from: curr.start,
                date_to: curr.end,
                availability: curr.availability
            });
        }
    }


    const payload = { values };
    const response = await channex.post('/api/v1/availability', payload);

    return response.data;
}

// Aqui irá todo lo de booking

async function validatePropertyBooking(req, res) {
    const { pmsId } = req.body;
    try {
        const response = await channex.get(`/api/v1/properties/${pmsId}`);
        res.status(200).json(response.data);
    } catch (err) {
        console.error('Error al validar la propiedad en Channex:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.response?.data?.error || err.message });
    }   
}


async function createPropertyWebhook(propertyId) {
    const base_url = process.env.NODE_ENV === 'development' ? 'https://8792-177-249-172-194.ngrok-free.app/api/channex/webhooks' : `https://${process.env.URL}/api/channex/webhooks`;
    try {
        const payload = {
            webhook: {
                property_id: propertyId,
                callback_url: base_url,
                event_mask: 'booking_new,booking_modification,booking_cancellation,alteration_request',
                request_params: {},
                headers: {},
                is_active: true,
                send_data: true
            }
        };

        const response = await channex.post('/api/v1/webhooks', payload);
        console.log('Webhook creado exitosamente:', response.data);
        return response.data;
    } catch (err) {
        console.error('Error al crear el webhook:', err.response?.data || err.message);
        throw err;
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

async function calcularCostoBaseTotal(habitacion, arrivalDate, departureDate) {
    const habitacionId = habitacion._id;
    console.log("Habitacion desde calcular costo base total", habitacion)

    // 1) Cargar la primera plataforma activa (o elegir lógica si hay varias)
    const [plat] = await Plataformas.find({
        _id: { $in: habitacion.activePlatforms }
    }).lean();
    if (!plat) throw new Error('No hay plataformas activas');

    // 2) Default de costo base 2+ noches
    const defaultCosto2n = habitacion.others.baseCost2nights;
    const defaultPrecio2n = habitacion.others.basePrice2nights;

    // 3) Traer sólo los registros de costo en el rango de fechas
    const registros = await PrecioBaseXDia.find({
        habitacionId,
        fecha: {
            $gte: moment.utc(arrivalDate).startOf('day').toDate(),
            $lt: moment.utc(departureDate).startOf('day').toDate()
        }
    }).lean();

    // 4) Indexar por fecha ISO
    const mapa = registros.reduce((m, r) => {
        m[r.fecha.toISOString().slice(0, 10)] = r;
        return m;
    }, {});

    let totalCosto = 0;  // suma de costo_base_2noches para cada día
    let totalPrecio = 0;  // suma de (costo + markup) para cada día

    // 5) Iterar día a día
    for (
        let d = new Date(arrivalDate);
        d < departureDate;
        d.setDate(d.getDate() + 1)
    ) {
        const iso = d.toISOString().slice(0, 10);
        const rec = mapa[iso];

        // 5a) Costo real de ese día (paquete 2+ noches)
        const costo2n = rec
            ? rec.costo_base_2noches
            : defaultCosto2n;
        totalCosto += costo2n;

        const precio2n = rec
            ? rec.precio_base_2noches
            : defaultPrecio2n;
        totalPrecio += precio2n;

        // 5b) Markup de plataforma para ese día
        let incremento = 0;
        if (plat.aumentoFijo != null) {
            incremento = plat.aumentoFijo;
        } else if (plat.aumentoPorcentual != null) {
            incremento = Math.round(precio2n * (plat.aumentoPorcentual / 100));
        }

        // console.log("INCREMENTO PLATAFORMA: ", incremento);
        // 5c) Precio base cobrado al huésped ese día
        // totalCosto += incremento;
        totalPrecio += incremento;

        console.log("COSTO TOTAL: ", totalCosto);
        console.log("PRECIO TOTAL: ", totalPrecio);
    }

    return { costoBase: totalCosto, precioBase: totalPrecio };
}

module.exports = {
    mapProperties,
    getChannexProperties,
    dashboardChannexFull,
    dashboardBooking,
    showCreatedPropertiesAirbnb,
    createChannexProperty,
    webhookReceptor,
    airbnbConnection,
    oauthAirbnb,
    mapPropertiesAirbnb,
    activateChannel,
    createRoomChannex,
    createRateChannex,
    updateChannexPrices,
    updateChannexAvailability,
    createBookingRoom,
    createRateBooking
};