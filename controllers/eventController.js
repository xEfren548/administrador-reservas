const { format, setDay } = require('date-fns');
const { check } = require("express-validator");
const { es } = require('date-fns/locale');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const moment = require('moment');
const momentTz = require('moment-timezone');
const Documento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const Usuario = require('../models/Usuario');
const Costos = require('./../models/Costos');
const BloqueoFechas = require('../models/BloqueoFechas');
const BloqueoInversionistas = require('../models/BloqueoInversionistas');
const Tipologias = require('./../models/TipologiasCabana');
const Roles = require('../models/Roles');
const Pago = require('../models/Pago');
const Logs = require('../models/Log');
const Cliente = require('../models/Cliente');
const PrecioBaseXDia = require('../models/PrecioBaseXDia');
const PreciosEspeciales = require('../models/PreciosEspeciales');
const rackLimpiezaController = require('../controllers/rackLimpiezaController');
const logController = require('../controllers/logController');
const utilidadesController = require('../controllers/utilidadesController');
const clienteController = require('../controllers/clientController');
const pagoController = require('../controllers/pagoController');
const sendEmail = require('../common/tasks/send-mails');
const channexController = require('../controllers/channexController');


const BadRequestError = require("../common/error/bad-request-error");
const NotFoundError = require('../common/error/not-found-error');
const SendMessages = require('../common/tasks/send-messages');
const ensureAuthenticated = require('../common/middlewares/authMiddleware');

const createReservationValidators = [
    check('arrivalDate')
        .notEmpty().withMessage('Start date is required')
        .toDate(),
    check('departureDate')
        .notEmpty().withMessage('End date is required')
        .toDate(),
    check()
        .custom((value, { req }) => {
            const arrivalDate = new Date(req.body.arrivalDate);
            const departureDate = new Date(req.body.departureDate);
            const currentDate = new Date();


            if (arrivalDate >= departureDate) {
                throw new BadRequestError('Departure date must be after arrival date');
            }
            return true;
        }),
    check("nNights")
        .notEmpty().withMessage('Number of nights is required')
        .isNumeric().withMessage('Number of nights must be a number'),
    check("chaletName")
        .notEmpty().withMessage('Chalet name is required')
        .isLength({ max: 255 }).withMessage("Chalet name must be less than 255 characters")
        .custom(async (value, { req }) => {
            const chalet = await Habitacion.findOne({ "propertyDetails.name": value });
            // const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === value);
            if (!chalet) {
                throw new NotFoundError('Chalet does not exist');
            }
            return true;
        }),
    check("maxOccupation")
        .notEmpty().withMessage('Max occupation is required')
        .isNumeric().withMessage('Max occupation must be a number'),
    check('total')
        .notEmpty().withMessage('Total amount is required')
        .isNumeric().withMessage('Total amount must be a number')
        .toFloat(),
    check('discount')
        .optional()
        .if(value => value !== '')
        .isNumeric().withMessage('Discount percentage must be a number')
        .toFloat()
        .custom(async (value, { req }) => {
            if (value <= 0 || value > 100) {
                throw new BadRequestError('Invalid percentage');
            }
            return true;
        }),
    check('pax')
        .notEmpty().withMessage('Por favor, selecciona el número de personas')
        .isNumeric().withMessage('Por favor, selecciona el número de personas')
];

const createOwnersReservationValidators = [
    check('clienteProvisional')
        .notEmpty().withMessage('Name is required'),
    check('arrivalDate')
        .notEmpty().withMessage('Start date is required')
        .toDate(),
    check('departureDate')
        .notEmpty().withMessage('End date is required')
        .toDate(),
    check()
        .custom((value, { req }) => {
            const arrivalDate = new Date(req.body.arrivalDate);
            const departureDate = new Date(req.body.departureDate);
            const currentDate = new Date();


            if (arrivalDate >= departureDate) {
                throw new BadRequestError('Departure date must be after arrival date');
            }
            return true;
        }),
    check("nNights")
        .notEmpty().withMessage('Number of nights is required'), check("chaletName")
            .notEmpty().withMessage('Chalet name is required')
            .isLength({ max: 255 }).withMessage("Chalet name must be less than 255 characters")
            .custom(async (value, { req }) => {
                const chalet = await Habitacion.findOne({ "propertyDetails.name": value });

                // const chalets = await Habitacion.findOne();
                // const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === value);
                if (!chalet) {
                    throw new NotFoundError('Chalet does not exist');
                }
                return true;
            }),
    check("maxOccupation")
        .notEmpty().withMessage('Max occupation is required')
        .isNumeric().withMessage('Max occupation must be a number')
];

const submitReservationValidators = [
    check()
        .custom((value, { req }) => {
            const reservationDetails = req.session.reservationInProgress;
            if (!reservationDetails) {
                throw new BadRequestError('There is no reservation in progress to be submitted');
            }
            return true;
        }),
];

async function obtenerEventos(req, res) {
    // Quitamos chaletId de req.query como pediste
    const { start, end } = req.query;

    try {
        const ObjectId = mongoose.Types.ObjectId;
        const privilege = req.session?.privilege;
        const assignedChalets = Array.isArray(req.session?.assignedChalets)
            ? req.session.assignedChalets
            : [];

        const startDate = new Date(start);
        const endDate = new Date(end);

        // -------- Filtro base (mismos criterios que tu versión) --------
        const filtro = {
            status: { $nin: ["no-show", "cancelled"] },
            arrivalDate: { $gte: startDate, $lte: endDate },
        };

        if (privilege === "Vendedor") {
            const asObjectIds = assignedChalets.map(id => ObjectId.isValid(id) ? new ObjectId(id) : id);
            filtro.resourceId = { $in: asObjectIds };
        }
        // Nota: si no eres Vendedor, trae todo (mismo comportamiento que tu else global sin chaletId)

        // -------- Reservas (SIN proyección para mantener todos los datos) --------
        const eventos = await Documento.find(filtro).lean();

        // IDs únicos de recursos
        const resourceIds = [...new Set(eventos.map(e => e?.resourceId?.toString()).filter(Boolean))];

        // -------- BLOQUEOS (batch, mismo comportamiento: SIN filtrar por rango) --------
        // En tu código original, para cada chalet traías TODOS los bloqueos. Aquí lo hacemos en una sola query.
        let bloqueos = [];
        if (resourceIds.length) {
            bloqueos = await BloqueoFechas.find(
                { habitacionId: { $in: resourceIds.map(id => ObjectId.isValid(id) ? new ObjectId(id) : id) }, type: "bloqueo" }
            ).lean();
        }

        // Convertimos bloqueos a “eventos” sintéticos con el MISMO shape que usabas
        const eventosBloqueo = bloqueos.map(fecha => {
            const arrivalDate = new Date(fecha.date);
            arrivalDate.setUTCHours(15, 0, 0, 0);

            const departureDate = new Date(arrivalDate);
            departureDate.setUTCDate(departureDate.getUTCDate() + 1);
            departureDate.setUTCHours(12, 0, 0, 0);

            return {
                _id: new mongoose.Types.ObjectId(),
                client: "N/A",
                resourceId: fecha.habitacionId,
                arrivalDate: fecha.date, // respetamos tu asignación original (no la normalizada)
                departureDate: departureDate,
                maxOccupation: 0,
                pax: 0,
                nNights: 1,
                total: 0,
                termsAccepted: false,
                madeCheckIn: false,
                surveySubmitted: false,
                isDeposit: false,
                status: "n/a",
                createdBy: "n/a",
                thanksSent: false,
                colorUsuario: "#ff0000",
                clientName: "Fecha Bloqueada",
            };
        });

        // -------- Cleaning details (conservado). Optimización: paralelo por chalet --------
        // Tu código pedía el "más reciente" por chalet (ordenaba y tomaba el primero).
        // Si el controller no permite batch, ejecutamos en paralelo por resourceId único.
        const cleaningDetailsMap = {};
        if (resourceIds.length) {
            await Promise.all(resourceIds.map(async (rid) => {
                try {
                    const rack = await rackLimpiezaController.getSpecificServicesMongo(rid);
                    if (Array.isArray(rack) && rack.length) {
                        rack.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                        const first = rack[0];
                        cleaningDetailsMap[rid] = {
                            idHabitacion: first.idHabitacion,
                            fecha: first.fecha,
                            status: first.status
                        };
                    }
                } catch (e) {
                    // no interrumpir flujo si falla limpieza de un chalet
                }
            }));
        }

        // -------- Clientes (batch) --------
        const clientIds = [...new Set(eventos.map(e => e.client).filter(Boolean))];
        const clientes = clientIds.length
            ? await Cliente.find({ _id: { $in: clientIds } }, { firstName: 1, lastName: 1 }).lean()
            : [];
        const clientesMap = new Map(clientes.map(c => [c._id.toString(), c]));

        // -------- Pagos (batch si existe modelo Pago; si no, fallback controller) --------
        const eventoIds = eventos.map(e => e._id);
        let pagosMap = new Map();

        if (typeof Pago !== 'undefined') {
            const pagosAgg = await Pago.aggregate([
                { $match: { reservacionId: { $in: eventoIds } } },
                { $group: { _id: "$reservacionId", total: { $sum: "$importe" } } }
            ]);
            pagosMap = new Map(pagosAgg.map(p => [p._id.toString(), p.total || 0]));
        } else {
            // Fallback (menos óptimo pero conserva comportamiento original)
            const pagosArray = await Promise.all(eventoIds.map(async (id) => {
                try {
                    const pagos = await pagoController.obtenerPagos(id);
                    const total = (pagos || []).reduce((acc, p) => acc + (p.importe || 0), 0);
                    return { id: id.toString(), total };
                } catch {
                    return { id: id.toString(), total: 0 };
                }
            }));
            pagosMap = new Map(pagosArray.map(p => [p.id, p.total]));
        }

        // -------- Enriquecer reservas (MISMO shape + campos calculados) --------
        for (const e of eventos) {
            // Saltar bloqueos sintéticos (aún no están en la lista)
            if (e.clientName === "Fecha Bloqueada") continue;

            // pagosTotales (igual que tu cálculo original)
            const totalPagos = pagosMap.get(e._id.toString());
            e.pagosTotales = typeof totalPagos === 'number' ? totalPagos : 0;

            // clientName si aplica (igual que tu lógica original)
            if (e.client && !e.clientName) {
                const c = clientesMap.get(e.client.toString());
                if (c) {
                    e.clientName = `${(c.firstName || '').trim()} ${(c.lastName || '').trim()}`
                        .trim()
                        .toUpperCase();
                }
            }

            // cleaningDetails si hay coincidencia
            const rid = e.resourceId?.toString?.() || String(e.resourceId);
            if (cleaningDetailsMap[rid]) {
                e.cleaningDetails = cleaningDetailsMap[rid];
            }
        }

        // -------- Respuesta: reservas + bloqueos (mismo orden lógico que tenías) --------
        res.send([...eventos, ...eventosBloqueo]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

async function obtenerEventosOptimizados(req, res) {
    const { start, end, chaletId } = req.query;
    console.log("Query params:", { start, end, chaletId });

    try {
        console.log(req.session);

        const privilege = req.session?.privilege;
        const assignedChalets = Array.isArray(req.session?.assignedChalets)
            ? req.session.assignedChalets
            : [];

        const startDate = new Date(start);
        const endDate = new Date(end);

        ObjectId = mongoose.Types.ObjectId;

        // ---------- Filtro base para reservas ----------
        const filtro = {
            status: { $nin: ["no-show", "cancelled"] },
            arrivalDate: { $gte: startDate, $lte: endDate },
        };

        // Alcance de recursos (reservas)
        if (privilege === "Vendedor") {
            const asObjectIds = assignedChalets.map(id => ObjectId.isValid(id) ? new ObjectId(id) : id);
            if (chaletId) {
                if (!asObjectIds.some(id => id.toString() === chaletId)) {
                    // Chalet específico no está en los asignados del vendedor: no hay resultados
                    return res.json([]);
                }
                filtro.resourceId = ObjectId.isValid(chaletId) ? new ObjectId(chaletId) : chaletId;

            } else {
                filtro.resourceId = { $in: asObjectIds };
            }
        } else if (chaletId) {
            filtro.resourceId = ObjectId.isValid(chaletId) ? new ObjectId(chaletId) : chaletId;
        }

        // ---------- Trae reservas (solo campos necesarios) ----------
        const reservas = await Documento.find(filtro, {
            _id: 1,
            client: 1,
            resourceId: 1,
            arrivalDate: 1,
            departureDate: 1,
            maxOccupation: 1,
            pax: 1,
            nNights: 1,
            total: 1,
            termsAccepted: 1,
            madeCheckIn: 1,
            surveySubmitted: 1,
            isDeposit: 1,
            status: 1,
            createdBy: 1,
            thanksSent: 1,
            colorUsuario: 1,
            clientName: 1,
        }).lean();

        const reservaIds = reservas.map(e => e._id);
        const logs = await Logs.find({ idReserva: { $in: reservaIds }, type: 'reservation' }).lean();

        const logsPorReserva = new Map();
        logs.forEach(log => {
            const idRes = log.idReserva.toString();
            if (!logsPorReserva.has(idRes)) {
                logsPorReserva.set(idRes, []);
            }
            logsPorReserva.get(idRes).push(log);
        })

        // ---------- Universo de recursos para BLOQUEOS ----------
        const resourceIdsFromReservas = reservas
            .map(r => r.resourceId?.toString())
            .filter(Boolean);

        // Incluye los recursos asignados (Vendedor) o el chalet explícito (Admin/otros),
        // para traer bloqueos aunque no existan reservas en el rango.
        const scopeResourceIds = new Set(resourceIdsFromReservas);
        if (privilege === "Vendedor") {
            if (chaletId) {
                scopeResourceIds.add(chaletId.toString());
                if (!assignedChalets.some(id => id.toString() === chaletId)) {
                    // Chalet específico no estaba en los asignados del vendedor: no hay resultados
                    return res.json([]);
                }

            } else {
                for (const id of assignedChalets) scopeResourceIds.add(id.toString());
            }
        } else if (chaletId) {
            scopeResourceIds.add(chaletId.toString());
        }

        // ---------- Batch: Clientes (para reservas) ----------
        const clientIds = [...new Set(reservas.map(e => e.client).filter(Boolean))];
        const clientes = clientIds.length
            ? await Cliente.find({ _id: { $in: clientIds } }, { firstName: 1, lastName: 1 }).lean()
            : [];
        const clientesMap = new Map(clientes.map(c => [c._id.toString(), c]));

        // ---------- Batch: Pagos (agregación) ----------
        let pagosMap = new Map();
        if (typeof Pago !== 'undefined') {
            const pagosAgg = await Pago.aggregate([
                { $match: { reservacionId: { $in: reservaIds } } },
                { $group: { _id: "$reservacionId", total: { $sum: "$importe" } } }
            ]);
            pagosMap = new Map(pagosAgg.map(p => [p._id.toString(), p.total || 0]));
        } else {
            // Fallback (menos óptimo) con tu controller
            // const pagosArray = await Promise.all(reservaIds.map(async (id) => {
            //   const pagos = await pagoController.obtenerPagos(id);
            //   const total = (pagos || []).reduce((acc, p) => acc + (p.importe || 0), 0);
            //   return { id: id.toString(), total };
            // }));
            // pagosMap = new Map(pagosArray.map(p => [p.id, p.total]));
        }

        // ---------- Normaliza RESERVAS a eventos ----------
        const eventosReservas = reservas.map(e => {
            // Nombre del cliente si no viene en el doc
            if (!e.clientName && e.client) {
                const c = clientesMap.get(e.client.toString());
                if (c) {
                    e.clientName = `${(c.firstName || '').trim()} ${(c.lastName || '').trim()}`
                        .trim()
                        .toUpperCase();
                }
            }
            e.pagosTotales = typeof pagosMap.get(e._id.toString()) === 'number'
                ? pagosMap.get(e._id.toString())
                : 0;

            return {
                ...e,
                logs: logsPorReserva.get(e._id.toString()) || [],
                isBlocked: false,    // <- unificado
                blockType: null,     // <- unificado
            };
        });

        // ---------- Trae BLOQUEOS en el rango ----------
        let eventosBloqueo = [];
        const idsParaBloqueos = [...scopeResourceIds].filter(Boolean);

        if (idsParaBloqueos.length) {
            // Filtra bloqueos por recursos del alcance y fecha dentro del rango solicitado
            const bloqueos = await BloqueoFechas.find(
                {
                    habitacionId: { $in: idsParaBloqueos.map(id => ObjectId.isValid(id) ? new ObjectId(id) : id) },
                    type: "bloqueo",
                    date: { $gte: startDate, $lte: endDate }
                },
                { habitacionId: 1, date: 1 }
            ).lean();

            // Normaliza BLOQUEOS a eventos
            eventosBloqueo = bloqueos.map(b => {
                // arrival = 15:00 UTC del día del bloqueo
                const arrivalDate = new Date(b.date);
                arrivalDate.setUTCHours(15, 0, 0, 0);
                // departure = siguiente día 12:00 UTC
                const departureDate = new Date(arrivalDate);
                departureDate.setUTCDate(departureDate.getUTCDate() + 1);
                departureDate.setUTCHours(12, 0, 0, 0);

                return {
                    _id: new ObjectId(),
                    client: "N/A",
                    resourceId: b.habitacionId,
                    arrivalDate,
                    departureDate,
                    maxOccupation: 0,
                    pax: 0,
                    nNights: 1,
                    total: 0,
                    termsAccepted: false,
                    madeCheckIn: false,
                    surveySubmitted: false,
                    isDeposit: false,
                    status: "blocked",          // <- estandariza estado
                    createdBy: "system",
                    thanksSent: false,
                    colorUsuario: "#ff0000",
                    clientName: "Fecha Bloqueada",
                    pagosTotales: 0,
                    isBlocked: true,            // <- unificado
                    blockType: "bloqueo",       // <- unificado
                };
            });
        }

        // ---------- Respuesta unificada ----------
        // Puedes ordenar si lo deseas (ej. por arrivalDate)
        const eventos = [...eventosReservas, ...eventosBloqueo];
        // eventos.sort((a, b) => new Date(a.arrivalDate) - new Date(b.arrivalDate));

        res.send(eventos);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

async function obtenerEventosDeCabana(req, res) {
    const { id } = req.params;
    const newId = new mongoose.Types.ObjectId(id);
    try {
        // const documentos = await Documento.find({ 'events.resourceId': newId });
        // const habitaciones = await Habitacion.findOne();

        // let eventos = [];
        // documentos.forEach(doc => {
        //     const matchingEvents = doc.events.filter(evento => evento.resourceId.equals(newId));
        //     eventos = eventos.concat(matchingEvents);
        // });
        const eventos = await Documento.find({ resourceId: newId }).lean();

        // const habitacion = habitaciones.resources.find(habitacion => habitacion._id.equals(newId));
        const habitacion = await Habitacion.findById(newId).lean();
        if (!habitacion) { throw new Error('No se encontró la habitación'); }

        // Fetch colorUsuario for each evento's createdBy
        const eventosWithColorUsuario = await Promise.all(eventos.map(async evento => {
            const createdBy = evento.createdBy;
            let colorUsuario = null; // Default to null if usuario is not found
            let clientName = null;
            let creadaPor = null;
            let precioBaseTotal = null;
            let montoPendiente = null;
            if (createdBy) {
                const usuario = await Usuario.findById(createdBy).select('color firstName lastName').exec();
                if (usuario) {
                    colorUsuario = usuario.color;
                    creadaPor = usuario.firstName + ' ' + usuario.lastName;
                }
            }
            if (evento.client) {
                const client = await Cliente.findById(evento.client);
                if (client) {
                    clientName = (client.firstName + ' ' + client.lastName).toUpperCase();
                } else {
                    clientName = "Reserva"
                }
            } else {
                if (evento.clienteProvisional) {
                    clientName = evento.clienteProvisional;
                }
            }

            if (evento.status !== "reserva dueño") {
                const pagosReserva = await pagoController.obtenerPagos(evento._id);
                let pagoTotal = 0
                pagosReserva.forEach(pago => {
                    pagoTotal += pago.importe;
                })
                const totalReserva = evento.total;
                // let precioBaseTotal = 0
                if (evento.status === "reserva de dueño") {
                    precioBaseTotal = 0;
                } else {
                    precioBaseTotal = evento.nNights > 1 ? habitacion.others.basePrice2nights * evento.nNights : habitacion.others.basePrice * evento.nNights
                }

                montoPendiente = totalReserva - pagoTotal;
                console.log("Precio base total: ", precioBaseTotal)
            }

            return {
                ...evento,
                colorUsuario: colorUsuario,
                clientName: clientName,
                creadaPor: creadaPor,
                precioBaseTotal: precioBaseTotal,
                montoPendiente: montoPendiente
            };

        }));


        const fechasBloqueadas = await BloqueoFechas.find({ habitacionId: newId, type: "bloqueo" }).lean()

        for (const fecha of fechasBloqueadas) {
            const arrivalDate = new Date(fecha.date);
            arrivalDate.setUTCHours(15, 0, 0, 0)
            const departureDate = new Date(arrivalDate);
            departureDate.setDate(departureDate.getDate() + 1);
            departureDate.setUTCHours(12, 0, 0, 0);
            const evento = {
                _id: new mongoose.Types.ObjectId(),
                client: "N/A",
                resourceId: fecha.habitacionId,
                arrivalDate: fecha.date,
                departureDate: departureDate,
                maxOccupation: 0,
                pax: 0,
                nNights: 1,
                total: 0,
                termsAccepted: false,
                madeCheckIn: false,
                surveySubmitted: false,
                isDeposit: false,
                status: "n/a",
                createdBy: "n/a",
                thanksSent: false,
                colorUsuario: "#ff0000",
                clientName: "Fecha Bloqueada",
            }
            eventosWithColorUsuario.push(evento);
        }

        console.log(eventosWithColorUsuario)
        res.send(eventosWithColorUsuario);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

async function obtenerEventoPorId(id) {
    try {
        const evento = await Documento.findById(id); // Buscar el documento que contiene los eventos

        // if (!eventosExistentes) {
        //     throw new Error('No se encontraron eventos');
        // }

        // Buscar el evento por su id
        // const evento = eventosExistentes.events.find(evento => evento.id === id);

        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }
        return evento;
    } catch (error) {
        throw new Error('Error al obtener el evento por id: ' + error.message);
    }
}

async function obtenerEventoPorIdRoute(req, res) {
    try {
        const { id } = req.params;
        // const eventosExistentes = await Documento.findOne(); // Buscar el documento que contiene los eventos

        // if (!eventosExistentes) {
        //     throw new Error('No se encontraron eventos');
        // }

        // Buscar el evento por su id
        // const evento = eventosExistentes.events.find(evento => evento.id === id);
        const evento = await Documento.findById(id);

        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }
        res.send(evento);
    } catch (error) {
        throw new Error('Error al obtener el evento por id: ' + error.message);
    }
}

async function reservasDeDuenos(req, res, next) {
    try {
        // Get the owner's ID from the session
        const duenoId = new mongoose.Types.ObjectId(req.session.id); // req.session.id;

        // // Find the existing rooms
        // const habitacionesExistentes = await Habitacion.findOne().lean();
        // if (!habitacionesExistentes) {
        //     return res.status(404).send('No rooms found');
        // }

        // Filter the rooms that belong to the owner
        // const habitacionesDueno = habitacionesExistentes.resources.filter(habitacion => habitacion.others.owner.toString() === duenoId);
        const habitacionesDueno = await Habitacion.find({ "others.owner": duenoId }).lean();
        console.log("Habitaciones Dueno: ")
        console.log(habitacionesDueno)
        // Extract the IDs and names of the rooms
        const cabañaIds = habitacionesDueno.map(habitacion => habitacion._id.toString());
        const nombreCabañas = habitacionesDueno.map(habitacion => ({ id: habitacion._id.toString(), name: habitacion.propertyDetails.name }));

        // Create a map of room IDs to names
        const cabañaIdToNameMap = {};
        nombreCabañas.forEach(cabaña => {
            cabañaIdToNameMap[cabaña.id] = cabaña.name;
        });

        // Find documents containing events
        const documentos = await Documento.find().lean();
        if (!documentos) {
            return res.status(404).send('No documents found');
        }

        // Filter events that correspond to the owner's rooms and add the room name to each event
        const eventosFiltradosOrdenadosConPagos = await Promise.all(documentos
            .filter(evento => cabañaIds.includes(evento.resourceId.toString()) && evento.status != "cancelled")
            .map(async evento => {
                // Obtener los pagos para este evento
                const pagos = await pagoController.obtenerPagos(evento._id);
                let pagoTotal = 0
                pagos.forEach(pago => {
                    pagoTotal += pago.importe;
                })

                let subtotal = evento.total;
                let discount = evento.discount;
                if (isNaN(discount) || discount === undefined || discount === null) {
                    discount = 0;
                }

                let preTotal = subtotal * (discount / 100);
                let total = subtotal - preTotal;

                let montoPendiente = total - pagoTotal;


                let vendedor = null;
                const usuarioQueReserva = await Usuario.findById(evento.createdBy);
                if (usuarioQueReserva) {
                    if (usuarioQueReserva.privilege !== "Inversionistas" && usuarioQueReserva.privilege !== "Dueño de cabañas" && usuarioQueReserva.privilege !== "Colaborador dueño") {
                        vendedor = usuarioQueReserva.firstName + ' ' + usuarioQueReserva.lastName

                    }
                }

                let cliente = null;
                const clienteFound = await Cliente.findById(evento.client)
                if (clienteFound) {
                    cliente = (clienteFound.firstName + ' ' + clienteFound.lastName).toUpperCase();
                } else {
                    if (evento.clienteProvisional) {
                        cliente = evento.clienteProvisional;
                    }
                }




                // Retornar el evento con los pagos y las fechas formateadas
                return {
                    ...evento,
                    roomName: cabañaIdToNameMap[evento.resourceId.toString()],
                    arrivalDate: moment.utc(evento.arrivalDate).format('DD-MM-YYYY, h:mm:ss a'),
                    departureDate: moment.utc(evento.departureDate).format('DD-MM-YYYY, h:mm:ss a'),
                    pagoTotal: pagoTotal,  // Asignar los pagos al evento
                    montoPendiente: montoPendiente,
                    mostrarCancelarReserva: evento.status === 'reserva de dueño',  // Nueva propiedad.
                    vendedor: vendedor,
                    cliente: cliente

                };
            }));

        eventosFiltradosOrdenadosConPagos.sort((a, b) => moment(b.departureDate, 'DD-MM-YYYY, h:mm:ss a').valueOf() - moment(a.departureDate, 'DD-MM-YYYY, h:mm:ss a').valueOf());
        console.log(eventosFiltradosOrdenadosConPagos);
        res.render('vistaParaDuenos', {
            eventos: eventosFiltradosOrdenadosConPagos,
            chalets: habitacionesDueno
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
}
async function reservasDeDuenosParaColaborador(req, res, next) {
    try {
        const privilege = req.session.privilege;
        let eventosFiltradosOrdenadosConPagos = [];
        let habitacionesDueno = [];

        console.log(req.session)

        if (privilege === "Inversionistas") {
            const investor = await Usuario.findById(req.session.id);
            if (!investor) {
                return res.status(404).send('No investor found');
            }

            const investorId = investor._id;
            // const habitacionesExistentes = await Habitacion.find().lean();
            // if (!habitacionesExistentes) {
            //     return res.status(404).send('No rooms found');
            // }

            habitacionesDueno = await Habitacion.find({
                "others.investors": {
                    $elemMatch: {
                        "investor": investorId
                    }
                }
            }).lean();

            if (!habitacionesDueno || habitacionesDueno.length === 0) {
                return res.status(404).send('No rooms found for this investor');
            }


            // habitacionesDueno = habitacionesExistentes.filter(habitacion =>
            // (Array.isArray(habitacion.others.investors) &&
            //     // habitacion.others.investors.some(investorId => investorId.toString() === investor._id.toString()))
            //     habitacion.others.investors.find(investors => investors.investor.toString() === duenoId))
            // );

            // habitacionesDueno = habitacionesExistentes.filter(habitacion => {
            //     // Check if habitacion and investors array exists
            //     if (!habitacion?.others?.investors) return false;
            //     console.log(habitacion.others.investors)
            //     // Find if current user is an investor
            //     const investor = habitacion.others.investors.find(investor =>
            //         // investor?.investor?.toString() === investor._id?.toString()
            //         investor.investor.toString() === investor._id.toString()
            //     );
            // });

            const cabañaIds = habitacionesDueno.map(habitacion => habitacion._id.toString());
            const nombreCabañas = habitacionesDueno.map(habitacion => ({ id: habitacion._id.toString(), name: habitacion.propertyDetails.name }));

            // Create a map of room IDs to names
            const cabañaIdToNameMap = {};
            nombreCabañas.forEach(cabaña => {
                cabañaIdToNameMap[cabaña.id] = cabaña.name;
            });

            // Find documents containing events
            const documentos = await Documento.find().lean();
            if (!documentos) {
                return res.status(404).send('No documents found');
            }

            eventosFiltradosOrdenadosConPagos = await Promise.all(documentos
                .filter(evento => cabañaIds.includes(evento.resourceId.toString()))
                .map(async evento => {
                    // Retornar el evento con los pagos y las fechas formateadas
                    return {
                        ...evento,
                        roomName: cabañaIdToNameMap[evento.resourceId.toString()],
                        arrivalDate: moment.utc(evento.arrivalDate).format('DD-MM-YYYY, h:mm:ss a'),
                        departureDate: moment.utc(evento.departureDate).format('DD-MM-YYYY, h:mm:ss a'),
                    };
                }));

            eventosFiltradosOrdenadosConPagos.sort((a, b) => moment(b.departureDate, 'DD-MM-YYYY, h:mm:ss a').valueOf() - moment(a.departureDate, 'DD-MM-YYYY, h:mm:ss a').valueOf());


        } else {
            // Get the owner's ID from the session
            const user = await Usuario.findById(req.session.id);
            const duenoId = user.administrator;

            // Find the existing rooms
            const habitacionesExistentes = await Habitacion.find().lean();
            if (!habitacionesExistentes) {
                return res.status(404).send('No rooms found');
            }

            // Filter the rooms that belong to the owner
            habitacionesDueno = habitacionesExistentes.filter(habitacion => habitacion.others.owner.toString() === duenoId);
            console.log("Dueño id: ", duenoId);
            // Extract the IDs and names of the rooms
            const cabañaIds = habitacionesDueno.map(habitacion => habitacion._id.toString());
            const nombreCabañas = habitacionesDueno.map(habitacion => ({ id: habitacion._id.toString(), name: habitacion.propertyDetails.name }));

            // Create a map of room IDs to names
            const cabañaIdToNameMap = {};
            nombreCabañas.forEach(cabaña => {
                cabañaIdToNameMap[cabaña.id] = cabaña.name;
            });

            // Find documents containing events
            const documentos = await Documento.find().lean();
            if (!documentos) {
                return res.status(404).send('No documents found');
            }



            // Filter events that correspond to the owner's rooms and add the room name to each event
            eventosFiltradosOrdenadosConPagos = await Promise.all(documentos
                .filter(evento => cabañaIds.includes(evento.resourceId.toString()))
                .map(async evento => {
                    // Retornar el evento con los pagos y las fechas formateadas
                    return {
                        ...evento,
                        roomName: cabañaIdToNameMap[evento.resourceId.toString()],
                        arrivalDate: moment.utc(evento.arrivalDate).format('DD-MM-YYYY, h:mm:ss a'),
                        departureDate: moment.utc(evento.departureDate).format('DD-MM-YYYY, h:mm:ss a'),
                    };
                }));

            eventosFiltradosOrdenadosConPagos.sort((a, b) => moment(b.departureDate, 'DD-MM-YYYY, h:mm:ss a').valueOf() - moment(a.departureDate, 'DD-MM-YYYY, h:mm:ss a').valueOf());

        }

        res.render('vistaColaboradorDuenos', {
            eventos: eventosFiltradosOrdenadosConPagos,
            chalets: habitacionesDueno,
            privilege: privilege
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
}


async function createReservation(req, res, next) {
    const { clientFirstName, clientLastName, clientEmail, chaletName, arrivalDate, departureDate, maxOccupation, pax, nNights, total, discount, isDeposit } = req.body;
    let newCliente = null;
    let client = null;

    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "CREATE_RESERVATIONS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para crear reservas");
        }

        if (total <= 0) {
            throw new Error("El total debe ser mayor a 0");
        }

        console.log("is depo: ", isDeposit);
        console.log("cliente email: ", clientEmail);

        const fechaAjustada = new Date(arrivalDate);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC
        const departureDateAjustada = new Date(departureDate);
        departureDateAjustada.setUTCHours(6);

        const arrivalDateObj = new Date(arrivalDate);
        const departureDateObj = new Date(departureDate);

        // Set specific times
        arrivalDateObj.setUTCHours(17, 30, 0, 0); // 17:30:00 UTC
        departureDateObj.setUTCHours(13, 0, 0, 0); // 14:30:00 UTC

        // Convert back to ISO strings
        const arrivalDateISO = arrivalDateObj.toISOString();
        const departureDateISO = departureDateObj.toISOString();

        console.log("Updated arrivalDateISO:", arrivalDateISO);
        console.log("Updated departureDateISO:", departureDateISO);



        const chalet = await Habitacion.findOne({ "propertyDetails.name": chaletName }).lean();
        console.log("chalet name: ", chaletName)
        // const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === chaletName);
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
        }

        if (chalet.isActive === false) {
            return res.status(400).send({
                message: `La habitación ${chaletName} ha sido desactivada.`,
            });
        }

        const mongooseChaletId = new mongoose.Types.ObjectId(chalet._id);
        const overlappingReservation = await Documento.findOne({
            resourceId: mongooseChaletId,
            status: { $nin: ["cancelled", "no-show", "playground"] },
            $and: [
                { arrivalDate: { $lt: departureDateISO } }, // Start date overlaps or is before the departure date
                { departureDate: { $gt: arrivalDateISO } }, // End date overlaps or is after the arrival date
            ],
        });

        if (overlappingReservation) {
            return res.status(400).send({
                message: `La habitación ya está reservada entre ${overlappingReservation.arrivalDate.toISOString()} y ${overlappingReservation.departureDate.toISOString()}.`,
            });
        }

        const fechasBloqueadasPorRestriccion = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: mongooseChaletId, type: 'restriccion' });
        if (fechasBloqueadasPorRestriccion) {
            if (nNights < fechasBloqueadasPorRestriccion.min) {
                return res.status(400).send({ message: `La estancia minima es de ${fechasBloqueadas.min} noches` });
            }
        }

        let currentDate = new Date(fechaAjustada);
        currentDate.setUTCHours(17);
        while (currentDate <= departureDateAjustada) {
            const fechasBloqueadas = await BloqueoFechas.findOne({ date: currentDate, habitacionId: mongooseChaletId, type: 'bloqueo' });
            if (fechasBloqueadas) {
                const formattedDate = currentDate.toISOString().split('T')[0];
                return res.status(400).send({ message: `La habitacion está bloqueada para la fecha ${formattedDate}` });
            }

            currentDate.setDate(currentDate.getDate() + 1);

        }

        currentDate = new Date(fechaAjustada);
        currentDate.setUTCHours(6);

        while (currentDate <= departureDateAjustada) {
            const fechasBloqueadasPorCapacidad = await BloqueoFechas.findOne({ date: currentDate, habitacionId: mongooseChaletId, type: 'capacidad_minima' });
            if (fechasBloqueadasPorCapacidad) {
                console.log("current date: ", currentDate);
                console.log("fechasBloqueadasPorCapacidad: ", fechasBloqueadasPorCapacidad);
                if (pax < fechasBloqueadasPorCapacidad.min) {
                    return res.status(400).send({ message: `La capacidad minima es de ${fechasBloqueadasPorCapacidad.min} personas` });
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);

        }



        // const isAvailable = await checkAvailability(mongooseChaletId, fechaAjustada, departureDateAjustada);
        // if (!isAvailable) {
        //     throw new BadRequestError('La habitación no está disponible en esas fechas');
        // }

        if (clientEmail) {
            client = await Cliente.findOne({ email: clientEmail });
            console.log("Client initial")

        }
        if (!client) {
            newCliente = await clienteController.createClientLocal(clientFirstName, clientLastName, req.session)
            console.log("No cliente")
            console.log(newCliente)
            if (!newCliente) {
                throw new NotFoundError('Client does not exist');
            }
            client = newCliente;

        }

        console.log("client: ");
        console.log(client);

        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        if (!costosVendedor) { throw new NotFoundError('Costos vendedor not found'); }

        const comisionVendedor = costosVendedor.amount * nNights;

        console.log("Arrival date before: ")
        console.log(arrivalDate)

        console.log("Departure date before: ")
        console.log(departureDate)

        arrivalDate.setHours(arrivalDate.getHours() + chalet.others.arrivalTime.getHours());
        departureDate.setHours(departureDate.getHours() + chalet.others.departureTime.getHours());

        console.log("Arrival date after: ")
        console.log(arrivalDate)

        console.log("Departure date after: ")
        console.log(departureDate)

        var reservationToAdd;
        var message;

        const createdBy = new mongoose.Types.ObjectId(req.session.id);

        if (!isDeposit) {
            reservationToAdd = {
                client: client._id,
                resourceId: chalet._id,
                arrivalDate: arrivalDate,
                departureDate: departureDate,
                maxOccupation: maxOccupation,
                pax: pax,
                nNights: nNights,
                url: `https://${process.env.URL}/api/eventos/${chalet._id}`,
                total: total,
                discount: discount,
                createdBy: createdBy,
                comisionVendedor: comisionVendedor,
                status: 'active'
            };
            message = "Reservación agregada con éxito";
        }
        else {
            console.log("Current date: ", format(Date.now(), "eeee d 'de' MMMM 'de' yyyy 'a las' HH:mm 'GMT'", { locale: es }));
            console.log("Arrival date: ", format(arrivalDate, "eeee d 'de' MMMM 'de' yyyy 'a las' HH:mm 'GMT'", { locale: es }));

            const timeToArrive = (arrivalDate - new Date()) / (1000 * 60 * 60 * 24);
            var paymentCancelation;
            if (timeToArrive >= 7) {
                paymentCancelation = new Date(Date.now() + 24 * 60 * 60 * 1000);
            }
            else if (timeToArrive >= 3 && timeToArrive < 7) {
                paymentCancelation = new Date(Date.now() + 12 * 60 * 60 * 1000);
            }
            else if (timeToArrive >= 1 && timeToArrive < 3) {
                paymentCancelation = new Date(Date.now() + 8 * 60 * 60 * 1000);
            }
            else if (timeToArrive < 1) {
                paymentCancelation = new Date(Date.now() + 1 * 60 * 60 * 1000);
            }

            console.log("Cancelation date: ", format(paymentCancelation, "eeee d 'de' MMMM 'de' yyyy 'a las' HH:mm 'GMT'", { locale: es }));

            reservationToAdd = {
                client: client._id,
                resourceId: chalet._id,
                arrivalDate: arrivalDate,
                departureDate: departureDate,
                maxOccupation: maxOccupation,
                pax: pax,
                nNights: nNights,
                url: `https://${process.env.URL}/api/eventos/${chalet._id}`,
                total: total,
                discount: discount,
                isDeposit: true,
                paymentCancelation: paymentCancelation,
                createdBy: createdBy,
                comisionVendedor: comisionVendedor
            };

            message = `Reservación agregada con éxito. Realice su pago antes de ${format(paymentCancelation, "eeee d 'de' MMMM 'de' yyyy 'a las' HH:mm 'GMT'", { locale: es })} o su reserva será cancelada`;
        }

        // const documento = await Documento.findOne();
        // documento.events.push(reservationToAdd);
        // await documento.save();

        const documentoToAdd = new Documento(reservationToAdd);
        await documentoToAdd.save();

        // Guardar la reserva actualizada en la base de datos
        // const documento2 = await Documento.findOne()

        // const idReserva = documento.events[documento.events.length - 1]._id.toString();
        const idReserva = documentoToAdd._id.toString();
        const url = `https://${process.env.URL}/api/eventos/${idReserva}`;
        console.log("url: ", url)
        // const evento = await Documento.findById(idReserva);

        documentoToAdd.url = url;
        await documentoToAdd.save();

        const descripcionLimpieza = 'Limpieza ' + chaletName;
        const fechaLimpieza = new Date(arrivalDate);
        const checkInDate = new Date(arrivalDate)
        const checkOutDate = new Date(departureDate)
        fechaLimpieza.setDate(fechaLimpieza.getDate())
        const statusLimpieza = 'Pendiente'


        await rackLimpiezaController.createServiceForReservation({
            id_reserva: idReserva,
            descripcion: descripcionLimpieza,
            fecha: fechaLimpieza,
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            status: statusLimpieza,
            idHabitacion: documentoToAdd.resourceId
        })


        if (client.phone) {
            SendMessages.sendReservationConfirmation(client, chalet, reservationToAdd);
            console.log("SendMessages.sendReminders");
            SendMessages.sendInstructions(client, chalet, idReserva)
        }

        if (client.email) {
            sendEmail(client.email, idReserva);
        }



        const agenteQueReserva = await Usuario.findById(createdBy);
        if (agenteQueReserva) {
            if (agenteQueReserva.phone) {
                SendMessages.sendReservationConfirmation(agenteQueReserva, chalet, reservationToAdd);
                console.log("Mensaje enviado al agente.")
            }
            if (agenteQueReserva.email) {
                sendEmail(agenteQueReserva.email, idReserva);
            }
        }

        // Log
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: idReserva,
            acciones: `Reservación creada por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);

        if (chalet.channels?.length > 0) {

            const arrivalDate = new Date(documentoToAdd.arrivalDate);
            const departureDate = new Date(documentoToAdd.departureDate);

            // Generate all dates between arrival and departure (excluding departure date)
            const datesResponse = [];
            const currentDate = new Date(arrivalDate);

            while (currentDate < departureDate) {
                datesResponse.push({
                    date: {
                        date: new Date(currentDate)
                    }
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }

            channexController.updateChannexAvailabilitySingle(documentoToAdd.resourceId, datesResponse)
                .then(() => {
                    console.log("Disponibilidad actualizada en Channex.");
                })
                .catch(err => {
                    // Aquí puedes: loggear a archivo, mandar notificación, email, etc.
                    console.error("Error al actualizar disponibilidad en Channex: ", err.message);
                });
        }

        res.status(200).json({ success: true, reservationId: idReserva, message });


    } catch (err) {
        console.log(err);
        res.status(400).send({ message: err.message });
    }
}

async function createOTAReservation(data) {
    const { customerFullName, customerMail, customerPhone, resourceId, arrivalDate, departureDate, maxOccupation, pax, nNights, total, isDeposit, createdBy, channelInfo } = data;
    let newCliente = null;
    let client = null;

    try {
        // const userRole = req.session.role;

        // const userPermissions = await Roles.findById(userRole);
        // if (!userPermissions) {
        //     throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        // }

        const fechaAjustada = new Date(arrivalDate);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC
        const departureDateAjustada = new Date(departureDate);
        departureDateAjustada.setUTCHours(6);

        const arrivalDateObj = new Date(arrivalDate);
        const departureDateObj = new Date(departureDate);

        // Set specific times
        arrivalDateObj.setUTCHours(17, 30, 0, 0); // 17:30:00 UTC
        departureDateObj.setUTCHours(14, 30, 0, 0); // 14:30:00 UTC

        // Convert back to ISO strings
        const arrivalDateISO = arrivalDateObj.toISOString();
        const departureDateISO = departureDateObj.toISOString();


        const chalet = await Habitacion.findById(resourceId);
        // const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === chaletName);
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
        }

        if (chalet.isActive === false) {
            return res.status(400).send({
                message: `La habitación ${chaletName} ha sido desactivada.`,
            });
        }

        const mongooseChaletId = new mongoose.Types.ObjectId(chalet._id);
        const overlappingReservation = await Documento.findOne({
            resourceId: mongooseChaletId,
            status: { $nin: ["cancelled", "no-show", "playground"] },
            $and: [
                { arrivalDate: { $lt: departureDateISO } }, // Start date overlaps or is before the departure date
                { departureDate: { $gt: arrivalDateISO } }, // End date overlaps or is after the arrival date
            ],
        });

        if (overlappingReservation) {
            throw new Error("La habitación está ocupada en la fecha seleccionada");
        }

        // const fechasBloqueadasPorRestriccion = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: mongooseChaletId, type: { $nin: ['bloqueo', 'capacidad_minima'] } });
        // if (fechasBloqueadasPorRestriccion) {
        //     if (nNights < fechasBloqueadasPorRestriccion.min) {
        //         return res.status(400).send({ message: `La estancia minima es de ${fechasBloqueadas.min} noches` });
        //     }
        // }

        // let currentDate = new Date(fechaAjustada);
        // currentDate.setUTCHours(6);
        // while (currentDate <= departureDateAjustada) {
        //     const fechasBloqueadas = await BloqueoFechas.findOne({ date: currentDate, habitacionId: mongooseChaletId, type: 'bloqueo' });
        //     if (fechasBloqueadas) {
        //         const formattedDate = currentDate.toISOString().split('T')[0];
        //         return res.status(400).send({ message: `La habitacion está bloqueada para la fecha ${formattedDate}` });
        //     }

        //     currentDate.setDate(currentDate.getDate() + 1);

        // }

        // currentDate = new Date(fechaAjustada);
        // currentDate.setUTCHours(6);

        // while (currentDate <= departureDateAjustada) {
        //     const fechasBloqueadasPorCapacidad = await BloqueoFechas.findOne({ date: currentDate, habitacionId: mongooseChaletId, type: 'capacidad_minima' });
        //     if (fechasBloqueadasPorCapacidad) {
        //         if (pax < fechasBloqueadasPorCapacidad.min) {
        //             return res.status(400).send({ message: `La capacidad minima es de ${fechasBloqueadasPorCapacidad.min} personas` });
        //         }
        //     }

        //     currentDate.setDate(currentDate.getDate() + 1);

        // }



        // const isAvailable = await checkAvailability(mongooseChaletId, fechaAjustada, departureDateAjustada);
        // if (!isAvailable) {
        //     throw new BadRequestError('La habitación no está disponible en esas fechas');
        // }


        // Crear cliente en PMS
        newCliente = await Cliente.create({ firstName: customerFullName, lastName: channelInfo.ota_name, email: customerMail, phone: customerPhone });

        if (!newCliente) {
            throw new NotFoundError('No se pudo crear el cliente en PMS');
        }
        client = newCliente;

        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        if (!costosVendedor) { throw new NotFoundError('Costos vendedor not found'); }

        const comisionVendedor = costosVendedor.amount * nNights;

        // arrivalDate.setHours(chalet.others.arrivalTime.getHours());
        // departureDate.setHours(chalet.others.departureTime.getHours());

        const arrivalHour = chalet.others.arrivalTime.getHours();
        const arrivalMinute = chalet.others.arrivalTime.getMinutes();
        const departureHour = chalet.others.departureTime.getHours();
        const departureMinute = chalet.others.departureTime.getMinutes();

        // 3) Parsear y setear hora en CDMX
        const arrivalMoment = moment
            .utc(arrivalDate, 'YYYY-MM-DD')
            .hour(arrivalHour)
            .minute(arrivalMinute)
            .second(0)
            .millisecond(0);

        const departureMoment = momentTz
            .utc(departureDate, 'YYYY-MM-DD')
            .hour(departureHour)
            .minute(departureMinute)
            .second(0)
            .millisecond(0);

        // 4) Convertir a Date
        const arrivalDateM = arrivalMoment.toDate();
        const departureDateM = departureMoment.toDate();

        var reservationToAdd;
        var message;

        reservationToAdd = {
            client: client._id,
            resourceId: chalet._id,
            arrivalDate: arrivalDateM,
            departureDate: departureDateM,
            maxOccupation: maxOccupation,
            pax: pax,
            nNights: nNights,
            url: `https://${process.env.URL}/api/eventos/${chalet._id}`,
            total: total,
            createdBy: createdBy,
            comisionVendedor: comisionVendedor,
            status: 'active',
            channels: {
                ota_name: channelInfo.ota_name,
                propertyId: channelInfo.propertyId,
                listingId: channelInfo.listingId,
                channelId: channelInfo.channelId,
                bookingId: channelInfo.bookingId
            }
        };
        message = "Reservación agregada con éxito";

        const documentoToAdd = new Documento(reservationToAdd);
        await documentoToAdd.save();

        // Guardar la reserva actualizada en la base de datos
        // const documento2 = await Documento.findOne()

        // const idReserva = documento.events[documento.events.length - 1]._id.toString();
        const idReserva = documentoToAdd._id.toString();
        const url = `https://${process.env.URL}/api/eventos/${idReserva}`;
        // const evento = await Documento.findById(idReserva);

        documentoToAdd.url = url;
        await documentoToAdd.save();

        const chaletName = chalet.propertyDetails.name
        const descripcionLimpieza = 'Limpieza ' + chaletName;
        const fechaLimpieza = new Date(arrivalDateM);
        const checkInDate = new Date(arrivalDateM)
        const checkOutDate = new Date(departureDateM)
        fechaLimpieza.setDate(fechaLimpieza.getDate())
        const statusLimpieza = 'Pendiente'


        await rackLimpiezaController.createServiceForReservation({
            id_reserva: idReserva,
            descripcion: descripcionLimpieza,
            fecha: fechaLimpieza,
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            status: statusLimpieza,
            idHabitacion: documentoToAdd.resourceId
        })


        if (client.phone) {
            SendMessages.sendReservationConfirmation(client, chalet, reservationToAdd);
            console.log("SendMessages.sendReminders");
            SendMessages.sendInstructions(client, chalet, idReserva)
        }

        if (client.email) {
            sendEmail(client.email, idReserva);
        }



        const adminLigado = await Usuario.findById(createdBy);
        if (adminLigado) {
            if (adminLigado.phone) {
                SendMessages.sendReservationConfirmation(adminLigado, chalet, reservationToAdd);
                console.log("Mensaje enviado al agente.")
            }
            if (adminLigado.email) {
                sendEmail(adminLigado.email, idReserva);
            }
        }

        // Log
        const logBody = {
            fecha: Date.now(),
            idUsuario: createdBy,
            type: 'reservation',
            idReserva: idReserva,
            acciones: `Reservación creada OTA`,
            nombreUsuario: `${channelInfo.ota_name}`
        }

        await logController.createBackendLog(logBody);

        // res.status(200).json({ success: true, reservationId: idReserva, message });
        return { success: true, reserva: documentoToAdd, message };

        // if (chalet.channels.airbnbListingId) {
        //     channexController.updateChannexAvailability(chalet._id)
        //         .then(() => {
        //             console.log("Disponibilidad actualizada en Channex.");
        //         })
        //         .catch(err => {
        //             // Aquí puedes: loggear a archivo, mandar notificación, email, etc.
        //             console.error("Error al actualizar disponibilidad en Channex: ", err.message);
        //         });
        // }

    } catch (err) {
        console.log(err);
        return { success: false, message: err.message };
    }
}

async function sendIntructionsToWhatsapp(req, res) {
    try {

        const { idReserva } = req.body;

        // const allReservations = await Documento.findOne();
        // const reservation = allReservations.events.find(evento => evento._id.toString() === idReserva);
        const reservation = await Documento.findById(idReserva);

        if (!reservation) { throw new NotFoundError('Reserva no encontrada.') }

        const client = await Cliente.findById(reservation.client);
        if (!client) { throw new NotFoundError('Cliente no encontrado.') }


        const chaletId = new mongoose.Types.ObjectId(reservation.resourceId); //reservation.resourceId;

        const chalet = await Habitacion.findById(chaletId).lean();
        if (!chalet) { throw new NotFoundError('Chalet no encontrado.') }

        // const chalets = await Habitacion.findOne();
        // const chalet = chalets.resources.find(chalet => chalet._id.toString() === chaletId.toString());
        // if (!chalet) {throw new NotFoundError('Chalet no encontrado.')}




        SendMessages.sendInstructions(client, chalet, idReserva)
        SendMessages.sendReservationConfirmation(client, chalet, reservation)
        res.status(200).send({ message: 'Instrucciones enviadas correctamente!' })
    } catch (error) {
        res.send({ message: error.message })
    }
}

async function createOwnerReservation(req, res, next) {
    const { chaletName, arrivalDate, departureDate, maxOccupation, nNights, clienteProvisional } = req.body;

    try {
        const privilege = req.session.privilege;
        const investorId = req.session.id
        const mInvestorId = new mongoose.Types.ObjectId(investorId);

        const arrivalDateObj = new Date(arrivalDate);
        const departureDateObj = new Date(departureDate);

        // Set specific times
        arrivalDateObj.setUTCHours(17, 30, 0, 0); // 17:30:00 UTC
        departureDateObj.setUTCHours(14, 30, 0, 0); // 14:30:00 UTC

        const arrivalDateISO = arrivalDateObj.toISOString();
        const departureDateISO = departureDateObj.toISOString();

        const chalet = await Habitacion.findOne({ "propertyDetails.name": chaletName });

        // const chalets = await Habitacion.findOne();
        // const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === chaletName);
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
        }


        arrivalDate.setUTCHours(chalet.others.arrivalTime.getHours());
        departureDate.setUTCHours(chalet.others.departureTime.getHours());

        if (privilege === "Inversionistas") {
            // Definicion de reglas de inversionistas
            // const documento = await Documento.find( { createdBy: mInvestorId } );
            const reservasDeInversionista = await Documento.find({ createdBy: mInvestorId, status: { $nin: ["cancelled", "no-show"] } });
            // const reservasDeInversionista = documento.filter(reserva => reserva.createdBy.toString() === investorId.toString());
            reservasDeInversionista.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));

            const reservaActiva = reservasDeInversionista.find(reserva => new Date(reserva.departureDate) > new Date());

            // arrivalDate.setUTCHours(chalet.others.arrivalTime.getHours());
            // departureDate.setUTCHours(chalet.others.departureTime.getHours());


            if (reservaActiva) {
                if (reservaActiva.status !== "cancelled") {
                    throw new Error('Ya tienes una reserva activa.')
                }
            }

            const mongooseChaletId = new mongoose.Types.ObjectId(chalet._id);
            const overlappingReservation = await Documento.findOne({
                resourceId: mongooseChaletId,
                status: { $nin: ["cancelled", "no-show", "playground"] },
                $and: [
                    { arrivalDate: { $lt: departureDateISO } }, // Start date overlaps or is before the departure date
                    { departureDate: { $gt: arrivalDateISO } }, // End date overlaps or is after the arrival date
                ],
            });

            if (overlappingReservation) {
                return res.status(400).send({
                    message: `La habitación ya está reservada entre ${overlappingReservation.arrivalDate.toISOString()} y ${overlappingReservation.departureDate.toISOString()}.`,
                });
            }


            // Verificar la regla de al menos 9 días entre reservas
            const nuevaLlegada = new Date(arrivalDate);

            for (let i = 0; i < reservasDeInversionista.length; i++) {
                const reserva = reservasDeInversionista[i];
                const salidaAnterior = new Date(reserva.departureDate);

                if ((nuevaLlegada - salidaAnterior) / (1000 * 60 * 60 * 24) < 9) {
                    throw new Error("Entre sus reservas tienen que pasar al menos 9 días.");
                }
            }

            if (nNights > 4) {
                throw new Error('No puedes reservar más de 4 noches, intenta de nuevo.')
            }
            console.log(arrivalDate)
            console.log(departureDate)
            const fechasBloqueadas = await BloqueoInversionistas.find({ date: { $gte: arrivalDate, $lte: departureDate }, habitacionId: chalet._id });
            console.log(fechasBloqueadas)
            if (fechasBloqueadas.length > 0) {
                throw new Error('Fechas bloqueadas para esas fechas, por favor intenta de nuevo con otras.')
            }
        }


        var reservationToAdd;

        const createdBy = new mongoose.Types.ObjectId(req.session.id);

        reservationToAdd = {
            resourceId: chalet._id,
            arrivalDate: arrivalDate,
            departureDate: departureDate,
            maxOccupation: maxOccupation,
            nNights: nNights,
            status: 'reserva de dueño',
            url: `https://${process.env.URL}/api/eventos/${chalet._id}`,
            createdBy: createdBy,
            clienteProvisional: clienteProvisional,
            total: 0
        };


        const newReservation = new Documento(reservationToAdd);
        await newReservation.save();


        // const documento = await Documento.findOne();
        // documento.events.push(reservationToAdd);
        // await documento.save();

        // Guardar la reserva actualizada en la base de datos
        // const documento2 = await Documento.findOne()

        const idReserva = newReservation._id.toString();
        const url = `https://${process.env.URL}/api/eventos/${idReserva}`;
        // const evento = documento2.events.find(habitacion => habitacion.id === idReserva);

        newReservation.url = url;
        await newReservation.save();

        await utilidadesController.altaComisionReturn({
            monto: 0,
            concepto: `Reserva de dueño/inversionista ${chalet.propertyDetails.name}`,
            fecha: new Date(departureDate),
            idUsuario: createdBy.toString(),
            idReserva: idReserva
        })

        if (privilege === "Inversionistas") {
            console.log('Entra')
            const costoLimpieza = chalet.additionalInfo.extraCleaningCost;
            console.log('Costo Limpieza: ', costoLimpieza)
            await utilidadesController.altaComisionReturn({
                monto: -costoLimpieza,
                concepto: `Limpieza Reserva de inversionista ${chalet.propertyDetails.name}`,
                fecha: new Date(departureDate),
                idUsuario: createdBy.toString(),
                idReserva: idReserva
            })

            const descripcionLimpieza = 'Limpieza ' + chaletName;
            const fechaLimpieza = new Date(arrivalDate);
            const checkInDate = new Date(arrivalDate)
            const checkOutDate = new Date(departureDate)
            fechaLimpieza.setDate(fechaLimpieza.getDate())
            const statusLimpieza = 'Pendiente'


            await rackLimpiezaController.createServiceForReservation({
                id_reserva: idReserva,
                descripcion: descripcionLimpieza,
                fecha: fechaLimpieza,
                checkInDate: checkInDate,
                checkOutDate: checkOutDate,
                status: statusLimpieza,
                idHabitacion: reservationToAdd.resourceId
            })

        }

        // Log
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: idReserva,
            acciones: `Reservación creada por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);


        res.status(200).json({ success: true, reservationId: idReserva });
    } catch (err) {
        console.log(err);
        res.status(500).send({ message: err.message });
        // return next(err);
    }
}

async function editarEvento(req, res) {
    try {
        const id = req.params.id;
        const privilege = req.session.privilege;
        const { resourceId, nNights, arrivalDate, departureDate, url, total } = req.body;
        console.log("Procesando solicitud de edición de evento con ID:", id);

        if (privilege !== "Administrador") {
            return res.status(401).send({ message: 'Solo los administradores pueden realizar esta acción.' });
        }

        const eventoOriginal = await Documento.findById(id);

        if (!eventoOriginal) {
            return res.status(404).send({ message: 'El evento no fue encontrado.' });
        }

        const chalet = await Habitacion.findById(eventoOriginal.resourceId);

        const arrivalHour = chalet.others.arrivalTime.getHours();
        const arrivalMinute = chalet.others.arrivalTime.getMinutes();
        const departureHour = chalet.others.departureTime.getHours();
        const departureMinute = chalet.others.departureTime.getMinutes();

        // 3) Parsear y setear hora en CDMX
        const arrivalMoment = moment
            .utc(arrivalDate, 'YYYY-MM-DD')
            .hour(arrivalHour)
            .minute(arrivalMinute)
            .second(0)
            .millisecond(0);

        const departureMoment = momentTz
            .utc(departureDate, 'YYYY-MM-DD')
            .hour(departureHour)
            .minute(departureMinute)
            .second(0)
            .millisecond(0);

        // 4) Convertir a Date
        const arrivalDateM = arrivalMoment.toDate();
        const departureDateM = departureMoment.toDate();

        const arrivalDateObj = new Date(arrivalDate);
        const departureDateObj = new Date(departureDate);

        // Set specific times
        arrivalDateObj.setUTCHours(17, 30, 0, 0); // 17:30:00 UTC
        departureDateObj.setUTCHours(14, 30, 0, 0); // 14:30:00 UTC

        // Convert back to ISO strings
        const arrivalDateISO = arrivalDateObj.toISOString();
        const departureDateISO = departureDateObj.toISOString();

        const mongooseChaletId = new mongoose.Types.ObjectId(resourceId);
        const overlappingReservation = await Documento.findOne({
            resourceId: mongooseChaletId,
            status: { $nin: ["cancelled", "no-show", "playground"] },
            $and: [
                { arrivalDate: { $lt: departureDateISO } }, // Start date overlaps or is before the departure date
                { departureDate: { $gt: arrivalDateISO } }, // End date overlaps or is after the arrival date
            ],
        });

        if (overlappingReservation) {
            return res.status(400).send({
                message: `La habitación ya está reservada entre ${overlappingReservation.arrivalDate.toISOString()} y ${overlappingReservation.departureDate.toISOString()}.`,
            });
        }

        // Create an update object with only the fields that are provided
        const updateFields = {};

        if (resourceId !== undefined) updateFields.resourceId = resourceId;
        if (nNights !== undefined) updateFields.nNights = nNights;
        if (arrivalDate !== undefined) updateFields.arrivalDate = arrivalDateM;
        if (departureDate !== undefined) updateFields.departureDate = departureDateM;
        if (url !== undefined) updateFields.url = url;
        if (total !== undefined) updateFields.total = total;

        // Update the document in one operation
        const evento = await Documento.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true } // This returns the updated document
        );

        if (!evento) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }

        // Create log entry for the event modification
        const logBody = {
            fecha: new Date(),
            idUsuario: req.session?.id,
            type: 'reservation',
            idReserva: id,
            acciones: `Reservación modificada por ${req.session?.firstName || 'Usuario'} ${req.session?.lastName || ''}`,
            nombreUsuario: `${req.session?.firstName || 'Usuario'} ${req.session?.lastName || ''}`
        };

        await logController.createBackendLog(logBody);

        if (chalet.channels?.length > 0) {

            const originalArrivalDate = new Date(eventoOriginal.arrivalDate);
            const originalDepartureDate = new Date(eventoOriginal.departureDate);

            // Generate date arrays for old and new periods
            const datesResponseBefore = channexController.generateDateArray(originalArrivalDate, originalDepartureDate);
            const datesResponseAfter = channexController.generateDateArray(evento.arrivalDate, evento.departureDate);

            console.log("Fechas anteriores a liberar: ", datesResponseBefore.length, "días");
            console.log("Fechas nuevas a ocupar: ", datesResponseAfter.length, "días");
            try {
                // First, free up the old dates
                if (datesResponseBefore.length > 0) {
                    await channexController.updateChannexAvailabilitySingle(evento.resourceId, datesResponseBefore, true);
                    console.log("Disponibilidad actualizada en Channex (fechas anteriores liberadas).");
                }
                // Then, occupy the new dates
                if (datesResponseAfter.length > 0) {
                    await channexController.updateChannexAvailabilitySingle(evento.resourceId, datesResponseAfter, false);
                    console.log("Disponibilidad actualizada en Channex (fechas nuevas ocupadas).");
                }
            } catch (error) {
                console.error("Error al actualizar disponibilidad en Channex: ", error.message);

                // TODO: Consider implementing rollback logic here
                // This could involve reverting the database changes if Channex update fails
                console.warn("La reserva fue modificada en la base de datos pero falló la actualización en Channex");

                throw error;
            }
        }

        console.log('Evento editado correctamente:', evento._id);
        res.status(200).json({ mensaje: 'Evento editado correctamente', evento });
    } catch (error) {
        console.error('Error al editar evento:', error);
        res.status(500).json({ error: error.message });
    }
}

async function editarEventoBackend(params, session) {
    try {
        const id = params.reservationId;
        const { nNights, arrivalDate, departureDate, newPrice } = params;
        console.log("Procesando solicitud de edición de evento");

        // Create an update object with only the fields that are provided
        const updateFields = {};

        if (nNights !== undefined) updateFields.nNights = nNights;
        if (arrivalDate !== undefined) updateFields.arrivalDate = arrivalDate;
        if (departureDate !== undefined) updateFields.departureDate = departureDate;
        if (newPrice !== undefined) updateFields.total = newPrice;

        // Update the document in one operation
        const evento = await Documento.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true } // This returns the updated document
        );

        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }

        // Create log entry for the event modification
        const logBody = {
            fecha: new Date(),
            idUsuario: session?.id,
            type: 'reservation',
            idReserva: id,
            acciones: `Reservación modificada por ${session?.firstName || 'Usuario'} ${session?.lastName || ''}`,
            nombreUsuario: `${session?.firstName || 'Usuario'} ${session?.lastName || ''}`
        };

        await logController.createBackendLog(logBody);

        console.log('Evento editado correctamente:', evento._id);
        return evento;
    } catch (error) {
        console.error('Error al editar evento:', error);
        return error;
    }
}

async function eliminarEvento(req, res) {
    try {
        const id = req.params.id;
        const eventoAeliminar = await Documento.findByIdAndDelete(id);

        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "CREATE_RESERVATIONS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para crear reservas");
        }


        if (!eventoAeliminar) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }
        // const eventosExistentes = await Documento.findOne();



        // if (!eventosExistentes) {
        //     return res.status(404).json({ mensaje: 'No se encontraron eventos' });
        // }

        // // Find the index of the room to delete by its ID
        // const index = eventosExistentes.events.findIndex(evento => evento.id === id);

        // if (index === -1) {
        //     return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        // }

        // // Remove the room from the array
        // eventosExistentes.events.splice(index, 1);

        // // Save the updated room list to the database
        // await eventosExistentes.save();

        const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(idReserva);

        if (comisionesReserva.length > 0) {
            for (const comision of comisionesReserva) {
                await utilidadesController.eliminarComisionReturn(comision._id);
            }
        }

        const habitacion = await Habitacion.findById(eventoAeliminar.roomId);

        if (!habitacion) {
            throw new Error("La habitación no fue encontrada");
        }

        if (habitacion.channels?.length > 0) {
            try {
                const arrivalDate = new Date(eventoAeliminar.arrivalDate);
                const departureDate = new Date(eventoAeliminar.departureDate);

                // Generate all dates between arrival and departure (excluding departure date)
                const datesResponse = [];
                const currentDate = new Date(arrivalDate);

                while (currentDate < departureDate) {
                    datesResponse.push({
                        date: {
                            date: new Date(currentDate)
                        }
                    });
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                await updateChannexAvailabilitySingle(habitacion._id, datesResponse, true);
                console.log("Disponibilidad actualizada en Channex (evento eliminado).");
            } catch (error) {
                console.error("Error al actualizar disponibilidad en Channex: ", error.message);
                throw error;
            }
        }

        // Log
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'elimination',
            acciones: `Reservación eliminada por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }
        await logController.createBackendLog(logBody);

        console.log('Evento eliminado con éxito');
        res.status(200).json({ mensaje: 'Evento eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar el evento:', error);
        res.status(500).json({ error });
    }
}

async function modificarEvento(req, res) {
    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "MODIFY_RESERVATION_STATUS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para modificar reservas");
        }

        const { event, newResource } = req.body;

        console.log('eventoRecibido: ', event);

        if (req.session.privilege !== "Administrador") {
            return res.status(403).json({ mensaje: 'No tienes permiso para modificar un evento.' });
        }

        // Obtener el ID del evento y la nueva fecha
        const eventId = req.params.id;
        let newStartDate = event.start;
        let newEndDate = event.end;
        let newTotal = event.extendedProps.nuevoTotal

        console.log("new total: ", newTotal)

        // Buscar el evento existente por su ID
        // const eventosExistentes = await Documento.findOne();
        // const evento = eventosExistentes.events.find(evento => evento.id === eventId);
        const evento = await Documento.findById(eventId);
        const eventoOriginal = evento.toObject();


        if (!evento) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        } else {
            console.log('evento encontrado: ', evento);
        }

        if (evento.status === "reserva de dueño") {
            newTotal = 0
        }



        // Actualizar la fecha de inicio y fin del evento existente
        evento.arrivalDate = newStartDate;
        evento.departureDate = newEndDate;
        evento.total = newTotal;

        if (newResource) {
            console.log(newResource)
            const newResourceId = newResource.id;
            evento.resourceId = newResourceId;

        }

        // Guardar el evento actualizado en la base de datos
        await evento.save();

        console.log('Evento modificado:', evento);

        newStartDate = new Date(newStartDate)
        newEndDate = new Date(newEndDate)

        const newStartDateFormatted = newStartDate.getDate() + "-" + newStartDate.getMonth() + "-" + newStartDate.getFullYear();
        const newEndDateFormatted = newEndDate.getDate() + "-" + newEndDate.getMonth() + "-" + newEndDate.getFullYear();

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: eventId,
            acciones: `Modificación de fechas por ${req.session.firstName} ${req.session.lastName} (A ${newStartDateFormatted} - ${newEndDateFormatted})`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }
        await logController.createBackendLog(logBody);

        const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(eventId);

        const newComisiones = comisionesReserva.map(comisiones => {
            return {
                id: comisiones._id,
                fecha: newEndDate,
            }
        })


        const comisionsResults = [];
        for (const comision of newComisiones) {
            const cRes = await utilidadesController.editarComisionReturn(comision);
            if (cRes) { comisionsResults.push(cRes); }
        }

        const originalArrivalDate = new Date(eventoOriginal.arrivalDate);
        const originalDepartureDate = new Date(eventoOriginal.departureDate);
        // Generate date arrays for old and new periods
        const datesResponseBefore = channexController.generateDateArray(originalArrivalDate, originalDepartureDate);
        const datesResponseAfter = channexController.generateDateArray(evento.arrivalDate, evento.departureDate);
        console.log("Fechas anteriores a liberar: ", datesResponseBefore.length, "días");
        console.log("Fechas nuevas a ocupar: ", datesResponseAfter.length, "días");

        try {
            // First, free up the old dates
            if (datesResponseBefore.length > 0) {
                await channexController.updateChannexAvailabilitySingle(evento.resourceId, datesResponseBefore, true);
                console.log("Disponibilidad actualizada en Channex (fechas anteriores liberadas).");
            }
            // Then, occupy the new dates
            if (datesResponseAfter.length > 0) {
                await channexController.updateChannexAvailabilitySingle(evento.resourceId, datesResponseAfter, false);
                console.log("Disponibilidad actualizada en Channex (fechas nuevas ocupadas).");
            }
        } catch (error) {
            console.error("Error al actualizar disponibilidad en Channex: ", error.message);

            // TODO: Consider implementing rollback logic here
            // This could involve reverting the database changes if Channex update fails
            console.warn("La reserva fue modificada en la base de datos pero falló la actualización en Channex");
            error.message = "La reserva fue modificada en la base de datos pero falló la actualización en Channex";

            throw error;
        }



        res.status(200).json({ mensaje: 'Evento modificado correctamente', evento: evento });
    } catch (error) {
        console.error('Error al modificar el evento:', error);
        res.status(500).json({ error });
    }
}

async function checkAvailability(resourceId, arrivalDate, departureDate, eventId = null, nNights) {
    console.log("nNights: ", nNights);
    const newResourceId = new mongoose.Types.ObjectId(resourceId);
    const arrivalDateObj = new Date(`${arrivalDate}T00:00:00`);
    const departureDateObj = new Date(`${departureDate}T00:00:00`);

    // Convertir a formato ISO para comparar con la base de datos
    const arrivalDateBloqueo = arrivalDateObj.toISOString();
    const departureDateBloqueo = departureDateObj.toISOString();

    const arrivalDateISO = new Date(`${arrivalDate}T11:30:00`).toISOString();
    const departureDateISO = new Date(`${departureDate}T08:30:00`).toISOString();

    console.log("ARRIVAL DATE: ", arrivalDateISO, "DEPARTURE DATE: ", departureDateISO);

    const isBlocked = await BloqueoFechas.exists({
        habitacionId: newResourceId,
        type: 'bloqueo',
        date: { $gte: arrivalDateBloqueo, $lte: departureDateBloqueo },
    });

    if (isBlocked) {
        console.log("IS BLOCKED: ", isBlocked)
        return false;
    }

    const habitacion = await Habitacion.findById(newResourceId);
    if (habitacion.isActive === false) {
        return false;
    }

    // Query events with overlapping dates in MongoDB
    const overlappingEvents = await Documento.find({
        resourceId: newResourceId,
        status: { $nin: ["cancelled", "no-show", "playground"] },
        $or: [
            { arrivalDate: { $lt: departureDateISO }, departureDate: { $gt: arrivalDateISO } },
        ],
    });

    console.log("OVERLAPPING EVENTS: ")
    console.log(overlappingEvents)

    const fechaAjustada = new Date(arrivalDate);
    fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC


    const fechasBloqueadasPorRestriccion = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: resourceId, type: 'restriccion' });
    if (fechasBloqueadasPorRestriccion) {
        if (nNights < fechasBloqueadasPorRestriccion.min) {
            return false;
        }
    }


    // Exclude the current event (if `eventId` is provided)
    const validEvents = overlappingEvents.filter((event) => !eventId || event._id.toString() !== eventId);

    // Availability is true if there are no valid overlapping events
    return validEvents.length === 0;
}

async function moveToPlayground(req, res) {
    const { idReserva, status } = req.body;
    console.log(req.body)
    console.log(idReserva)

    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            throw new Error("El usuario no tiene un rol definido, contacte al administrador");
        }

        const permittedRole = "MODIFY_RESERVATION_STATUS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            throw new Error("El usuario no tiene permiso para modificar reservas");
        }

        const evento = await Documento.findById(idReserva);
        const chalet = await Habitacion.findById(evento.resourceId);
        // const eventosExistentes = await Documento.findOne();
        // const evento = eventosExistentes.events.find(evento => evento._id.toString() === idReserva);

        // const chalets = await Habitacion.findOne();
        // const chalet = chalets.resources.find(chalet => chalet._id.toString() === evento.resourceId.toString());
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist');
        }



        if (!['active', 'playground', 'cancelled', 'no-show'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }

        if (evento.status === status) {
            throw new Error('El evento ya estaba en ese estatus');
        }

        if (evento.status === 'no-show') {
            throw new Error('No se pueden hacer modificaciones a esta reserva');
        }

        if (evento.status === 'active' && status === 'playground') {
            const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(idReserva);

            const newComisiones = comisionesReserva.map(comisiones => {
                return {
                    id: comisiones._id,
                    // monto: comisiones.monto / 2,
                    status: 'pendiente'
                }
            })

            for (const comision of newComisiones) {
                await utilidadesController.editarComisionReturn(comision);
            }

        }

        if (evento.status === 'playground' && status === 'active') {
            const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(idReserva);


            const newComisiones = comisionesReserva.map(comisiones => {
                return {
                    id: comisiones._id,
                    // monto: comisiones.monto / 2,
                    status: 'aplicado'
                }
            })


            for (const comision of newComisiones) {
                await utilidadesController.editarComisionReturn(comision);
            }
        }

        if (evento.status === 'active' && status === 'cancelled') {
            if (req.session.privilege !== "Administrador") {
                throw new Error("Solo los administradores pueden cancelar reservas.")
            }
            const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(idReserva);

            const pagos = await pagoController.obtenerPagos(idReserva);
            let pagoTotal = 0
            pagos.forEach(pago => {
                pagoTotal += pago.importe;
            })
            const totalReserva = evento.total;
            const montoPendiente = totalReserva - pagoTotal;

            const pagoDel50 = (montoPendiente <= totalReserva / 2) ? true : false;

            if (!pagoDel50) {
                if (pagoTotal < 1) {
                    for (const comisiones of comisionesReserva) {
                        const utilidadEliminada = await utilidadesController.eliminarComisionReturn(comisiones._id);
                        if (utilidadEliminada) {
                            console.log('Utilidad eliminada correctamente');
                        } else {
                            throw new Error('Error al eliminar comision.');
                        }
                    }

                    const eventoAeliminar = await Documento.findByIdAndDelete(idReserva);
                    if (!eventoAeliminar) {
                        throw new Error('El evento no fue encontrado');
                    }

                    // Find the index of the room to delete by its ID
                    // const index = eventosExistentes.events.findIndex(evento => evento.id.toString() === idReserva.toString());

                    // if (index === -1) {
                    //     return res.status(404).json({ message: 'El evento no fue encontrado' });
                    // }

                    // // Remove the room from the array
                    // eventosExistentes.events.splice(index, 1);

                    // // Save the updated room list to the database
                    // await eventosExistentes.save();
                    console.log("Reserva cancelada de la base de datos.")
                    if (chalet.channels?.length > 0) {
                        try {
                            const arrivalDate = new Date(eventoAeliminar.arrivalDate);
                            const departureDate = new Date(eventoAeliminar.departureDate);

                            // Generate all dates between arrival and departure (excluding departure date)
                            const datesResponse = [];
                            const currentDate = new Date(arrivalDate);

                            while (currentDate < departureDate) {
                                datesResponse.push({
                                    date: {
                                        date: new Date(currentDate)
                                    }
                                });
                                currentDate.setDate(currentDate.getDate() + 1);
                            }
                            await channexController.updateChannexAvailabilitySingle(chalet._id, datesResponse, true);
                            console.log("Disponibilidad actualizada en Channex (evento eliminado).");
                        } catch (error) {
                            console.error("Error al actualizar disponibilidad en Channex: ", error.message);
                            throw error;
                        }
                    }

                    return res.status(200).json({ message: 'Reserva cancelada' });

                } else {
                    for (const comisiones of comisionesReserva) {
                        const utilidadEliminada = await utilidadesController.eliminarComisionReturn(comisiones._id);
                        if (utilidadEliminada) {
                            console.log('Utilidad eliminada correctamente');
                        } else {
                            throw new Error('Error al eliminar comision.');
                        }
                    }

                    utilidadesController.altaComisionReturn({
                        monto: pagoTotal,
                        concepto: `Reserva cancelada remanente depositado`,
                        status: 'aplicado',
                        fecha: evento.arrivalDate,
                        idReserva: evento.idReserva,
                        idUsuario: chalet.others.admin
                    })
                    evento.status = 'cancelled';
                    await evento.save();
                    console.log("Reserva cancelada (cambio de status)")

                    if (chalet.channels?.length > 0) {
                        try {
                            const arrivalDate = new Date(eventoAeliminar.arrivalDate);
                            const departureDate = new Date(eventoAeliminar.departureDate);

                            // Generate all dates between arrival and departure (excluding departure date)
                            const datesResponse = [];
                            const currentDate = new Date(arrivalDate);

                            while (currentDate < departureDate) {
                                datesResponse.push({
                                    date: {
                                        date: new Date(currentDate)
                                    }
                                });
                                currentDate.setDate(currentDate.getDate() + 1);
                            }
                            await channexController.updateChannexAvailabilitySingle(chalet._id, datesResponse, true);
                            console.log("Disponibilidad actualizada en Channex (evento eliminado).");
                        } catch (error) {
                            console.error("Error al actualizar disponibilidad en Channex: ", error.message);
                            throw error;
                        }
                    }
                    return res.status(200).json({ message: 'Reserva cancelada' });
                }
            }
        }

        if (status === "cancelled") {
            if (req.session.privilege !== "Administrador") {
                throw new Error("Solo los administradores pueden cancelar reservas.")
            }
        }

        if (status === 'no-show') {
            const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(idReserva);

            const pagos = await pagoController.obtenerPagos(idReserva);
            let pagoTotal = 0
            pagos.forEach(pago => {
                pagoTotal += pago.importe;
            })
            const totalReserva = evento.total;
            const montoPendiente = totalReserva - pagoTotal;

            const pagoDel50 = (montoPendiente <= totalReserva / 2) ? true : false;

            if (pagoDel50) {
                const mitadDelTotal = totalReserva / 2;
                const remanente = pagoTotal - mitadDelTotal;

                if (remanente >= 1) {
                    utilidadesController.altaComisionReturn({
                        monto: remanente,
                        concepto: `Remanente pago No Show`,
                        status: 'aplicado',
                        fecha: evento.arrivalDate,
                        idReserva: evento._id,
                        idUsuario: chalet.others.admin
                    })
                }

                const newComisiones = [];
                for (const comisiones of comisionesReserva) {
                    if (comisiones.concepto.includes('limpieza')) {
                        const utilidadEliminada = await utilidadesController.eliminarComisionReturn(comisiones._id);
                        if (utilidadEliminada) {
                            console.log('Utilidad eliminada correctamente');
                            if (chalet.others.owner) {
                                utilidadesController.altaComisionReturn({
                                    monto: utilidadEliminada.monto / 2,
                                    concepto: `(Reserva No Show (limpieza), 50%)`,
                                    status: 'aplicado',
                                    fecha: utilidadEliminada.fecha,
                                    idReserva: utilidadEliminada.idReserva,
                                    idUsuario: chalet.others.owner
                                })
                            }
                        } else {
                            throw new Error('Error al eliminar comision.');
                        }
                    } else {
                        newComisiones.push({
                            id: comisiones._id,
                            monto: comisiones.monto / 2,
                            concepto: `${comisiones.concepto} (Reserva No Show, 50%)`,
                            status: 'aplicado'
                        });
                    }
                }

                for (const comision of newComisiones) {
                    await utilidadesController.editarComisionReturn(comision);
                }
            } else {
                throw new Error("No se puede marcar como no show si el 50% no ha sido pagado.");
            }
        }

        if (evento.status === "reserva de dueño" && status === "cancelled") {
            const comisionesReserva = await utilidadesController.obtenerComisionesPorReserva(idReserva);
            console.log("Entra a reserva de dueño cancelar")
            if (comisionesReserva.length > 0) {
                for (const comision of comisionesReserva) {
                    await utilidadesController.eliminarComisionReturn(comision._id);
                }
            }

        }

        evento.status = status;
        const confirmation = await evento.save();
        if (!confirmation) {
            throw new Error('No se pudo actualizar el evento');
        }

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: idReserva,
            acciones: `Estatus editado a ${status} por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);

        res.status(200).json({ message: 'Estaus modificado correctamente', reserva: evento });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error al modificar status: ' + error });
    }
}

async function crearNota(req, res) {
    const idReserva = req.params.id;
    const userPrivilege = req.session.privilege;
    const { texto, tipoNota } = req.body;

    try {
        // const eventosExistentes = await Documento.findOne(); // Buscar el documento que contiene los eventos

        // if (!eventosExistentes) {
        //     throw new Error('No se encontraron eventos');
        // }

        // Buscar el evento por su id
        // const evento = eventosExistentes.events.find(evento => evento._id.toString() === idReserva);
        const evento = await Documento.findById(idReserva);

        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }

        if (tipoNota === "Nota privada") {
            const userRole = req.session.role;

            const userPermissions = await Roles.findById(userRole);
            if (!userPermissions) {
                // throw new Error("El usuario no tiene un rol definido, contacte al administrador");
                throw new Error("El usuario no tiene un rol definido, contacte al administrador");
            }

            const permittedRole = "ADD_PRIVATE_NOTES";
            if (!userPermissions.permissions.includes(permittedRole)) {
                // throw new Error("El usuario no tiene permiso para ver utilidades globales.");
                throw new Error("El usuario no tiene permiso para agregar notas privadas.");
            }

            // if (!userPrivilege.includes('Administrador') && !userPrivilege.includes('Vendedor')) {
            //     throw new Error('No tienes permisos para crear notas privadas');
            // }
            evento.privateNotes.push({ texto });
        } else {
            evento.notes.push({ texto });

        }


        await evento.save();
        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: idReserva,
            acciones: `Nota creada por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);
        res.status(200).json({ message: 'Nueva nota agregada exitosamente a la reserva.' });


    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
}

async function eliminarNota(req, res) {
    const idReserva = req.query.idReserva; // Obtener el ID de la reserva desde los parámetros de la consulta
    const idNota = req.query.idNota; // Obtener el ID de la nota a eliminar desde los parámetros de la consulta
    const userPrivilege = req.session.privilege;


    try {
        // Buscar el documento que contiene los eventos
        // const documento = await Documento.findOne();

        // if (!documento) {
        //     throw new Error('No se encontraron eventos');
        // }

        // Buscar el evento por su ID dentro del array de eventos
        // const evento = documento.events.find(evento => evento._id.toString() === idReserva);

        const evento = await Documento.findById(idReserva);


        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }

        // Encontrar la nota por su ID dentro del array de notas del evento
        const indexNota = evento.notes.findIndex(nota => nota._id.toString() === idNota);

        if (indexNota === -1) {


            const indexNotaPrivada = evento.privateNotes.findIndex(nota => nota._id.toString() === idNota);
            if (indexNotaPrivada === -1) {
                throw new Error('La nota no fue encontrada en el evento');
            }
            if (!userPrivilege.includes('Administrador') && !userPrivilege.includes('Vendedor')) {
                throw new Error('No tienes permisos para borrar notas privadas');
            }
            evento.privateNotes.splice(indexNota, 1);


        } else {
            evento.notes.splice(indexNota, 1);

        }

        // Eliminar la nota del array de notas del evento

        // Guardar el documento actualizado en la base de datos
        await evento.save();

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: idReserva,
            acciones: `Nota eliminada por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);

        res.status(200).json({ message: 'Nota eliminada exitosamente de la reserva.' });
    } catch (error) {
        // Manejar cualquier error y enviar una respuesta de error al cliente
        console.error('Error al eliminar la nota:', error.message);
        res.status(500).json({ message: error.message });

    }
}

function cifrarMensaje(mensaje, desplazamiento) {
    desplazamiento = (desplazamiento % 26 + 26) % 26; // Asegurar que el desplazamiento esté en el rango adecuado

    return mensaje.replace(/[a-zA-Z]/g, function (letra) {
        var codigo = letra.charCodeAt(0);
        var inicio = letra >= 'a' ? 'a'.charCodeAt(0) : 'A'.charCodeAt(0);
        return String.fromCharCode(inicio + (codigo - inicio + desplazamiento) % 26);
    });
}

async function sendReservationMail(req, res) {
    const { email, reservationId } = req.body;
    try {
        sendEmail(email, reservationId);
        res.status(200).json({ message: 'Correo enviado exitosamente' });
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        res.status(500).json({ message: 'Error al enviar el correo' });
    }
}

async function cotizadorView(req, res) {
    try {
        const tipologias = await Tipologias.find().lean();
        const clientes = await Cliente.find().lean();

        res.render('cotizador', {
            layout: 'tailwindMain',
            tipologias,
            clientes
        });
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        res.status(500).json({ message: 'Error al renderizar la pagina' });
    }
}

async function cotizadorClientesView(req, res) {
    try {
        const tipologias = await Tipologias.find().lean();
        const clientes = await Cliente.find().lean();

        const ubicaciones = await Habitacion.find({}, 'location').lean();

        const habitacionesConUbicacion = ubicaciones.map(habitacion => {
            const id = habitacion._id.toString();
            const estado = habitacion.location.state;
            const municipio = habitacion.location.population;
            const latitud = habitacion.location.latitude;
            const longitud = habitacion.location.longitude;
            return { id, estado, municipio, latitud, longitud };
        })

        const ubicacionesAgrupadas = groupLocationsByMunicipality(habitacionesConUbicacion);
        const ubicacionesAgrupadasArray = Object.keys(ubicacionesAgrupadas);

        res.render('cotizadorParaClientes', {
            layout: 'tailwindMainPublic',
            tipologias,
            clientes,
            ubicaciones: ubicacionesAgrupadasArray
        });
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        res.status(500).json({ message: 'Error al renderizar la pagina' });
    }
}

function groupLocationsByMunicipality(locations) {
    // First, standardize the data
    const standardizedLocations = locations.map(location => {
        return {
            id: location.id,
            estado: typeof location.estado === 'string' ? location.estado.charAt(0).toUpperCase() + location.estado.slice(1).toLowerCase() : location.estado,
            municipio: typeof location.municipio === 'string' ? location.municipio.charAt(0).toUpperCase() + location.municipio.slice(1).toLowerCase() : location.municipio,
            // Convert coordinates to standard decimal format if needed
            latitud: typeof location.latitud === 'number' && location.latitud > 1000 ? location.latitud / 10000 : location.latitud,
            longitud: typeof location.longitud === 'number' && Math.abs(location.longitud) > 1000 ? location.longitud / 10000 : location.longitud
        };
    });

    // Fix the record with wrong state value (where estado is "Mazamitla")
    standardizedLocations.forEach(location => {
        if (location.estado === "Mazamitla") {
            location.estado = "Jalisco";
        }
    });

    // Group by municipio
    const groupedByMunicipality = {};

    standardizedLocations.forEach(location => {
        const municipio = location.municipio;

        if (!groupedByMunicipality[municipio]) {
            groupedByMunicipality[municipio] = [];
        }

        groupedByMunicipality[municipio].push(location);
    });

    return groupedByMunicipality;
}

async function cotizadorChaletsyPrecios(req, res) {
    try {
        const { categorias, fechaLlegada, fechaSalida, huespedes, soloDisponibles, isForClient, noVendedor } = req.body;

        if (!req.session.token && !isForClient) {
            if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
                const token = req.headers.authorization.split(' ')[1];
                const payload = jwt.verify(token, process.env.JWT_SECRET, {
                    algorithms: ['HS256'],
                    clockTolerance: 5,
                });

                // OJO: toma el id como sub || userId || id (según cómo lo firmaste en login)
                const userId = payload.sub || payload.userId || payload.id;
                if (!userId) {
                    return res.status(401).json({ message: 'Invalid token payload' });
                }

                const user = await Usuario.findById(userId).lean();
                if (!user) {
                    return res.status(401).json({ message: 'Invalid user' });
                }

                // Emula req.session para tu código legacy
                req.session = {
                    token,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    privilege: user.privilege,
                    id: user._id,
                    userId: String(user._id),
                    profileImageUrl: user.profileImageUrl ?? null,
                    role: user.role,
                    assignedChalets: user.assignedChalets ?? [],
                };
            } else {
                return res.status(401).json({ message: 'Por inactividad, es necesario recargar la página para continuar' });
            }
        }

        let filtro = {};

        if (!categorias.includes("all")) { //Si se seleccionaron categorias
            if (isForClient) {
                if (categorias.length > 1) {
                    for (let categoria of categorias) {
                        categorias.push(categoria.toLowerCase());
                    }
                } else {
                    categorias.push(categorias[0].toLowerCase());
                }
                console.log(categorias)
                filtro = {
                    "location.population": { $in: categorias },
                    "propertyDetails.maxOccupancy": { $gte: huespedes },
                    "propertyDetails.minOccupancy": { $lte: huespedes },
                    isActive: true
                }
            } else {
                filtro = {
                    "propertyDetails.accomodationType": { $in: categorias },
                    "propertyDetails.maxOccupancy": { $gte: huespedes },
                    "propertyDetails.minOccupancy": { $lte: huespedes },
                    isActive: true
                }
            };
        } else { // Si se mostrara todo
            filtro = {
                "propertyDetails.maxOccupancy": { $gte: huespedes },
                "propertyDetails.minOccupancy": { $lte: huespedes },
                isActive: true
            };
        }


        const startDate = new Date(convertirFechaES(fechaLlegada));
        startDate.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC
        const endDate = new Date(convertirFechaES(fechaSalida));
        endDate.setUTCHours(0); // Ajustar la hora a 06:00:00 UTC


        const timeDifference = endDate.getTime() - startDate.getTime();
        const nNights = Math.ceil(timeDifference / (1000 * 3600 * 24)); // Calcula la diferencia en días
        if (nNights <= 0) {
            return res.status(400).json({ message: 'La fecha de salida debe ser posterior a la fecha de llegada' });
        }


        const chalets = await Habitacion.find(filtro).lean();
        const chaletIds = chalets.map(chalet => chalet._id);
        if (!chalets) {
            throw new Error('No se encontraron habitaciones');
        }


        let availableChalets = chalets;

        const fechaAjustada = moment(startDate).add(6, 'hours').toDate(); // Ajustar la hora a 00:00:00 UTC

        if (soloDisponibles) {
            availableChalets = [];
            for (const chalet of chalets) {
                const disponibilidadPax = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: chalet._id, type: 'capacidad_minima' });
                if (disponibilidadPax) {
                    if (huespedes < disponibilidadPax.min) {
                        continue;
                    }
                }
                const disponibilidadNochesMinimas = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: chalet._id, type: 'restriccion' });
                if (disponibilidadNochesMinimas) {
                    if (nNights < disponibilidadNochesMinimas.min) {
                        continue;
                    }
                }

                const disponibilidad = await getDisponibilidad(chalet._id, startDate, endDate);
                if (disponibilidad) {
                    availableChalets.push(chalet);
                }
            }
        }



        const mappedChalets = availableChalets.map(chalet => ({

            id: chalet._id,
            name: chalet.propertyDetails.name,
            minPax: chalet.propertyDetails.minOccupancy,
            maxPax: chalet.propertyDetails.maxOccupancy,
            precioBase: chalet.others.basePrice,
            precioBase2noches: chalet.others.basePrice2nights,
            costoBase: chalet.others.baseCost,
            costoBase2noches: chalet.others.baseCost2nights,
            images: chalet.images,
            accomodationFeatures: chalet.accommodationFeatures,
            accomodationDescription: chalet.accomodationDescription,
            nBeds: chalet.additionalInfo.nBeds,
            nRestrooms: chalet.additionalInfo.nRestrooms
        }));

        const eventoParaReservar = {
            nights: nNights,
            fechaLlegada: fechaLlegada,
            fechaSalida: fechaSalida,
            huespedes: huespedes
        }

        const infoComisiones = {
            userId: req.session.id,
            nNights: nNights,
            noVendedor: noVendedor

        }
        const comisiones = await utilidadesController.calcularComisionesInternas(infoComisiones);

        if (!comisiones) {
            throw new Error("No se encontró al usuario");
        }


        if (startDate > endDate) {
            throw new Error("La fecha de llegada debe ser anterior a la fecha de salida");
        }

        for (const chalet of mappedChalets) {
            let precioTotal = 0;
            let costoBaseTotal = 0;

            let currentDate = new Date(startDate);
            //Calculando precio para:  2025-09-03T00:00:00.000Z  - Hasta:  2025-09-05T00:00:00.000Z
            while (currentDate <= endDate) {
                currentDate.setUTCHours(6);
                precio = await PreciosEspeciales.findOne({ fecha: currentDate, habitacionId: chalet.id, noPersonas: huespedes });
                if (precio) {
                    if (nNights > 1) {
                        precioTotal += precio.precio_base_2noches;
                        costoBaseTotal += precio.costo_base_2noches;
                    } else {
                        precioTotal += precio.precio_modificado;
                        costoBaseTotal += precio.costo_base;
                    }
                } else {
                    precio = await PrecioBaseXDia.findOne({ fecha: currentDate, habitacionId: chalet.id });
                    if (precio) {
                        if (nNights > 1) {
                            precioTotal += precio.precio_base_2noches;
                            costoBaseTotal += precio.costo_base_2noches;
                        } else {
                            precioTotal += precio.precio_modificado;
                            costoBaseTotal += precio.costo_base;
                        }
                    } else {
                        if (nNights > 1) {
                            precioTotal += chalet.precioBase2noches;
                            costoBaseTotal += chalet.costoBase2noches;
                        } else {
                            precioTotal += chalet.precioBase;
                            costoBaseTotal += chalet.costoBase;
                        }
                    }

                }
                currentDate.setDate(currentDate.getDate() + 1); // Avanzar un día
            }
            chalet.totalPriceNoComs = precioTotal;
            chalet.totalPrice = precioTotal + comisiones;
            chalet.totalCost = costoBaseTotal;
            // eventoParaReservar.precioTotal = chalet.price;
            console.log("Precio Total: ", precioTotal);
            // chalet.price = precioTotal;
        }


        res.status(200).json({ chalets: mappedChalets, evento: eventoParaReservar }); // Enviar los datos de las habitaciones y el eventomappedChalets

    } catch (error) {
        console.error('Error al obtener habitaciones y precios:', error);
        res.status(500).json({ message: 'Error al obtener habitaciones y precios: ' + error.message });
    }
}
// Para obtener habitaciones disponibles para flutter
async function obtenerHabitacionesDisponibles(req, res) {
    try {
        console.log(req.query);
        console.log(req.params);
        const { fechaLlegada, fechaSalida } = req.query ?? {};
        let tipologia = req.query.tipo == 'Mostrar todo' ? 'all' : req.query.tipo;

        if (!fechaLlegada || !fechaSalida) {
            return res.status(400).json({ message: 'fechaLlegada y fechaSalida son requeridos' });
        }

        const startDate = parseDateFlexible(fechaLlegada);
        const endDate = parseDateFlexible(fechaSalida);

        // noches
        const nNights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (isNaN(nNights) || nNights <= 0) {
            return res.status(400).json({ message: 'La fecha de salida debe ser posterior a la fecha de llegada' });
        }

        // Filtro base (solo campos necesarios para performance)
        const filtro = {
            isActive: true,
        };

        // Tipología opcional
        if (tipologia && tipologia !== 'all') {
            const lista = Array.isArray(tipologia) ? tipologia : [tipologia];
            filtro['propertyDetails.accomodationType'] = { $in: lista };
        }

        console.log("filtro: ", filtro);
        // Trae solo lo que usaremos → mapea a RoomOption
        const chalets = await Habitacion.find(filtro)
            .select({
                _id: 1,
                'propertyDetails.name': 1,
                'propertyDetails.maxOccupancy': 1,
                'propertyDetails.accomodationType': 1,
                'others.basePrice': 1,
            })
            .lean();

        if (!chalets || chalets.length === 0) {
            return res.status(200).json({ rooms: [], meta: { nNights, total: 0 } });
        }

        console.log(chalets);

        // Ajuste para consultas de bloqueos (tu código original usa 06:00 UTC)
        const fechaAjustada = moment(startDate).utc().add(6, 'hours').toDate();

        const disponibles = [];

        // Chequeo secuencial (puedes paralelizar con Promise.allSettled si lo deseas)
        for (const c of chalets) {
            const chaletId = c._id;

            // 2) Restricción de noches mínimas (restriccion)
            const nochesMin = await BloqueoFechas.findOne({
                date: fechaAjustada,
                habitacionId: chaletId,
                type: 'restriccion',
            }).lean();

            if (nochesMin && nNights < Number(nochesMin.min)) {
                continue; // no cumple noches mínimas
            }

            // 3) Disponibilidad real en el rango
            const libre = await getDisponibilidad(chaletId, startDate, endDate);
            if (!libre) continue;

            // 4) Map a RoomOption
            disponibles.push({
                id: chaletId,
                nombre: c.propertyDetails?.name ?? 'Habitación',
                ocMax: c.propertyDetails?.maxOccupancy ?? 0,
                basePrice: c.others?.basePrice ?? 0,
                tipo: c.propertyDetails?.accomodationType ?? 'N/D',
            });
        }
        console.log("RESPUESTA: ")
        console.log(JSON.stringify(disponibles));
        return res.status(200).json({
            rooms: disponibles,
            meta: { nNights, total: disponibles.length, fechaLlegada: startDate, fechaSalida: endDate },
        });
    } catch (err) {
        console.error('Error en obtenerHabitacionesDisponibles:', err);
        return res.status(500).json({ message: 'Error al obtener disponibilidad: ' + err.message });
    }
}

function convertirFechaES(fecha) {
    const [dia, mes, anio] = fecha.split("/");
    return `${anio}-${mes}-${dia}`; // Formato YYYY-MM-DD
}

async function getDisponibilidad(chaletId, fechaLlegada, fechaSalida) {
    const newResourceId = new mongoose.Types.ObjectId(chaletId);

    // Convertir fechas a cadenas en formato YYYY-MM-DD
    const fechaLlegadaStr = fechaLlegada.toISOString().split('T')[0]; // Extrae solo la fecha (YYYY-MM-DD)
    const fechaSalidaStr = fechaSalida.toISOString().split('T')[0]; // Extrae solo la fecha (YYYY-MM-DD)

    const arrivalDateObj = new Date(fechaLlegada);
    const departureDateObj = new Date(fechaSalida);

    // Set specific times
    arrivalDateObj.setUTCHours(17, 30, 0, 0); // 17:30:00 UTC
    departureDateObj.setUTCHours(13, 0, 0, 0); // 14:30:00 UTC

    // Convert back to ISO strings
    const arrivalDateISO = arrivalDateObj.toISOString();
    const departureDateISO = departureDateObj.toISOString();

    console.log("ARRIVAL DATE: ", arrivalDateISO, "DEPARTURE DATE: ", departureDateISO);

    const arrivalDateBloqueo = new Date(`${fechaLlegadaStr}T10:00:00`).toISOString();
    const departureDateBloqueo = new Date(`${fechaSalidaStr}T06:00:00`).toISOString();

    // console.log("ARRIVAL DATE: ", arrivalDateISO, "DEPARTURE DATE: ", departureDateISO);
    // Verificar fechas bloqueadas
    let fechaAjustada = new Date(fechaLlegada);
    const departureDateAjustada = new Date(fechaSalida);
    departureDateAjustada.setUTCHours(6);
    let currentDate = new Date(fechaAjustada);
    currentDate.setUTCHours(17);

    let isBlocked = false;
    while (currentDate <= departureDateAjustada) {
        const fechasBloqueadas = await BloqueoFechas.findOne({ date: currentDate, habitacionId: newResourceId, type: 'bloqueo' });
        if (fechasBloqueadas) {
            isBlocked = true;
            break;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (isBlocked) {
        console.log("FECHAS BLOQUEADAS ENCONTRADAS");
        return false;
    }

    // Verificar eventos superpuestos
    const overlappingEvents = await Documento.find({
        resourceId: newResourceId,
        status: { $nin: ["cancelled", "no-show", "playground"] },
        $or: [
            { arrivalDate: { $lt: departureDateISO }, departureDate: { $gt: arrivalDateISO } },
        ],
    });

    if (overlappingEvents.length > 0) {
        console.log("EVENTOS SUPERPUESTOS ENCONTRADOS");
        console.log(overlappingEvents);
        return false;
    }

    return true;
}

async function getIncomingReservations(req, res) {
    const { start, end, chaletId } = req.query;
    console.log("Query params:", { start, end, chaletId });

    try {
        console.log(req.session);

        const privilege = req.session?.privilege; // "Vendedor" | "Dueño de cabañas" | "Administrador"
        const assignedChalets = Array.isArray(req.session?.assignedChalets)
            ? req.session.assignedChalets
            : [];
        const sessionUserId =
            req.session?.userId ||
            req.session?.user?._id ||
            req.session?.user?._id?.toString?.();

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7); // 7 días atrás
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // 7 días adelante

        ObjectId = mongoose.Types.ObjectId;

        // ---------- Determinar universo permitido de resourceIds según privilegio ----------
        // allowedResourceIds: null => sin restricción (Administrador)
        let allowedResourceIds = null; // Set<string>

        if (privilege === "Vendedor") {
            const asObjectIds = assignedChalets.map(id =>
                ObjectId.isValid(id) ? new ObjectId(id).toString() : id.toString()
            );
            allowedResourceIds = new Set(asObjectIds);

        } else if (privilege === "Dueño de cabañas") {
            if (!sessionUserId) {
                // No podemos determinar la propiedad sin usuario en sesión
                return res.json([]);
            }
            const ownerId = ObjectId.isValid(sessionUserId)
                ? new ObjectId(sessionUserId)
                : sessionUserId;

            // Traer solo _id de chalets donde el usuario es dueño
            const ownedChalets = await Habitacion.find(
                { "others.owner": ownerId },
                { _id: 1 }
            ).lean();

            allowedResourceIds = new Set(ownedChalets.map(c => c._id.toString()));
        } else if (privilege === "Administrador") {
            allowedResourceIds = null; // sin restricción
        }

        // ---------- Filtro base para reservas ----------
        const filtro = {
            status: { $nin: ["no-show", "cancelled"] },
            arrivalDate: { $gte: startDate, $lte: endDate },
        };

        // Aplicar chaletId si se solicitó uno específico
        if (chaletId) {
            const targetId = ObjectId.isValid(chaletId) ? new ObjectId(chaletId) : chaletId;

            // Si hay restricción por privilegio, validar que pertenezca al universo permitido
            if (allowedResourceIds instanceof Set) {
                if (!allowedResourceIds.has(targetId.toString())) {
                    return res.json([]); // fuera de alcance
                }
            }
            filtro.resourceId = targetId;

        } else {
            // Sin chaletId: si hay restricción (Vendedor / Dueño), limitar al universo permitido
            if (allowedResourceIds instanceof Set) {
                if (allowedResourceIds.size === 0) {
                    return res.json([]);
                }
                filtro.resourceId = {
                    $in: Array.from(allowedResourceIds).map(id =>
                        ObjectId.isValid(id) ? new ObjectId(id) : id
                    )
                };
            }
            // Administrador: sin filtro adicional por resourceId
        }

        // ---------- Trae reservas (solo campos necesarios) ----------
        const reservas = await Documento.find(filtro, {
            _id: 1,
            client: 1,
            resourceId: 1,
            arrivalDate: 1,
            departureDate: 1,
            maxOccupation: 1,
            pax: 1,
            nNights: 1,
            total: 1,
            termsAccepted: 1,
            madeCheckIn: 1,
            surveySubmitted: 1,
            isDeposit: 1,
            status: 1,
            createdBy: 1,
            thanksSent: 1,
            colorUsuario: 1,
            clientName: 1,
        }).lean();

        // ---------- Universo de recursos para enriquecer con chalet info ----------
        const resourceIdsFromReservas = reservas
            .map(r => r.resourceId?.toString())
            .filter(Boolean);

        const scopeResourceIds = new Set(resourceIdsFromReservas);

        // ---------- Batch: Chalets (para owner y name) ----------
        const chalets = scopeResourceIds.size
            ? await Habitacion.find(
                { _id: { $in: Array.from(scopeResourceIds) } },
                { _id: 1, "others.owner": 1, "propertyDetails.name": 1 }
            ).lean()
            : [];
        const chaletsMap = new Map(
            chalets.map(c => [
                c._id.toString(),
                {
                    owner: c?.others?.owner ?? null,
                    name: c?.propertyDetails?.name ?? null,
                }
            ])
        );

        // ---------- Batch: Clientes (para reservas) ----------
        const clientIds = [...new Set(reservas.map(e => e.client).filter(Boolean))];
        const clientes = clientIds.length
            ? await Cliente.find(
                { _id: { $in: clientIds } },
                { firstName: 1, lastName: 1 }
            ).lean()
            : [];
        const clientesMap = new Map(clientes.map(c => [c._id.toString(), c]));

        // ---------- Batch: Pagos (agregación) ----------
        const reservaIds = reservas.map(e => e._id);
        let pagosMap = new Map();
        if (typeof Pago !== 'undefined') {
            const pagosAgg = await Pago.aggregate([
                { $match: { reservacionId: { $in: reservaIds } } },
                { $group: { _id: "$reservacionId", total: { $sum: "$importe" } } }
            ]);
            pagosMap = new Map(pagosAgg.map(p => [p._id.toString(), p.total || 0]));
        }

        // ---------- Normaliza RESERVAS a eventos ----------
        const eventosReservas = reservas.map(e => {
            // Nombre del cliente si no viene en el doc
            if (!e.clientName && e.client) {
                const c = clientesMap.get(e.client.toString());
                if (c) {
                    e.clientName = `${(c.firstName || '').trim()} ${(c.lastName || '').trim()}`.trim().toUpperCase();
                }
            }
            e.pagosTotales = typeof pagosMap.get(e._id.toString()) === 'number'
                ? pagosMap.get(e._id.toString())
                : 0;

            const chaletInfo = chaletsMap.get(e.resourceId?.toString());

            return {
                ...e,
                isBlocked: false,
                blockType: null,
                chaletOwner: chaletInfo?.owner || null,
                chaletName: chaletInfo?.name || null,
            };
        });

        // ---------- Respuesta ----------
        const eventos = [...eventosReservas];
        res.send(eventos);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}


function calculateNightDifference(arrivalDate, departureDate) {
    const arrivalMoment = moment.utc(arrivalDate);
    const departureMoment = moment.utc(departureDate);
    // Verifica si las fechas son válidas
    if (arrivalMoment.isValid() && departureMoment.isValid() && departureMoment.isSameOrAfter(arrivalMoment)) {
        const arrivalStartOfDay = arrivalMoment.clone().startOf('day');
        const departureStartOfDay = departureMoment.clone().startOf('day');

        // Calculate difference in days
        const nightDifference = departureStartOfDay.diff(arrivalStartOfDay, 'days');
        return nightDifference
    } else {
        return 0
    }
}

function parseDateFlexible(s) {
    if (typeof s !== 'string') return new Date(s);
    if (/\d{2}\/\d{2}\/\d{4}/.test(s)) {
        const [dd, mm, yyyy] = s.split('/');
        return new Date(Number(yyyy), Number(mm) - 1, Number(dd), 0, 0, 0, 0);
    }
    return new Date(s);
}

module.exports = {
    createReservationValidators,
    createOwnersReservationValidators,
    submitReservationValidators,
    obtenerEventos,
    obtenerEventosOptimizados,
    obtenerEventosDeCabana,
    obtenerEventoPorId,
    obtenerEventoPorIdRoute,
    createReservation,
    createOTAReservation,
    sendIntructionsToWhatsapp,
    createOwnerReservation,
    editarEvento,
    editarEventoBackend,
    eliminarEvento,
    checkAvailability,
    moveToPlayground,
    modificarEvento,
    crearNota,
    eliminarNota,
    reservasDeDuenos,
    reservasDeDuenosParaColaborador,
    cifrarMensaje,
    sendReservationMail,
    cotizadorView,
    cotizadorClientesView,
    cotizadorChaletsyPrecios,
    calculateNightDifference,
    obtenerHabitacionesDisponibles,
    getIncomingReservations
};

