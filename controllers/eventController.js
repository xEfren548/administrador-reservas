const Documento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');
const Usuario = require('../models/Usuario');
const rackLimpiezaController = require('../controllers/rackLimpiezaController');
const logController = require('../controllers/logController');
const utilidadesController = require('../controllers/utilidadesController');
const pagoController = require('../controllers/pagoController');
const BloqueoFechas = require('../models/BloqueoFechas');
const mongoose = require('mongoose');
const { format } = require('date-fns');
const moment = require('moment');
const { es } = require('date-fns/locale');


const Cliente = require('../models/Cliente');
const { check } = require("express-validator");
const BadRequestError = require("../common/error/bad-request-error");
const NotFoundError = require('../common/error/not-found-error');
const SendMessages = require('../common/tasks/send-messages');

const createReservationValidators = [
    check('clientEmail')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .custom(async (value, { req }) => {
            const client = await Cliente.findOne({ email: value });
            if (!client) {
                throw new NotFoundError('Client does not exist');
            }
            return true;
        }),
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

            if (arrivalDate <= currentDate) {
                throw new BadRequestError('Arrival date must be after the current date');
            }
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
            const chalets = await Habitacion.findOne();
            const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === value);
            if (!chalet) {
                throw new NotFoundError('Chalet does not exist');
            }
            return true;
        }),
    check("maxOccupation")
        .notEmpty().withMessage('Max occupation is required')
        .isNumeric().withMessage('Max occupation must be a number'),
    check("units")
        .notEmpty().withMessage('Number of units is required')
        .isNumeric().withMessage('Number of units must be a number'),
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

            if (arrivalDate <= currentDate) {
                throw new BadRequestError('Arrival date must be after the current date');
            }
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
                const chalets = await Habitacion.findOne();
                const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === value);
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
    const { id } = req.params;
    try {
        const eventos = await Documento.find();
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
        const documentos = await Documento.find({ 'events.resourceId': newId });

        let eventos = [];
        documentos.forEach(doc => {
            const matchingEvents = doc.events.filter(evento => evento.resourceId.equals(newId));
            eventos = eventos.concat(matchingEvents);
        });

        // Fetch colorUsuario for each evento's createdBy
        const eventosWithColorUsuario = await Promise.all(eventos.map(async evento => {
            const createdBy = evento.createdBy;
            let colorUsuario = null; // Default to null if usuario is not found
            if (createdBy) {
                const usuario = await Usuario.findById(createdBy).select('color').exec();
                if (usuario) {
                    colorUsuario = usuario.color;
                }
            }

            return {
                ...evento.toObject(),
                colorUsuario: colorUsuario
            };

        }));

        res.send(eventosWithColorUsuario);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
}

async function obtenerEventoPorId(id) {
    try {
        const eventosExistentes = await Documento.findOne(); // Buscar el documento que contiene los eventos

        if (!eventosExistentes) {
            throw new Error('No se encontraron eventos');
        }

        // Buscar el evento por su id
        const evento = eventosExistentes.events.find(evento => evento.id === id);

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
        const eventosExistentes = await Documento.findOne(); // Buscar el documento que contiene los eventos

        if (!eventosExistentes) {
            throw new Error('No se encontraron eventos');
        }

        // Buscar el evento por su id
        const evento = eventosExistentes.events.find(evento => evento.id === id);

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
        const duenoId = req.session.id;

        // Find the existing rooms
        const habitacionesExistentes = await Habitacion.findOne().lean();
        if (!habitacionesExistentes) {
            return res.status(404).send('No rooms found');
        }

        // Filter the rooms that belong to the owner
        const habitacionesDueno = habitacionesExistentes.resources.filter(habitacion => habitacion.others.owner.toString() === duenoId);
        // Extract the IDs and names of the rooms
        const cabañaIds = habitacionesDueno.map(habitacion => habitacion._id.toString());
        const nombreCabañas = habitacionesDueno.map(habitacion => ({ id: habitacion._id.toString(), name: habitacion.propertyDetails.name }));

        // Create a map of room IDs to names
        const cabañaIdToNameMap = {};
        nombreCabañas.forEach(cabaña => {
            cabañaIdToNameMap[cabaña.id] = cabaña.name;
        });

        // Find documents containing events
        const documentos = await Documento.findOne().lean();
        if (!documentos) {
            return res.status(404).send('No documents found');
        }

        // Filter events that correspond to the owner's rooms and add the room name to each event
        const eventosFiltradosOrdenadosConPagos = await Promise.all(documentos.events
            .filter(evento => cabañaIds.includes(evento.resourceId.toString()))
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




                // Retornar el evento con los pagos y las fechas formateadas
                return {
                    ...evento,
                    roomName: cabañaIdToNameMap[evento.resourceId.toString()],
                    arrivalDate: moment.utc(evento.arrivalDate).format('DD-MM-YYYY, h:mm:ss a'),
                    departureDate: moment.utc(evento.departureDate).format('DD-MM-YYYY, h:mm:ss a'),
                    pagoTotal: pagoTotal,  // Asignar los pagos al evento
                    montoPendiente: montoPendiente,
                    mostrarCancelarReserva: evento.status === 'reserva de dueño'  // Nueva propiedad

                };
            }));

        eventosFiltradosOrdenadosConPagos.sort((a, b) => moment(b.departureDate, 'DD-MM-YYYY, h:mm:ss a').valueOf() - moment(a.departureDate, 'DD-MM-YYYY, h:mm:ss a').valueOf());

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
            const habitacionesExistentes = await Habitacion.findOne().lean();
            if (!habitacionesExistentes) {
                return res.status(404).send('No rooms found');
            }

            habitacionesDueno = habitacionesExistentes.resources.filter(habitacion => 
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
            const documentos = await Documento.findOne().lean();
            if (!documentos) {
                return res.status(404).send('No documents found');
            }
    
            eventosFiltradosOrdenadosConPagos = await Promise.all(documentos.events
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
            const habitacionesExistentes = await Habitacion.findOne().lean();
            if (!habitacionesExistentes) {
                return res.status(404).send('No rooms found');
            }
    
            // Filter the rooms that belong to the owner
            habitacionesDueno = habitacionesExistentes.resources.filter(habitacion => habitacion.others.owner.toString() === duenoId);
            // Extract the IDs and names of the rooms
            const cabañaIds = habitacionesDueno.map(habitacion => habitacion._id.toString());
            const nombreCabañas = habitacionesDueno.map(habitacion => ({ id: habitacion._id.toString(), name: habitacion.propertyDetails.name }));
    
            // Create a map of room IDs to names
            const cabañaIdToNameMap = {};
            nombreCabañas.forEach(cabaña => {
                cabañaIdToNameMap[cabaña.id] = cabaña.name;
            });
    
            // Find documents containing events
            const documentos = await Documento.findOne().lean();
            if (!documentos) {
                return res.status(404).send('No documents found');
            }

            
    
            // Filter events that correspond to the owner's rooms and add the room name to each event
            eventosFiltradosOrdenadosConPagos = await Promise.all(documentos.events
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
            chalets: habitacionesDueno
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
}


async function createReservation(req, res, next) {
    const { clientEmail, chaletName, arrivalDate, departureDate, maxOccupation, nNights, units, total, discount, isDeposit, comisionVendedor } = req.body;

    try {
        const client = await Cliente.find({ email: clientEmail });
        if (!client) {
            throw new NotFoundError('Client does not exist');
        }

        const fechaAjustada = new Date(arrivalDate);
        fechaAjustada.setUTCHours(6); // Ajustar la hora a 06:00:00 UTC
        console.log(fechaAjustada);
        
        
        
        const chalets = await Habitacion.findOne();
        const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === chaletName);
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
        }

        const mongooseChaletId = new mongoose.Types.ObjectId(chalet._id);
        console.log(fechaAjustada);
        const fechasBloqueadas = await BloqueoFechas.findOne({ date: fechaAjustada, habitacionId: mongooseChaletId});
        console.log(fechasBloqueadas);
        if (fechasBloqueadas) {
            if (nNights < fechasBloqueadas.min) {
                return res.status(400).send({ message: `La estancia minima es de ${fechasBloqueadas.min} noches`});
            }
        }

        arrivalDate.setHours(arrivalDate.getHours() + chalet.others.arrivalTime.getHours());
        departureDate.setHours(departureDate.getHours() + chalet.others.departureTime.getHours());

        var reservationToAdd;
        var message;

        const createdBy = new mongoose.Types.ObjectId(req.session.id);

        if (!isDeposit) {
            reservationToAdd = {
                client: client[0]._id,
                resourceId: chalet._id,
                arrivalDate: arrivalDate,
                departureDate: departureDate,
                maxOccupation: maxOccupation,
                nNights: nNights,
                url: `http://${process.env.URL}/api/eventos/${chalet._id}`,
                units: units,
                total: total,
                discount: discount,
                createdBy: createdBy,
                comisionVendedor: comisionVendedor
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
                client: client[0]._id,
                resourceId: chalet._id,
                arrivalDate: arrivalDate,
                departureDate: departureDate,
                maxOccupation: maxOccupation,
                nNights: nNights,
                url: `http://${process.env.URL}/api/eventos/${chalet._id}`,
                units: units,
                total: total,
                discount: discount,
                isDeposit: true,
                paymentCancelation: paymentCancelation,
                createdBy: createdBy,
                comisionVendedor: comisionVendedor
            };

            message = `Reservación agregada con éxito. Realice su pago antes de ${format(paymentCancelation, "eeee d 'de' MMMM 'de' yyyy 'a las' HH:mm 'GMT'", { locale: es })} o su reserva será cancelada`;
        }

        const documento = await Documento.findOne();
        documento.events.push(reservationToAdd);
        await documento.save();

        // Guardar la reserva actualizada en la base de datos
        const documento2 = await Documento.findOne()

        const idReserva = documento.events[documento.events.length - 1]._id.toString();
        const url = `http://${process.env.URL}/api/eventos/${idReserva}`;
        const evento = documento2.events.find(habitacion => habitacion.id === idReserva);

        evento.url = url;
        await documento2.save();

        const descripcionLimpieza = 'Limpieza para la habitación ' + chaletName;
        const fechaLimpieza = new Date(departureDate)
        fechaLimpieza.setDate(fechaLimpieza.getDate() + 1)
        const statusLimpieza = 'Pendiente'

        await rackLimpiezaController.createServiceForReservation({
            id_reserva: idReserva,
            descripcion: descripcionLimpieza,
            fecha: fechaLimpieza,
            status: statusLimpieza
        })

        console.log("SendMessages.sendReminders");
        SendMessages.sendReservationConfirmation(client[0], chalet, reservationToAdd);

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



        res.status(200).json({ success: true, reservationId: documento.events[documento.events.length - 1]._id, message });
    } catch (err) {
        console.log(err);
        res.status(400).send({ message: err.message});
    }
}

async function createOwnerReservation(req, res, next) {
    const { chaletName, arrivalDate, departureDate, maxOccupation, nNights, clienteProvisional } = req.body;

    try {
        const privilege = req.session.privilege;
        const investorId = req.session.id
        console.log(req.session)
        if (privilege === "Inversionistas"){
            // Definicion de reglas de inversionistas
            const documento = await Documento.findOne();
            const reservasDeInversionista = documento.events.filter(reserva => reserva.createdBy.toString() === investorId.toString());
            reservasDeInversionista.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));

            const reservaActiva = reservasDeInversionista.find(reserva => new Date(reserva.departureDate) > new Date());
            
            if (reservaActiva) {
                throw new Error('Ya tienes una reserva activa.')
            }

            // Verificar la regla de al menos 9 días entre reservas
            const nuevaLlegada = new Date(arrivalDate);

            for (let i = 0; i < reservasDeInversionista.length; i++) {
                const reserva = reservasDeInversionista[i];
                const salidaAnterior = new Date(reserva.departureDate);
            
                if ((nuevaLlegada - salidaAnterior) / (1000 * 60 * 60 * 24) < 9) {
                    throw new Error("Entre reserva y reserva tienen que pasar al menos 9 días.");
                }
            }

            if (nNights > 4) {
                throw new Error('No puedes reservar más de 4 noches, intenta de nuevo.')
            }
        }
        const chalets = await Habitacion.findOne();
        const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === chaletName);
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
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
            url: `http://${process.env.URL}/api/eventos/${chalet._id}`,
            units: 1,
            createdBy: createdBy,
            clienteProvisional: clienteProvisional
        };





        const documento = await Documento.findOne();
        documento.events.push(reservationToAdd);
        await documento.save();

        // Guardar la reserva actualizada en la base de datos
        const documento2 = await Documento.findOne()

        const idReserva = documento.events[documento.events.length - 1]._id.toString();
        const url = `http://${process.env.URL}/api/eventos/${idReserva}`;
        const evento = documento2.events.find(habitacion => habitacion.id === idReserva);

        evento.url = url;
        await documento2.save();

        await utilidadesController.altaComisionReturn({
            monto: 0,
            concepto: `Reserva de dueño/inversionista ${chalet.propertyDetails.name}`,
            fecha: new Date(departureDate),
            idUsuario: createdBy.toString(),
            idReserva: idReserva
        })

        if (privilege === "Inversionistas"){
            console.log('Entra')
            const costoLimpieza = chalet.additionalInfo.extraCleaningCost;
            console.log('Costo Limpieza: ', costoLimpieza)
            await utilidadesController.altaComisionReturn({
                monto: -costoLimpieza ,
                concepto: `Limpieza Reserva de inversionista ${chalet.propertyDetails.name}`,
                fecha: new Date(departureDate),
                idUsuario: createdBy.toString(),
                idReserva: idReserva
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


        res.status(200).json({ success: true, reservationId: documento.events[documento.events.length - 1]._id });
    } catch (err) {
        console.log(err);
        return next(err);
    }
}

async function editarEvento(req, res) {
    try {
        const id = req.params.id;
        const { resourceId, nNights, arrivalDate, departureDate, url, total } = req.body;

        // Fetch existing rooms from the database
        const eventosExistentes = await Documento.findOne();

        if (!eventosExistentes) {
            return res.status(404).json({ mensaje: 'No se encontraron habitaciones' });
        }

        // Find the room to edit by its ID
        const evento = eventosExistentes.events.find(habitacion => habitacion.id === id);

        if (!evento) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }

        // const { resourceId, title, start, end, url, total } = req.body;


        // Update only the provided fields
        if (resourceId !== undefined && resourceId !== null) {
            evento.resourceId = resourceId;
        }

        if (nNights !== undefined && nNights !== null) {
            evento.nNights = nNights;
        }

        if (arrivalDate !== undefined && arrivalDate !== null) {
            evento.arrivalDate = arrivalDate;
        }

        if (departureDate !== undefined && departureDate !== null) {
            evento.departureDate = departureDate;
        }

        if (url !== undefined && url !== null) {
            evento.url = url;
        }

        if (total !== undefined && total !== null) {
            evento.total = total;
        }



        // Save the updated room to the database
        await eventosExistentes.save();

        const logBody = {
            fecha: Date.now(),
            idUsuario: req.session.id,
            type: 'reservation',
            idReserva: id,
            acciones: `Reservación modificada por ${req.session.firstName} ${req.session.lastName}`,
            nombreUsuario: `${req.session.firstName} ${req.session.lastName}`
        }

        await logController.createBackendLog(logBody);

        console.log('evento editado:', evento);
        res.status(200).json({ mensaje: 'evento editado correctamente', evento });
    } catch (error) {
        console.error('Error al editar evento:', error);
        res.status(500).json({ error });
    }
}

async function eliminarEvento(req, res) {
    try {
        const id = req.params.id;
        const eventosExistentes = await Documento.findOne();



        if (!eventosExistentes) {
            return res.status(404).json({ mensaje: 'No se encontraron eventos' });
        }

        // Find the index of the room to delete by its ID
        const index = eventosExistentes.events.findIndex(evento => evento.id === id);

        if (index === -1) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        }

        // Remove the room from the array
        eventosExistentes.events.splice(index, 1);

        // Save the updated room list to the database
        await eventosExistentes.save();

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
        const { event, newResource } = req.body;

        console.log('eventoRecibido: ', event);

        // Obtener el ID del evento y la nueva fecha
        const eventId = req.params.id;
        let newStartDate = event.start;
        let newEndDate = event.end;
        let newTotal = event.extendedProps.nuevoTotal

        // Buscar el evento existente por su ID
        const eventosExistentes = await Documento.findOne();


        const evento = eventosExistentes.events.find(evento => evento.id === eventId);


        if (!evento) {
            return res.status(404).json({ mensaje: 'El evento no fue encontrado' });
        } else {
            console.log('evento encontrado: ', evento);
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
        await eventosExistentes.save();

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


    // console.log(`Checking overlaps for Resource ID: ${newResourceId}`);
    // console.log(`Arrival Date: ${arrivalDateObj}`);
    // console.log(`Departure Date: ${departureDateObj}`);
    if (eventId) {
        console.log(`Ignoring event id: ${eventId}`);
    } else {
        console.log('event id: ' + eventId);
    }

    const matchConditions = {
        'events.resourceId': newResourceId,
        'events.status': { $ne: 'cancelled' }, // Excluir eventos cancelados
        $and: [
            { 'events.arrivalDate': { $lte: departureDateObj } },
            { 'events.departureDate': { $gte: arrivalDateObj } }
        ]
    };

    if (eventId) {
        matchConditions['events._id'] = { $ne: new mongoose.Types.ObjectId(eventId) };
    }

    const overlappingReservations = await Documento.aggregate([
        { $unwind: '$events' },
        { $match: matchConditions }
    ]);

    // const overlappingReservations = await Documento.aggregate([
    //     { $unwind: '$events' },
    //     {
    //         $match: {
    //             'events.resourceId': newResourceId,
    //             'events.status': { $ne: 'cancelled' } // Excluir eventos cancelados

    //         }
    //     },
    //     {
    //         $match: {
    //             $and: [
    //                 { 'events.arrivalDate': { $lte: departureDateObj } },
    //                 { 'events.departureDate': { $gte: arrivalDateObj } }
    //             ]
    //         }
    //     }
    // ]);

    // console.log('Overlapping Reservations:', overlappingReservations);
    // console.log('Overlapping Reservations Length:', overlappingReservations.length);

    return overlappingReservations.length === 0;
};

async function moveToPlayground(req, res) {
    const { idReserva, status } = req.body;
    console.log(req.body)
    console.log(idReserva)

    try {
        const eventosExistentes = await Documento.findOne();
        const evento = eventosExistentes.events.find(evento => evento._id.toString() === idReserva);

        if (!['active', 'playground', 'cancelled'].includes(status)) {
            return res.status(400).send({ error: 'Invalid status' });
        }
        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }

        if (evento.status === status) {
            throw new Error('El evento ya estaba en ese estatus');
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

                const newComisiones = [];
                for (const comisiones of comisionesReserva) {
                    if (comisiones.concepto.includes('limpieza')) {
                        const utilidadEliminada = await utilidadesController.eliminarComisionReturn(comisiones._id);
                        if (utilidadEliminada) {
                            console.log('Utilidad eliminada correctamente');
                        } else {
                            throw new Error('Error al eliminar comision.');
                        }
                    } else {
                        newComisiones.push({
                            id: comisiones._id,
                            monto: comisiones.monto / 2,
                            concepto: `${comisiones.concepto} (Reserva cancelada, 50%)`,
                            status: 'aplicado'
                        });
                    }
                }

                for (const comision of newComisiones) {
                    await utilidadesController.editarComisionReturn(comision);
                }
            } else {
                for (const comisiones of comisionesReserva) {
                    const utilidadEliminada = await utilidadesController.eliminarComisionReturn(comisiones._id);
                    if (utilidadEliminada) {
                        console.log('Utilidad eliminada correctamente');
                    } else {
                        throw new Error('Error al eliminar comision.');
                    }
                }
            }
        }

        evento.status = status;
        const confirmation = await eventosExistentes.save();
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




        res.status(200).json({ mensaje: 'Evento movido al playground correctamente', reserva: evento });

    } catch (error) {
        res.status(500).send({ error: 'Error al mover al playground: ' + error.message });
    }
}

async function crearNota(req, res) {
    const idReserva = req.params.id;
    const userPrivilege = req.session.privilege;
    const { texto, tipoNota } = req.body;

    try {
        const eventosExistentes = await Documento.findOne(); // Buscar el documento que contiene los eventos

        if (!eventosExistentes) {
            throw new Error('No se encontraron eventos');
        }

        // Buscar el evento por su id
        const evento = eventosExistentes.events.find(evento => evento._id.toString() === idReserva);

        if (!evento) {
            throw new Error('El evento no fue encontrado');
        }

        if (tipoNota === "Nota privada") {
            if (!userPrivilege.includes('Administrador') && !userPrivilege.includes('Vendedor')) {
                throw new Error('No tienes permisos para crear notas privadas');
            }
            evento.privateNotes.push({ texto });
        } else {
            evento.notes.push({ texto });

        }


        await eventosExistentes.save();
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
        const documento = await Documento.findOne();

        if (!documento) {
            throw new Error('No se encontraron eventos');
        }

        // Buscar el evento por su ID dentro del array de eventos
        const evento = documento.events.find(evento => evento._id.toString() === idReserva);


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
        await documento.save();

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

    return mensaje.replace(/[a-zA-Z]/g, function(letra) {
        var codigo = letra.charCodeAt(0);
        var inicio = letra >= 'a' ? 'a'.charCodeAt(0) : 'A'.charCodeAt(0);
        return String.fromCharCode(inicio + (codigo - inicio + desplazamiento) % 26);
    });
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
    cifrarMensaje
};

