const { format, setDay } = require('date-fns');
const { check } = require("express-validator");
const { es } = require('date-fns/locale');
const mongoose = require('mongoose');
const moment = require('moment');
const Documento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const Usuario = require('../models/Usuario');
const Costos = require('./../models/Costos');
const BloqueoFechas = require('../models/BloqueoFechas');
const BloqueoInversionistas = require('../models/BloqueoInversionistas');
const Tipologias = require('./../models/TipologiasCabana');
const Roles = require('../models/Roles');
const Cliente = require('../models/Cliente');
const PrecioBaseXDia = require('../models/PrecioBaseXDia');
const PreciosEspeciales = require('../models/PreciosEspeciales');
const rackLimpiezaController = require('../controllers/rackLimpiezaController');
const logController = require('../controllers/logController');
const utilidadesController = require('../controllers/utilidadesController');
const clienteController = require('../controllers/clientController');
const pagoController = require('../controllers/pagoController');
const sendEmail = require('../common/tasks/send-mails');


const BadRequestError = require("../common/error/bad-request-error");
const NotFoundError = require('../common/error/not-found-error');
const SendMessages = require('../common/tasks/send-messages');

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
    const { start, end } = req.query;
    try {
        console.log(start, end)
        const privilege = req.session.privilege;
        let eventos = [];

        const startDate = new Date(start);
        const endDate = new Date(end);

        // Obtener eventos según el privilegio del usuario
        if (privilege === "Vendedor") {
            const assignedChalets = req.session.assignedChalets;
            eventos = await Documento.find({ resourceId: { $in: assignedChalets }, status: { $nin: ["no-show", "cancelled"] }, arrivalDate: { $gte: startDate, $lte: endDate } }).lean();
        } else {
            eventos = await Documento.find({ status: { $nin: ["no-show", "cancelled"] }, arrivalDate: { $gte: startDate, $lte: endDate } }).lean();
        }

        // Mapa para almacenar detalles de limpieza
        let cleaningDetailsMap = {};

        // Obtener IDs únicos de los chalets
        const idAllChalets = [...new Set(eventos.map(evento => evento.resourceId.toString()))];

        // Procesar cada chalet
        for (let chaletId of idAllChalets) {
            // Obtener y ordenar detalles de limpieza
            const rackLimpieza = await rackLimpiezaController.getSpecificServicesMongo(chaletId);
            const sortedRackLimpieza = rackLimpieza.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            // Guardar el primer objeto de sortedRackLimpieza en el mapa
            if (sortedRackLimpieza.length > 0) {
                const firstCleaningDetail = sortedRackLimpieza[0];
                cleaningDetailsMap[chaletId] = {
                    idHabitacion: firstCleaningDetail.idHabitacion,
                    fecha: firstCleaningDetail.fecha,
                    status: firstCleaningDetail.status
                };
            }

            // Obtener fechas bloqueadas para el chalet
            const fechasBloqueadas = await BloqueoFechas.find({ habitacionId: chaletId, type: "bloqueo" }).lean();

            // Agregar eventos de fechas bloqueadas
            for (const fecha of fechasBloqueadas) {
                const arrivalDate = new Date(fecha.date);
                arrivalDate.setUTCHours(15, 0, 0, 0);
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
                };
                eventos.push(evento);
            }
        }

        // Procesar cada evento
        for (let evento of eventos) {
            if (evento.clientName === "Fecha Bloqueada") continue; // Saltar eventos de fechas bloqueadas

            // Calcular el total de pagos
            const pagos = await pagoController.obtenerPagos(evento._id);
            const pagoTotal = pagos.reduce((total, pago) => total + pago.importe, 0);
            evento.pagosTotales = pagoTotal;

            // Obtener nombre del cliente
            const reservationClient = evento.client;
            if (reservationClient) {
                const client = await Cliente.findById(reservationClient);
                if (client) {
                    evento.clientName = (client.firstName + ' ' + client.lastName).toUpperCase();
                }
            }

            // Agregar detalles de limpieza si el resourceId coincide
            const chaletId = evento.resourceId.toString();
            if (cleaningDetailsMap[chaletId]) {
                evento.cleaningDetails = cleaningDetailsMap[chaletId];
            }
        }

        // Enviar respuesta
        res.send(eventos);
    } catch (error) {
        console.log(error);
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
            const habitacionesExistentes = await Habitacion.find().lean();
            if (!habitacionesExistentes) {
                return res.status(404).send('No rooms found');
            }

            habitacionesDueno = habitacionesExistentes.filter(habitacion =>
            (Array.isArray(habitacion.others.investors) &&
                habitacion.others.investors.some(investorId => investorId.toString() === investor._id.toString()))
            );

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
        departureDateObj.setUTCHours(14, 30, 0, 0); // 14:30:00 UTC

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

        const fechasBloqueadasPorRestriccion = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: mongooseChaletId, type: {$nin: ['bloqueo', 'capacidad_minima']} });
        if (fechasBloqueadasPorRestriccion) {
            if (nNights < fechasBloqueadasPorRestriccion.min) {
                return res.status(400).send({ message: `La estancia minima es de ${fechasBloqueadas.min} noches` });
            }
        }

        let currentDate = new Date(fechaAjustada);
        currentDate.setUTCHours(6);
        while (currentDate <= departureDateAjustada) {
            const fechasBloqueadas = await BloqueoFechas.findOne({ date: currentDate, habitacionId: mongooseChaletId, type: 'bloqueo' });
            if (fechasBloqueadas) {
                const formattedDate = currentDate.toISOString().split('T')[0];
                return res.status(400).send({ message: `La habitacion está bloqueada para la fecha ${formattedDate}` });
            }

            currentDate.setDate(currentDate.getDate() + 1);
        
        }

        const fechasBloqueadasPorCapacidad = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: mongooseChaletId, type: 'capacidad_minima' });
        if (fechasBloqueadasPorCapacidad) {
            if (pax < fechasBloqueadasPorCapacidad.min) {
                return res.status(400).send({ message: `La capacidad minima es de ${fechasBloqueadasPorCapacidad.min} personas` });
            }
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



        res.status(200).json({ success: true, reservationId: idReserva, message });
    } catch (err) {
        console.log(err);
        res.status(400).send({ message: err.message });
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

        if (privilege === "Inversionistas") {
            // Definicion de reglas de inversionistas
            // const documento = await Documento.find( { createdBy: mInvestorId } );
            const reservasDeInversionista = await Documento.find({ createdBy: mInvestorId, status: { $nin: ["cancelled", "no-show"] } });
            // const reservasDeInversionista = documento.filter(reserva => reserva.createdBy.toString() === investorId.toString());
            reservasDeInversionista.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));

            const reservaActiva = reservasDeInversionista.find(reserva => new Date(reserva.departureDate) > new Date());

            arrivalDate.setUTCHours(chalet.others.arrivalTime.getHours());
            departureDate.setUTCHours(chalet.others.departureTime.getHours());


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
        const { resourceId, nNights, arrivalDate, departureDate, url, total } = req.body;
        console.log("Procesando solicitud de edición de evento");

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
        if (arrivalDate !== undefined) updateFields.arrivalDate = arrivalDate;
        if (departureDate !== undefined) updateFields.departureDate = departureDate;
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

        console.log('Evento editado correctamente:', evento._id);
        res.status(200).json({ mensaje: 'Evento editado correctamente', evento });
    } catch (error) {
        console.error('Error al editar evento:', error);
        res.status(500).json({ error: error.message });
    }
}

async function editarEvento(req, res) {
    try {
        const id = req.params.id;
        const { resourceId, nNights, arrivalDate, departureDate, url, total } = req.body;
        console.log("Procesando solicitud de edición de evento");

        // Create an update object with only the fields that are provided
        const updateFields = {};
        
        if (resourceId !== undefined) updateFields.resourceId = resourceId;
        if (nNights !== undefined) updateFields.nNights = nNights;
        if (arrivalDate !== undefined) updateFields.arrivalDate = arrivalDate;
        if (departureDate !== undefined) updateFields.departureDate = departureDate;
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

        console.log('Evento editado correctamente:', evento._id);
        res.status(200).json({ mensaje: 'Evento editado correctamente', evento });
    } catch (error) {
        console.error('Error al editar evento:', error);
        res.status(500).json({ error: error.message });
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



        res.status(200).json({ mensaje: 'Evento modificado correctamente', evento: evento });
    } catch (error) {
        console.error('Error al modificar el evento:', error);
        res.status(500).json({ error });
    }
}

async function checkAvailability(resourceId, arrivalDate, departureDate, eventId = null) {
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

async function cotizadorChaletsyPrecios(req, res) {
    try {
        const { categorias, fechaLlegada, fechaSalida, huespedes, soloDisponibles } = req.body;
        console.log(categorias)
        console.log(huespedes)

        let filtro = {};

        if (!categorias.includes("all")) { //Si se seleccionaron categorias
            filtro = {
                "propertyDetails.accomodationType": { $in: categorias },
                "propertyDetails.maxOccupancy": { $gte: huespedes },
                "propertyDetails.minOccupancy": { $lte: huespedes },
                isActive: true
            };
        } else { // Si se mostrara todo
            filtro = {
                "propertyDetails.maxOccupancy": { $gte: huespedes },
                "propertyDetails.minOccupancy": { $lte: huespedes },
                isActive: true
            };
        }


        const chalets = await Habitacion.find(filtro).lean();
        const chaletIds = chalets.map(chalet => chalet._id);
        console.log(chaletIds)
        if (!chalets) {
            throw new Error('No se encontraron habitaciones');
        }

        const startDate = new Date(convertirFechaES(fechaLlegada));
        const endDate = new Date(convertirFechaES(fechaSalida));

        let availableChalets = chalets;

        if (soloDisponibles) {
            availableChalets = [];
            for (const chalet of chalets) {
                const disponibilidad = await getDisponibilidad(chalet._id, startDate, endDate);
                if (disponibilidad) {
                    availableChalets.push(chalet);
                }
            }
        }


        const timeDifference = endDate.getTime() - startDate.getTime();
        const nNights = Math.ceil(timeDifference / (1000 * 3600 * 24)); // Calcula la diferencia en días

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

        }
        const comisiones = await utilidadesController.calcularComisionesInternas(infoComisiones);

        if (startDate > endDate) {
            throw new Error("La fecha de llegada debe ser anterior a la fecha de salida");
        }
        
        for (const chalet of mappedChalets) {
            let precioTotal = 0;
            let costoBaseTotal = 0;

            let currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                currentDate.setUTCHours(6);
                precio = await PreciosEspeciales.findOne({ fecha: currentDate, habitacionId: chalet.id, noPersonas: huespedes });
                if (precio) {
                    if (nNights > 1) {
                        precioTotal += precio.precio_base_2noches;
                        costoBaseTotal += precio.costo_base_2noches;
                    } else {
                        console.log("Precio modificado 1: ", precio.precio_modificado);
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
                            console.log("Precio modificado 2: ", precio.precio_modificado);
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

function convertirFechaES(fecha) {
    const [dia, mes, anio] = fecha.split("/");
    return `${anio}-${mes}-${dia}`; // Formato YYYY-MM-DD
}

async function getDisponibilidad(chaletId, fechaLlegada, fechaSalida) {
    const newResourceId = new mongoose.Types.ObjectId(chaletId);

    // Convertir fechas a cadenas en formato YYYY-MM-DD
    const fechaLlegadaStr = fechaLlegada.toISOString().split('T')[0]; // Extrae solo la fecha (YYYY-MM-DD)
    const fechaSalidaStr = fechaSalida.toISOString().split('T')[0]; // Extrae solo la fecha (YYYY-MM-DD)

    // Asignar horas fijas y convertir a formato ISO
    const arrivalDateISO = new Date(`${fechaLlegadaStr}T11:30:00`).toISOString();
    const departureDateISO = new Date(`${fechaSalidaStr}T08:30:00`).toISOString();

    const arrivalDateBloqueo = new Date(`${fechaLlegadaStr}T00:00:00`).toISOString();
    const departureDateBloqueo = new Date(`${fechaSalidaStr}T23:59:59`).toISOString();

    // console.log("ARRIVAL DATE: ", arrivalDateISO, "DEPARTURE DATE: ", departureDateISO);

    // Verificar fechas bloqueadas
    const isBlocked = await BloqueoFechas.exists({
        habitacionId: newResourceId,
        type: 'bloqueo',
        $or: [
            // Caso 1: La fecha bloqueada está dentro del rango de la reserva
            { date: { $gte: arrivalDateBloqueo, $lte: departureDateBloqueo } },
            // Caso 2: La fecha bloqueada coincide exactamente con la fecha de llegada
            { date: departureDateBloqueo },
            // Caso 3: La fecha bloqueada coincide exactamente con la fecha de salida
            { date: departureDateBloqueo },
        ],
    });

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


module.exports = {
    createReservationValidators,
    createOwnersReservationValidators,
    submitReservationValidators,
    obtenerEventos,
    obtenerEventosDeCabana,
    obtenerEventoPorId,
    obtenerEventoPorIdRoute,
    createReservation,
    sendIntructionsToWhatsapp,
    createOwnerReservation,
    editarEvento,
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
    cotizadorChaletsyPrecios
};

