const moment = require('moment');
const momentTz = require('moment-timezone');
const mongoose = require('mongoose');
const NotFoundError = require("../common/error/not-found-error");


const usersController = require('./../controllers/usersController');
const pagoController = require('./../controllers/pagoController');
const Pago = require('./../models/Pago');
const Habitacion = require('./../models/Habitacion');
const Costos = require('./../models/Costos');
const Utilidades = require('./../models/Utilidades');
const Servicio = require('./../models/Servicio');
const Documento = require('./../models/Evento');
const User = require('./../models/Usuario');
const Cliente = require('./../models/Cliente');
const Roles = require('./../models/Roles');
const { $where } = require('../models/Log');

async function obtenerComisionesPorReserva(idReserva) {
    try {
        console.log(idReserva)
        const newIdReserva = new mongoose.Types.ObjectId(idReserva)
        const comisiones = await Utilidades.find({ idReserva: newIdReserva });
        return comisiones;

    } catch (error) {
        console.error(error);
        return error;
    }
}

async function calcularComisiones(req, res) {
    try {
        const loggedUserId = req.session.id;
        const nNights = req.query.nnights;
        const habitacionId = req.query.habitacionid;
        console.log("nnights: ", nNights)

        // const chalets = await Habitacion.findOne();
        // const chalet = chalets.resources.find(chalet => chalet._id.toString() === habitacionId.toString());
        const chalet = await Habitacion.findById(habitacionId).lean();
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
        }

        const chaletType = chalet.propertyDetails.accomodationType;


        const costosGerente = await Costos.findOne({ category: "Gerente" }); // amount
        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        const costosAdministrador = await Costos.findOne({ category: "Administrador" }); //

        if (!costosGerente) { throw new Error("No se encontró costos para gerente. Favor de agregar.") }
        if (!costosVendedor) { throw new Error("No se encontró costos para vendedor. Favor de agregar.") }
        if (!costosAdministrador) { throw new Error("No se encontró costos para administrador. Favor de agregar.") }

        let counter = 0

        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        if (!user) {
            throw new NotFoundError('User does not exist');
        }

        console.log("USUARIO LOGUEADO: ", user)
        let minComission = 0
        let finalComission = 0

        while (true) {
            // console.log(user)
            console.log("Antes de user privilege admin")
            if (user.privilege === 'Administrador') {
                console.log("Despues de user privilege admin")
                counter += 1;
                // let costos = await Costos.find({ category: "Gerente" });

                if (user.administrator.toString() === user._id.toString()) {
                    if (costosGerente.commission === "Aumento por costo fijo") {
                        finalComission += costosAdministrador.amount * nNights;
                        minComission += costosAdministrador.amount * nNights;
                        console.log('comision master admin: ', costosAdministrador.amount * nNights, user._id.toString());

                    }
                    break;
                } else {
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        finalComission += costosVendedor.amount * nNights;
                        minComission += costosVendedor.amount * nNights;

                        console.log('comision admin vendedor: ', costosVendedor.amount * nNights, user._id.toString());
                        user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                    }
                }
            } else {

                counter += 1;
                console.log("Antes de user privilege")
                if (counter >= 2 && user.privilege !== "Administrador") {
                    console.log("Despues de user privilege")
                    user.privilege = "Gerente"
                }
                // let costos = await Costos.findOne({ category: user.privilege })


                if (user.privilege === "Vendedor") {
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        finalComission += costosVendedor.amount * nNights;

                        minComission += costosVendedor.amount * nNights;

                        console.log('comision vendedor: ', costosVendedor.amount * nNights, user._id.toString())
                    }
                } else if (user.privilege === "Gerente") {
                    if (costosGerente.commission === "Aumento por costo fijo") {
                        finalComission += costosGerente.amount * nNights;
                        minComission += costosGerente.amount * nNights;

                        console.log('comision gerente: ', costosGerente.amount * nNights, user._id.toString())
                    }

                }

                // if (costos.commission == "Aumento por costo fijo") {
                //     finalComission += costos.maxAmount;
                // }

                user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                if (!user) {
                    res.status(400).send({ message: "user not found" })
                }


            }
        }

        minComission += 35; // Comision Administracion NyN
        finalComission += 35; // Comision Administracion NyN

        console.log("min comission", minComission)
        console.log("max comission", finalComission)
        res.status(200).send({ minComission, finalComission });
    } catch (err) {
        console.log(err.message);
        res.status(404).send(err.message);
    }
}

async function calcularComisionesInternas(info) {
    try {
        const loggedUserId = info.userId;
        const nNights = info.nNights;
        console.log("nnights: ", nNights)

        const costosGerente = await Costos.findOne({ category: "Gerente" }); // amount
        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        const costosAdministrador = await Costos.findOne({ category: "Administrador" }); //

        if (!costosGerente) { throw new Error("No se encontró costos para gerente. Favor de agregar.") }
        if (!costosVendedor) { throw new Error("No se encontró costos para vendedor. Favor de agregar.") }
        if (!costosAdministrador) { throw new Error("No se encontró costos para administrador. Favor de agregar.") }

        let counter = 0

        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        if (!user) {
            if (info.noVendedor) {
                const normalizedPhone = info.noVendedor.toString().replace(/^\+52/, '');

                user = await User.findOne({
                    $or: [
                        { phone: info.noVendedor },
                        { phone: normalizedPhone },
                        { phone: `+52${normalizedPhone}` }
                    ]
                });

                if (!user) {
                    throw new NotFoundError('User does not exist');
                }
            } else {
                throw new NotFoundError('User does not exist');
            }
        }

        console.log("USUARIO LOGUEADO: ", user)
        let minComission = 0
        let finalComission = 0

        while (true) {
            // console.log(user)
            console.log("Antes de user privilege admin")
            if (user.privilege === 'Administrador') {
                console.log("Despues de user privilege admin")
                counter += 1;
                // let costos = await Costos.find({ category: "Gerente" });

                if (user.administrator.toString() === user._id.toString()) {
                    if (costosGerente.commission === "Aumento por costo fijo") {
                        finalComission += costosAdministrador.amount * nNights;
                        minComission += costosAdministrador.amount * nNights;
                        console.log('comision master admin: ', costosAdministrador.amount * nNights, user._id.toString());

                    }
                    break;
                } else {
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        finalComission += costosVendedor.amount * nNights;
                        minComission += costosVendedor.amount * nNights;

                        console.log('comision admin vendedor: ', costosVendedor.amount * nNights, user._id.toString());
                        user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                    }
                }
            } else {

                counter += 1;
                console.log("Antes de user privilege")
                if (counter >= 2 && user.privilege !== "Administrador") {
                    console.log("Despues de user privilege")
                    user.privilege = "Gerente"
                }
                // let costos = await Costos.findOne({ category: user.privilege })


                if (user.privilege === "Vendedor") {
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        finalComission += costosVendedor.amount * nNights;

                        minComission += costosVendedor.amount * nNights;

                        console.log('comision vendedor: ', costosVendedor.amount * nNights, user._id.toString())
                    }
                } else if (user.privilege === "Gerente") {
                    if (costosGerente.commission === "Aumento por costo fijo") {
                        finalComission += costosGerente.amount * nNights;
                        minComission += costosGerente.amount * nNights;

                        console.log('comision gerente: ', costosGerente.amount * nNights, user._id.toString())
                    }

                }

                // if (costos.commission == "Aumento por costo fijo") {
                //     finalComission += costos.maxAmount;
                // }

                user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                if (!user) {
                    res.status(400).send({ message: "user not found" })
                }


            }
        }

        minComission += 35; // Comision Administracion NyN
        finalComission += 35; // Comision Administracion NyN

        console.log("min comission", minComission)
        console.log("max comission", finalComission)
        return finalComission;
    } catch (err) {
        console.log(err.message);
        return null;
    }
}

async function calcularComisionesOTA() {
    try {

        const costosGerente = await Costos.findOne({ category: "Gerente" }); // amount
        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        const costosAdministrador = await Costos.findOne({ category: "Administrador" }); //

        if (!costosGerente) { throw new Error("No se encontró costos para gerente. Favor de agregar.") }
        if (!costosVendedor) { throw new Error("No se encontró costos para vendedor. Favor de agregar.") }
        if (!costosAdministrador) { throw new Error("No se encontró costos para administrador. Favor de agregar.") }

        let finalComission = 0

        finalComission += costosAdministrador.amount; // Comision de admin ligado
        finalComission += 35; // Comision por uso de sistema NyN

        console.log("max comission", finalComission)
        return finalComission;
    } catch (err) {
        console.log(err.message);
        return null;
    }
}

async function generarComisionReserva(req, res) {
    try {
        const loggedUserId = req.session.id;
        const { habitacionId, costoBase, totalSinComisiones, idReserva, chaletName, arrivalDate, departureDate, nNights } = req.body;
        console.log("Desde generar comision reserva")
        console.log("Costo base: " + costoBase)

        // Eliminar comisiones previas si es que existian
        const comisionesReserva = await obtenerComisionesPorReserva(idReserva);

        if (comisionesReserva) {
            for (const comisiones of comisionesReserva) {
                if (!comisiones.concepto.includes('servicio') && !comisiones.concepto.includes('Servicio')) {
                    const utilidadEliminada = await eliminarComisionReturn(comisiones._id);
                    if (utilidadEliminada) {
                        console.log('Utilidad eliminada correctamente');
                    } else {
                        throw new Error('Error al eliminar comision.');
                    }
                }
            }
        }




        // const chalets = await Habitacion.findOne();
        // const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === chaletName);

        const chalet = await Habitacion.findOne({ "propertyDetails.name": chaletName }).lean();
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
        }

        let utilidadChalet = totalSinComisiones - costoBase;

        const chaletType = chalet.propertyDetails.accomodationType;



        const costosGerente = await Costos.findOne({ category: "Gerente" }); // amount
        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        const costosAdministrador = await Costos.findOne({ category: "Administrador" }); //

        if (!costosGerente) { throw new NotFoundError('Costos de gerente no existente'); }
        if (!costosVendedor) { throw new NotFoundError('Costos de vendedor no existente'); }
        if (!costosAdministrador) { throw new NotFoundError('Costos de administrador no existente'); }

        let comisionVendedor = costosVendedor.amount;

        const fechaActual = new Date();

        let counter = 0

        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        let conceptoAdmin = ''

        while (true) {
            // console.log(user)

            if (user.privilege === 'Administrador') {
                counter += 1;

                if (user.administrator.toString() === user._id.toString()) {
                    if (costosGerente.commission === "Aumento por costo fijo") {
                        if (counter > 1) {
                            conceptoAdmin = `Comisión administrador ligado de vendedor por reservación ${nNights} noches`

                        } else {
                            conceptoAdmin = `Reservación A. vendedor: ${nNights} noches`
                        }
                        // finalComission += costosGerente.amount;
                        // minComission += costosGerente.amount;
                        await altaComisionReturn({
                            monto: costosAdministrador.amount * nNights,
                            concepto: conceptoAdmin,
                            fecha: new Date(arrivalDate),
                            idUsuario: user._id.toString(),
                            idReserva: idReserva
                        })
                    }


                    break;
                } else {
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        console.log("Comision vendedor: ", comisionVendedor)
                        await altaComisionReturn({
                            monto: comisionVendedor * nNights,
                            concepto: `Comisión por Reservación vendedor ${nNights} noches`,
                            fecha: new Date(arrivalDate),
                            idUsuario: user._id.toString(),
                            idReserva: idReserva
                        })
                        user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                    }
                }

                // let costos = await Costos.find({ category: "Gerente" });
                // if (costosGerente.commission === "Aumento por costo fijo") {
                //     if (counter > 1) {
                //         conceptoAdmin = `Comisión administrador ligado por reservación ${chaletName}`

                //     } else {
                //         conceptoAdmin = `Reservación ${chaletName}`
                //     }
                //     // finalComission += costosGerente.amount;
                //     // minComission += costosGerente.amount;
                //     await altaComisionReturn({
                //         monto: costosAdministrador.amount,
                //         concepto: conceptoAdmin,
                //         fecha: fechaActual,
                //         idUsuario: user._id.toString()
                //     })
                // }

                // break;
            } else {

                counter += 1;
                if (counter >= 2 && user.privilege !== "Administrador") {
                    user.privilege = "Gerente"
                }
                // let costos = await Costos.findOne({ category: user.privilege })


                if (user.privilege === "Vendedor") {
                    if (costosVendedor.commission === "Aumento por costo fijo") {

                        await altaComisionReturn({
                            monto: comisionVendedor * nNights,
                            concepto: `Reservación ${nNights} noches`,
                            fecha: new Date(arrivalDate),
                            idUsuario: user._id.toString(),
                            idReserva: idReserva
                        })


                        // finalComission += costosVendedor.maxAmount;
                        // minComission += costosVendedor.minAmount;

                        // minComission += costosDuenio.amount;
                        // finalComission += costosDuenio.amount;
                    }
                } else if (user.privilege === "Gerente") {
                    await altaComisionReturn({
                        monto: costosGerente.amount * nNights,
                        concepto: `Reservación ${nNights} noches`,
                        fecha: new Date(arrivalDate),
                        idUsuario: user._id.toString(),
                        idReserva: idReserva
                    })

                }

                // if (costos.commission == "Aumento por costo fijo") {
                //     finalComission += costos.maxAmount;
                // }

                user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                if (!user) {
                    res.status(400).send({ message: "user not found" })
                }


            }
        }

        const chaletAdminId = chalet.others.admin.toString();
        const chaletJanitor = chalet.others.janitor.toString();
        const chaletOwner = chalet.others.owner.toString();
        const chaletInvestors = chalet.others.investors

        console.log('comision inversionistas')
        console.log(chaletInvestors)
        // const idBosqueImperial = '66a7c2f2915b94d6630b67f2'
        const idAdministracionNyN = '671be608256c4d53c3f5e12f'

        const chaletAdmin = await User.findById(chaletAdminId)
        if (!chaletAdmin) {
            throw new Error("No chalet admin found.")
        }

        // Utilidad
        if (chaletType === "Bosque Imperial") {
            await altaComisionReturn({
                monto: utilidadChalet,
                concepto: `Comisión administrador ligado de Cabaña ${nNights} noches`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletAdmin._id.toString(),
                idReserva: idReserva
            })

            let comisionNegativaIva = Math.round((utilidadChalet * 0.16 + Number.EPSILON) * 100) / 100;

            await altaComisionReturn({
                monto: -comisionNegativaIva,
                concepto: `Retención IVA ${chaletName} ${nNights} noches`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletAdmin._id.toString(),
                idReserva: idReserva
            })
        } else {
            await altaComisionReturn({
                monto: utilidadChalet,
                concepto: `Comisión administrador ligado de Cabaña ${chaletName} ${nNights} noches`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletAdmin._id.toString(),
                idReserva: idReserva
            })
        }

        // Comisión de limpieza
        await altaComisionReturn({
            monto: chalet.additionalInfo.extraCleaningCost,
            concepto: `Comisión limpieza`,
            fecha: new Date(arrivalDate),
            idUsuario: chaletJanitor,
            idReserva: idReserva
        })

        // Comisión de $35 para administracion
        await altaComisionReturn({
            monto: 35,
            concepto: `Costo por uso de sistema NyN`,
            fecha: new Date(arrivalDate),
            idUsuario: idAdministracionNyN,
            idReserva: idReserva
        })

        // Comisión de dueño de cabañas (ANTERIOR)
        // await altaComisionReturn({
        //     monto: costoBase - chalet.additionalInfo.extraCleaningCost,
        //     concepto: `Comisión Dueño de cabaña: ${chaletName}`,
        //     fecha: new Date(departureDate),
        //     idUsuario: chaletOwner,
        //     idReserva: idReserva
        // })

        // Comisión de dueño de cabañas (NUEVA)
        let nuevoCostoBase = costoBase - chalet.additionalInfo.extraCleaningCost
        console.log('nuevo costo base: ', nuevoCostoBase)
        let cuantosInversionistas = chaletInvestors?.length
        console.log('cuantos inversionistas: ', cuantosInversionistas)
        // let comisionInversionistas = Math.round((nuevoCostoBase / cuantosInversionistas + Number.EPSILON) * 100) / 100;
        let comisionInversionistas = Math.round((nuevoCostoBase / 10 + Number.EPSILON) * 100) / 100;
        console.log('comision inversionistas: ', comisionInversionistas)


        if (cuantosInversionistas > 0) {

            for (let investor of chaletInvestors) {
                let userInvestor = await User.findById(investor.investor);
                if (userInvestor) {
                    const noTickets = investor.noTickets
                    const comision = comisionInversionistas * noTickets

                    if (userInvestor.investorType === 'Asimilado') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comisionInversionistas * 0.16;
                        let comisionNegativaIva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaIva,
                            concepto: `IVA inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de ISR (5%)
                        // let comisionNegativaIsr = comisionInversionistas * 0.05;
                        let comisionNegativaIsr = Math.round(((comision - comisionNegativaIva) * 0.16 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaIsr,
                            concepto: `ISR inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // Retencion "Servicios indirectos Bosque imperial"
                        let comisionNegativaServiciosIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaServiciosIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                    } else if (userInvestor.investorType === 'RESICO Fisico') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comision * 0.16;
                        let comisionNegativaIva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;

                        // Comision Retencion IVA
                        let comisionNegativaRetIva = Math.round((comision * 0.1066 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaRetIva,
                            concepto: `Retención IVA inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // Comision Retencion ISR
                        let comisionNegativaRetIsr = Math.round((comision * 0.0125 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionNegativaRetIsr,
                            concepto: `ISR inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // Comision Retencion Servicios Indirectos
                        let comisionServIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                    } else if (userInvestor.investorType === 'PF con AE y PM') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        // IVA
                        let comisionNegativaIva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;

                        // Comision Retencion Servicios Indirectos
                        let comisionServIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                    } else if (userInvestor.investorType === 'Efectivo') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comision * 0.16;
                        let comisionNegativaIva = Math.round((comision * 0.08 + Number.EPSILON) * 100) / 100;

                        let comisionServIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })

                        await altaComisionReturn({
                            monto: -comisionNegativaIva,
                            concepto: `IVA inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: idReserva
                        })
                    }

                }

            }

        } else {
            // Comisión de dueño de cabañas (ANTERIOR)
            await altaComisionReturn({
                monto: costoBase - chalet.additionalInfo.extraCleaningCost,
                concepto: `Comisión Dueño de cabaña`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletOwner,
                idReserva: idReserva
            })
        }

        res.status(200).json({ success: true, message: "Comision agregada con éxito" })
    } catch (err) {
        console.log(err)
        res.status(404).send(err.message);
    }
}
async function generarComisionReservaBackend(info) {
    try {
        const loggedUserId = info.userId;
        const { costoBase, totalSinComisiones, idReserva, chaletName, arrivalDate, departureDate, nNights } = info;
        console.log("Desde generar comision reserva")
        console.log("Costo base: " + costoBase)

        const reservacionId = idReserva

        // Eliminar comisiones previas si es que existian
        const comisionesReserva = await obtenerComisionesPorReserva(reservacionId);

        if (comisionesReserva) {
            for (const comisiones of comisionesReserva) {
                if (!comisiones.concepto.includes('servicio') && !comisiones.concepto.includes('Servicio')) {
                    const utilidadEliminada = await eliminarComisionReturn(comisiones._id);
                    if (utilidadEliminada) {
                        console.log('Utilidad eliminada correctamente');
                    } else {
                        throw new Error('Error al eliminar comision.');
                    }
                }
            }
        }




        // const chalets = await Habitacion.findOne();
        // const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === chaletName);

        const chalet = await Habitacion.findOne({ "propertyDetails.name": chaletName }).lean();
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
        }

        let utilidadChalet = totalSinComisiones - costoBase;

        const chaletType = chalet.propertyDetails.accomodationType;



        const costosGerente = await Costos.findOne({ category: "Gerente" }); // amount
        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        const costosAdministrador = await Costos.findOne({ category: "Administrador" }); //

        if (!costosGerente) { throw new NotFoundError('Costos de gerente no existente'); }
        if (!costosVendedor) { throw new NotFoundError('Costos de vendedor no existente'); }
        if (!costosAdministrador) { throw new NotFoundError('Costos de administrador no existente'); }

        let comisionVendedor = costosVendedor.amount;

        const fechaActual = new Date();

        let counter = 0

        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        let conceptoAdmin = ''

        while (true) {
            // console.log(user)

            if (user.privilege === 'Administrador') {
                counter += 1;

                if (user.administrator.toString() === user._id.toString()) {
                    if (costosGerente.commission === "Aumento por costo fijo") {
                        if (counter > 1) {
                            conceptoAdmin = `Comisión administrador ligado de vendedor por reservación ${nNights} noches`

                        } else {
                            conceptoAdmin = `Reservación A. vendedor: ${nNights} noches`
                        }
                        // finalComission += costosGerente.amount;
                        // minComission += costosGerente.amount;
                        await altaComisionReturn({
                            monto: costosAdministrador.amount * nNights,
                            concepto: conceptoAdmin,
                            fecha: new Date(arrivalDate),
                            idUsuario: user._id.toString(),
                            idReserva: reservacionId
                        })
                    }


                    break;
                } else {
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        console.log("Comision vendedor: ", comisionVendedor)
                        await altaComisionReturn({
                            monto: comisionVendedor * nNights,
                            concepto: `Comisión por Reservación vendedor ${nNights} noches`,
                            fecha: new Date(arrivalDate),
                            idUsuario: user._id.toString(),
                            idReserva: reservacionId
                        })
                        user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                    }
                }

                // let costos = await Costos.find({ category: "Gerente" });
                // if (costosGerente.commission === "Aumento por costo fijo") {
                //     if (counter > 1) {
                //         conceptoAdmin = `Comisión administrador ligado por reservación ${chaletName}`

                //     } else {
                //         conceptoAdmin = `Reservación ${chaletName}`
                //     }
                //     // finalComission += costosGerente.amount;
                //     // minComission += costosGerente.amount;
                //     await altaComisionReturn({
                //         monto: costosAdministrador.amount,
                //         concepto: conceptoAdmin,
                //         fecha: fechaActual,
                //         idUsuario: user._id.toString()
                //     })
                // }

                // break;
            } else {

                counter += 1;
                if (counter >= 2 && user.privilege !== "Administrador") {
                    user.privilege = "Gerente"
                }
                // let costos = await Costos.findOne({ category: user.privilege })


                if (user.privilege === "Vendedor") {
                    if (costosVendedor.commission === "Aumento por costo fijo") {

                        await altaComisionReturn({
                            monto: comisionVendedor * nNights,
                            concepto: `Reservación ${nNights} noches`,
                            fecha: new Date(arrivalDate),
                            idUsuario: user._id.toString(),
                            idReserva: reservacionId
                        })


                        // finalComission += costosVendedor.maxAmount;
                        // minComission += costosVendedor.minAmount;

                        // minComission += costosDuenio.amount;
                        // finalComission += costosDuenio.amount;
                    }
                } else if (user.privilege === "Gerente") {
                    await altaComisionReturn({
                        monto: costosGerente.amount * nNights,
                        concepto: `Reservación ${nNights} noches`,
                        fecha: new Date(arrivalDate),
                        idUsuario: user._id.toString(),
                        idReserva: reservacionId
                    })

                }

                // if (costos.commission == "Aumento por costo fijo") {
                //     finalComission += costos.maxAmount;
                // }

                user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                if (!user) {
                    res.status(400).send({ message: "user not found" })
                }


            }
        }

        const chaletAdminId = chalet.others.admin.toString();
        const chaletJanitor = chalet.others.janitor.toString();
        const chaletOwner = chalet.others.owner.toString();
        const chaletInvestors = chalet.others.investors

        console.log('comision inversionistas')
        console.log(chaletInvestors)
        // const idBosqueImperial = '66a7c2f2915b94d6630b67f2'
        const idAdministracionNyN = '671be608256c4d53c3f5e12f'

        const chaletAdmin = await User.findById(chaletAdminId)
        if (!chaletAdmin) {
            throw new Error("No chalet admin found.")
        }

        // Utilidad
        if (chaletType === "Bosque Imperial") {
            await altaComisionReturn({
                monto: utilidadChalet,
                concepto: `Comisión administrador ligado de Cabaña ${nNights} noches`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletAdmin._id.toString(),
                idReserva: reservacionId
            })

            let comisionNegativaIva = Math.round((utilidadChalet * 0.16 + Number.EPSILON) * 100) / 100;

            await altaComisionReturn({
                monto: -comisionNegativaIva,
                concepto: `Retención IVA ${chaletName} ${nNights} noches`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletAdmin._id.toString(),
                idReserva: reservacionId
            })
        } else {
            await altaComisionReturn({
                monto: utilidadChalet,
                concepto: `Comisión administrador ligado de Cabaña ${chaletName} ${nNights} noches`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletAdmin._id.toString(),
                idReserva: reservacionId
            })
        }

        // Comisión de limpieza
        await altaComisionReturn({
            monto: chalet.additionalInfo.extraCleaningCost,
            concepto: `Comisión limpieza`,
            fecha: new Date(arrivalDate),
            idUsuario: chaletJanitor,
            idReserva: reservacionId
        })

        // Comisión de $35 para administracion
        await altaComisionReturn({
            monto: 35,
            concepto: `Costo por uso de sistema NyN`,
            fecha: new Date(arrivalDate),
            idUsuario: idAdministracionNyN,
            idReserva: reservacionId
        })

        // Comisión de dueño de cabañas (ANTERIOR)
        // await altaComisionReturn({
        //     monto: costoBase - chalet.additionalInfo.extraCleaningCost,
        //     concepto: `Comisión Dueño de cabaña: ${chaletName}`,
        //     fecha: new Date(departureDate),
        //     idUsuario: chaletOwner,
        //     idReserva: idReserva
        // })

        // Comisión de dueño de cabañas (NUEVA)
        let nuevoCostoBase = costoBase - chalet.additionalInfo.extraCleaningCost
        console.log('nuevo costo base: ', nuevoCostoBase)
        let cuantosInversionistas = chaletInvestors.length
        console.log('cuantos inversionistas: ', cuantosInversionistas)
        // let comisionInversionistas = Math.round((nuevoCostoBase / cuantosInversionistas + Number.EPSILON) * 100) / 100;
        let comisionInversionistas = Math.round((nuevoCostoBase / 10 + Number.EPSILON) * 100) / 100;
        console.log('comision inversionistas: ', comisionInversionistas)


        if (cuantosInversionistas > 0) {

            for (let investor of chaletInvestors) {
                let userInvestor = await User.findById(investor.investor);
                if (userInvestor) {
                    const noTickets = investor.noTickets
                    const comision = comisionInversionistas * noTickets

                    if (userInvestor.investorType === 'Asimilado') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })
                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comisionInversionistas * 0.16;
                        let comisionNegativaIva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaIva,
                            concepto: `IVA inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })
                        // Comision negativa de ISR (5%)
                        // let comisionNegativaIsr = comisionInversionistas * 0.05;
                        let comisionNegativaIsr = Math.round(((comision - comisionNegativaIva) * 0.16 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaIsr,
                            concepto: `ISR inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })

                        // Retencion "Servicios indirectos Bosque imperial"
                        let comisionNegativaServiciosIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaServiciosIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })

                    } else if (userInvestor.investorType === 'RESICO Fisico') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })

                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comision * 0.16;
                        let comisionNegativaIva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;

                        // Comision Retencion IVA
                        let comisionNegativaRetIva = Math.round((comision * 0.1066 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaRetIva,
                            concepto: `Retención IVA inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })

                        // Comision Retencion ISR
                        let comisionNegativaRetIsr = Math.round((comision * 0.0125 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionNegativaRetIsr,
                            concepto: `ISR inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })

                        // Comision Retencion Servicios Indirectos
                        let comisionServIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })

                    } else if (userInvestor.investorType === 'PF con AE y PM') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })

                        // IVA
                        let comisionNegativaIva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;

                        // Comision Retencion Servicios Indirectos
                        let comisionServIndirectos = Math.round(((comision - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })
                    } else if (userInvestor.investorType === 'Efectivo') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comision,
                            concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })
                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comision * 0.16;
                        let comisionNegativaIva = Math.round((comision * 0.08 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaIva,
                            concepto: `IVA inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                            fecha: new Date(arrivalDate),
                            idUsuario: userInvestor._id,
                            idReserva: reservacionId
                        })
                    }

                }

            }

        } else {
            // Comisión de dueño de cabañas (ANTERIOR)
            await altaComisionReturn({
                monto: costoBase - chalet.additionalInfo.extraCleaningCost,
                concepto: `Comisión Dueño de cabaña`,
                fecha: new Date(arrivalDate),
                idUsuario: chaletOwner,
                idReserva: reservacionId
            })
        }

    } catch (err) {
        console.log(err)
        return err;
    }
}

async function generarComisionOTA(info) {
    try {
        const { idReserva, arrivalDate, nNights, chaletName, costoBase, totalSinComisiones, totalPagado } = info;

        // Obtener datos del chalet
        const chalet = await Habitacion.findOne({ "propertyDetails.name": chaletName }).lean();
        if (!chalet) throw new Error('Chalet no encontrado');

        // Datos extraídos
        const chaletType = chalet.propertyDetails.accomodationType;
        const adminId = chalet.others.admin.toString();
        const ownerId = chalet.others.owner.toString();
        const investors = chalet.others.investors;
        const extraCleaningCost = chalet.additionalInfo.extraCleaningCost;
        const chaletJanitor = chalet.others.janitor.toString();

        // Cargar costos desde BD
        const costosAdministrador = await Costos.findOne({ category: "Administrador" });
        if (!costosAdministrador) throw new Error('Costos Administrador no encontrados');
        const COSTO_ADMIN = costosAdministrador.amount;  // comisión admin por noche
        const USO_SERVICIO = 35;                        // costo por uso de sistema NyN por noche
        const idAdministracionNyN = '671be608256c4d53c3f5e12f';

        // Eliminar comisiones previas si es que existian
        const comisionesReserva = await obtenerComisionesPorReserva(idReserva);

        if (comisionesReserva) {
            for (const comisiones of comisionesReserva) {
                if (!comisiones.concepto.includes('servicio') && !comisiones.concepto.includes('Servicio')) {
                    const utilidadEliminada = await eliminarComisionReturn(comisiones._id);
                    if (utilidadEliminada) {
                        console.log('Utilidad eliminada correctamente');
                    } else {
                        throw new Error('Error al eliminar comision.');
                    }
                }
            }
        }

        // Inicializar balance en total pagado
        let balance = totalPagado;

        // 1. Comisión por uso de sistema NyN (por noches)
        const montoServicioTotal = USO_SERVICIO * nNights;
        balance -= montoServicioTotal;
        await altaComisionReturn({
            monto: montoServicioTotal,
            concepto: `Costo por uso de sistema NyN (${nNights} noches)`,
            fecha: new Date(arrivalDate),
            idUsuario: idAdministracionNyN,
            idReserva
        });

        // 2. Comisión de limpieza (una sola vez)
        balance -= extraCleaningCost;
        await altaComisionReturn({
            monto: extraCleaningCost,
            concepto: `Comisión limpieza`,
            fecha: new Date(arrivalDate),
            idUsuario: chaletJanitor,
            idReserva
        });

        // 3. Comisión al Administrador (por noches)
        const montoAdmin = COSTO_ADMIN * nNights;
        balance -= montoAdmin;
        await altaComisionReturn({
            monto: montoAdmin,
            concepto: `Comisión OTA administrador (${nNights} noches)`,
            fecha: new Date(arrivalDate),
            idUsuario: adminId,
            idReserva
        });

        // 4. Retención IVA si es Bosque Imperial (sobre admin)
        if (chaletType === 'Bosque Imperial') {
            const ivaAdminTotal = Math.round((COSTO_ADMIN * 0.16 + Number.EPSILON) * 100) / 100 * nNights;
            await altaComisionReturn({
                monto: -ivaAdminTotal,
                concepto: `Retención IVA OTA (${nNights} noches)`,
                fecha: new Date(arrivalDate),
                idUsuario: adminId,
                idReserva
            });
        }

        // 5. Distribución del costo base restante (sin multiplicar por noches)
        const nuevoCostoBase = costoBase - extraCleaningCost;
        balance -= nuevoCostoBase;

        if (investors.length > 0) {
            const comisionInversionistas = Math.round((nuevoCostoBase / 10 + Number.EPSILON) * 100) / 100;
            console.log('comisión inversionistas: ', comisionInversionistas);

            for (const investor of investors) {
                const userInvestor = await User.findById(investor.investor);
                if (!userInvestor) continue;

                const noTickets = investor.noTickets;
                const comision = Math.round((comisionInversionistas * noTickets + Number.EPSILON) * 100) / 100;

                const datosBase = {
                    concepto: `Comisión de inversionista por Reserva de cabaña (${noTickets} ticket(s)) `,
                    fecha: new Date(arrivalDate),
                    idUsuario: userInvestor._id,
                    idReserva
                };

                // Comisión base
                await altaComisionReturn({ ...datosBase, monto: comision });

                if (userInvestor.investorType === 'Asimilado') {
                    const iva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;
                    const isr = Math.round(((comision - iva) * 0.16 + Number.EPSILON) * 100) / 100;
                    const servicios = Math.round(((comision - iva) * 0.04 + Number.EPSILON) * 100) / 100;

                    await altaComisionReturn({ ...datosBase, monto: -iva, concepto: `IVA inversionista por Reserva de cabaña` });
                    await altaComisionReturn({ ...datosBase, monto: -isr, concepto: `ISR inversionista por Reserva de cabaña` });
                    await altaComisionReturn({ ...datosBase, monto: -servicios, concepto: `Servicios Indirectos Bosque Imperial` });

                } else if (userInvestor.investorType === 'RESICO Fisico') {
                    const iva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;
                    const retIva = Math.round((comision * 0.1066 + Number.EPSILON) * 100) / 100;
                    const retIsr = Math.round((comision * 0.0125 + Number.EPSILON) * 100) / 100;
                    const servicios = Math.round(((comision - iva) * 0.04 + Number.EPSILON) * 100) / 100;

                    await altaComisionReturn({ ...datosBase, monto: -retIva, concepto: `Retención IVA inversionista por Reserva de cabaña` });
                    await altaComisionReturn({ ...datosBase, monto: -retIsr, concepto: `ISR inversionista por Reserva de cabaña` });
                    await altaComisionReturn({ ...datosBase, monto: -servicios, concepto: `Servicios Indirectos Bosque Imperial` });

                } else if (userInvestor.investorType === 'PF con AE y PM') {
                    const iva = Math.round((comision * 0.16 + Number.EPSILON) * 100) / 100;
                    const servicios = Math.round(((comision - iva) * 0.04 + Number.EPSILON) * 100) / 100;

                    await altaComisionReturn({ ...datosBase, monto: -servicios, concepto: `Servicios Indirectos Bosque Imperial` });

                } else if (userInvestor.investorType === 'Efectivo') {
                    const iva = Math.round((comision * 0.08 + Number.EPSILON) * 100) / 100;

                    await altaComisionReturn({ ...datosBase, monto: -iva, concepto: `IVA inversionista por Reserva de cabaña (${noTickets} ticket(s))` });
                }
            }

        } else {
            // Sin inversionistas, se asigna al dueño
            await altaComisionReturn({
                monto: nuevoCostoBase,
                concepto: `Comisión Dueño de cabaña`,
                fecha: new Date(arrivalDate),
                idUsuario: ownerId,
                idReserva
            });
        }


        // 6. Registrar utilidad una sola vez (ajustando balance)
        const utilidadChalet = (totalSinComisiones - costoBase);
        balance -= utilidadChalet;
        if (utilidadChalet !== 0) {
            await altaComisionReturn({
                monto: utilidadChalet,
                concepto: `Utilidad OTA total`,
                fecha: new Date(arrivalDate),
                idUsuario: adminId,
                idReserva
            });
        }


        if (balance !== 0) {
            await altaComisionReturn({
                monto: balance,
                concepto: `Ajuste balance OTA`,
                fecha: new Date(arrivalDate),
                idUsuario: adminId,
                idReserva
            });
        }

    } catch (err) {
        console.error('Error en generarComisionOTA:', err);
        throw err;
    }
}


async function mostrarUtilidadesPorUsuario(req, res) {
    try {
        const loggedUserId = req.session.id;
        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        const habitacionesExistentes = await Habitacion.find().lean();
        if (!habitacionesExistentes) {
            return res.status(404).send('No rooms found');
        }

        const reservas = await Documento.find().lean();
        if (!reservas) {
            return res.status(404).send('No documents found');
        }

        let utilidades = {};


        utilidades = await Utilidades.find({ idUsuario: loggedUserId }).lean();

        const nombreCabañas = habitacionesExistentes.map(habitacion => ({ id: habitacion._id.toString(), name: habitacion.propertyDetails.name, chaletAdmin: habitacion.others.admin.toString() }));
        const reservasMap = reservas.map(reserva => ({ id: reserva._id.toString(), resourceId: reserva.resourceId.toString(), nNights: reserva.nNights, departureDate: reserva.departureDate, status: reserva.status }));

        const chaletAdminIds = [...new Set(nombreCabañas.map(cabana => cabana.chaletAdmin))];
        const chaletAdminMap = {};
        for (let adminId of chaletAdminIds) {
            const userChaletAdmin = await usersController.obtenerUsuarioPorIdMongo(adminId);
            chaletAdminMap[adminId] = userChaletAdmin
                ? `${userChaletAdmin.firstName} ${userChaletAdmin.lastName}`
                : "-";
        }


        let totalEarnings = 0

        const currentMonth = moment().month(); // Mes actual (0-11)
        const currentYear = moment().year(); // Año actual
        const utilidadesPorMes = Array(12).fill(0); // Inicializa un array con 12 elementos, todos con valor 0

        if (Object.keys(utilidades).length > 0) {
            console.log('pasa validacion')
            utilidades.forEach(utilidad => {
                utilidad.nombreUsuario = `${user.firstName} ${user.lastName}`
                utilidad.fecha = moment.utc(utilidad.fecha).format('DD/MM/YYYY');
                const utilidadFecha = moment.utc(utilidad.fecha, 'DD/MM/YYYY');

                if (utilidadFecha.month() === currentMonth && utilidadFecha.year() === currentYear) {
                    // Asignar nombre del usuario y formatear fecha
                    utilidad.nombreUsuario = `${user.firstName} ${user.lastName}`;
                    utilidad.fecha = utilidadFecha.format('DD/MM/YYYY');

                    // Sumar al total de comisiones
                    totalEarnings += utilidad.monto;


                }

                const monthIndex = utilidadFecha.month(); // Obtiene el índice del mes (0-11)
                utilidadesPorMes[monthIndex] += utilidad.monto;

                if (utilidad.idReserva) {
                    const reserva = reservasMap.find(reservation => reservation.id.toString() === utilidad.idReserva.toString())
                    if (reserva) {
                        const idHabitacion = reserva.resourceId;
                        utilidad.idHabitacion = idHabitacion;
                        const matchId = nombreCabañas.find(cabaña => cabaña.id.toString() === idHabitacion.toString());
                        utilidad.nombreHabitacion = matchId ? matchId.name : "N/A";
                        utilidad.chaletAdmin = matchId ? chaletAdminMap[matchId.chaletAdmin] : "N/A";

                        utilidad.nochesReservadas = reserva.nNights
                        const arrivalCheckOut = moment.utc(reserva.departureDate, 'DD/MM/YYYY');
                        utilidad.checkOut = arrivalCheckOut.format('DD/MM/YYYY');
                        utilidad.statusReserva = reserva.status.toUpperCase();

                    } else {
                        utilidad.nombreHabitacion = 'N/A';
                    }

                } else {
                    utilidad.nombreHabitacion = "N/A";
                }

            })
            utilidadesPorMes.forEach((total, index) => {
                const monthName = moment().month(index).format('MMMM');
                console.log(`${monthName}: ${total}`);
            });
        }




        const limit = 1000;


        console.log(utilidades);

        utilidades.sort((a, b) => moment(b.fecha, 'DD-MM-YYYY').valueOf() - moment(a.fecha, 'DD-MM-YYYY').valueOf());


        res.render('vistaUtilidades', {
            utilidades: utilidades,
            totalEarnings,
            limit,
            utilidadesPorMes
        })

    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function mostrarUtilidadesPorUsuarioJson(req, res) {
    try {
        const loggedUserId = req.session.id;

        // Disparar lecturas en paralelo
        const [user, habitacionesExistentes, reservas, utilidades] = await Promise.all([
            usersController.obtenerUsuarioPorIdMongo(loggedUserId),
            Habitacion.find().lean(),
            Documento.find().lean(),
            Utilidades.find({ idUsuario: loggedUserId }).lean(),
        ]);

        if (!habitacionesExistentes || habitacionesExistentes.length === 0) {
            return res.status(404).send('No rooms found');
        }
        if (!reservas || reservas.length === 0) {
            return res.status(404).send('No documents found');
        }

        // Maps rápidos para lookup O(1)
        const cabanasById = new Map(
            habitacionesExistentes.map(h => [
                h._id.toString(),
                {
                    name: h?.propertyDetails?.name ?? 'N/A',
                    chaletAdmin: h?.others?.admin ? h.others.admin.toString() : null,
                },
            ])
        );

        const reservasById = new Map(
            reservas.map(r => [
                r._id.toString(),
                {
                    resourceId: r?.resourceId ? r.resourceId.toString() : null,
                    nNights: r?.nNights ?? 0,
                    departureDate: r?.departureDate ?? null,
                    status: (r?.status ?? 'N/A').toString(),
                },
            ])
        );

        // Resolver nombres de admins de cabañas (evitar N+1 serial)
        const chaletAdminIds = [...new Set(
            habitacionesExistentes
                .map(h => h?.others?.admin)
                .filter(Boolean)
                .map(a => a.toString())
        )];

        // Si tu controller no tiene método batch, al menos paralelizamos:
        const chaletAdminMap = {};
        if (chaletAdminIds.length > 0) {
            const admins = await Promise.all(
                chaletAdminIds.map(async (id) => {
                    const u = await usersController.obtenerUsuarioPorIdMongo(id);
                    return [id, u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '-'];
                })
            );
            for (const [id, nombre] of admins) chaletAdminMap[id] = nombre || '-';
        }

        // Acumulados
        let totalEarnings = 0;
        const utilidadesPorMes = Array(12).fill(0);

        const currentMonth = moment.utc().month(); // 0-11
        const currentYear = moment.utc().year();

        // Enriquecer utilidades in-place manteniendo shape; añadimos campo interno __ts para ordenar
        for (const u of utilidades) {
            // Nombre de quien genera/recibe la utilidad
            u.nombreUsuario = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

            // Parse seguro: tratamos u.fecha como Date o string ISO
            const fechaMoment = u.fecha
                ? moment.utc(u.fecha)
                : moment.invalid();

            // Guardamos un timestamp interno para ordenación (no se envía)
            u.__ts = fechaMoment.isValid() ? fechaMoment.valueOf() : 0;

            // Formato de salida conservando 'DD/MM/YYYY' como ya usabas
            u.fecha = fechaMoment.isValid() ? fechaMoment.format('DD/MM/YYYY') : 'N/A';

            // Totales por mes (si la fecha es válida)
            if (fechaMoment.isValid()) {
                utilidadesPorMes[fechaMoment.month()] += (u.monto ?? 0);

                // Total del mes/año actual
                if (fechaMoment.month() === currentMonth && fechaMoment.year() === currentYear) {
                    totalEarnings += (u.monto ?? 0);
                }
            }

            // Enlace a reserva (si existe)
            if (u.idReserva) {
                const r = reservasById.get(u.idReserva.toString());
                if (r) {
                    u.idHabitacion = r.resourceId ?? null;

                    // Datos de cabaña
                    if (r.resourceId && cabanasById.has(r.resourceId)) {
                        const cab = cabanasById.get(r.resourceId);
                        u.nombreHabitacion = cab.name ?? 'N/A';
                        u.chaletAdmin = cab.chaletAdmin ? (chaletAdminMap[cab.chaletAdmin] ?? '-') : 'N/A';
                    } else {
                        u.nombreHabitacion = 'N/A';
                        u.chaletAdmin = 'N/A';
                    }

                    // Más campos de reserva
                    u.nochesReservadas = r.nNights ?? 0;

                    const checkOutMoment = r.departureDate
                        ? moment.utc(r.departureDate)
                        : moment.invalid();

                    u.checkOut = checkOutMoment.isValid()
                        ? checkOutMoment.format('DD/MM/YYYY')
                        : 'N/A';

                    u.statusReserva = (r.status ?? 'N/A').toString().toUpperCase();
                } else {
                    u.nombreHabitacion = 'N/A';
                    u.chaletAdmin = 'N/A';
                }
            } else {
                u.nombreHabitacion = 'N/A';
                u.chaletAdmin = 'N/A';
            }
        }

        // (Opcional) Log mensual
        // utilidadesPorMes.forEach((total, i) => console.log(`${moment().month(i).format('MMMM')}: ${total}`));

        // Límite
        const limit = 1000;

        // Ordenar por fecha DESC usando el timestamp interno
        utilidades.sort((a, b) => (b.__ts || 0) - (a.__ts || 0));

        // Limpiar campo interno antes de responder
        for (const u of utilidades) delete u.__ts;

        return res.json({
            utilidades,
            totalEarnings,
            limit,
            utilidadesPorMes,
        });
    } catch (error) {
        console.log(error?.message || error);
        return res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function mostrarUtilidadesGlobales(req, res, next) {
    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            // throw new Error("El usuario no tiene un rol definido, contacte al administrador");
            return next(new Error("El usuario no tiene un rol definido, contacte al administrador"));
        }

        const permittedRole = "VIEW_GLOBAL_UTILITIES";
        if (!userPermissions.permissions.includes(permittedRole)) {
            // throw new Error("El usuario no tiene permiso para ver utilidades globales.");
            return next(new Error("El usuario no tiene permiso para ver utilidades globales."));
        }

        const loggedUserId = req.session.id;
        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        let utilidades = {};
        let utilidadesPorReserva = []

        let totalEarnings = 0

        const currentMonth = moment().month(); // Mes actual (0-11)
        const currentYear = moment().year(); // Año actual
        const utilidadesPorMes = Array(12).fill(0); // Inicializa un array con 12 elementos, todos con valor 0


        const habitacionesExistentes = await Habitacion.find().lean();
        if (!habitacionesExistentes) {
            return res.status(404).send('No rooms found');
        }

        const reservas = await Documento.find().lean();
        if (!reservas) {
            return res.status(404).send('No documents found');
        }

        // // Extract the IDs and names of the rooms
        const nombreCabañas = habitacionesExistentes.map(habitacion => ({ id: habitacion._id.toString(), name: habitacion.propertyDetails.name, chaletAdmin: habitacion.others.admin.toString() }));
        const reservasMap = reservas.map(reserva => ({ id: reserva._id.toString(), resourceId: reserva.resourceId.toString(), nNights: reserva.nNights, departureDate: reserva.departureDate, status: reserva.status, total: reserva.total }));

        for (let reserva of reservasMap) {
            const pagos = await pagoController.obtenerPagos(reserva.id);

            let pagadoReserva = pagos.reduce((total, pago) => total + pago.importe, 0);
            let restanteReserva = reserva.total - pagadoReserva;

            reserva.totalReserva = reserva.total;
            reserva.pagadoReserva = pagadoReserva;
            reserva.restanteReserva = restanteReserva;

        }


        utilidades = await Utilidades.find().lean();

        const idAllUsers = [...new Set(utilidades.map(utilidad => utilidad.idUsuario.toString()))];

        const chaletAdminIds = [...new Set(nombreCabañas.map(cabana => cabana.chaletAdmin))];
        const chaletAdminMap = {};
        for (let adminId of chaletAdminIds) {
            const userChaletAdmin = await usersController.obtenerUsuarioPorIdMongo(adminId);
            chaletAdminMap[adminId] = userChaletAdmin
                ? `${userChaletAdmin.firstName} ${userChaletAdmin.lastName}`
                : "-";
        }


        let userMontos = {}; // Object to store total monto for each user
        let utilidadMontos = {}; // Object to store total monto for each user


        for (let userId of idAllUsers) {
            let utilidadPorUsuario = utilidades.filter(utilidad => utilidad.idUsuario.toString() === userId);
            console.log("Utilidad por usuario: ")
            let user = await usersController.obtenerUsuarioPorIdMongo(userId)
            if (user) {
                for (let utilidad of utilidadPorUsuario) {

                    utilidad.nombreUsuario = `${user.firstName} ${user.lastName}`
                    utilidad.fecha = moment.utc(utilidad.fecha).format('DD/MM/YYYY');
                    const utilidadFecha = moment.utc(utilidad.fecha, 'DD/MM/YYYY');

                    if (utilidadFecha.month() === currentMonth && utilidadFecha.year() === currentYear) {
                        // Asignar nombre del usuario y formatear fecha
                        utilidad.nombreUsuario = `${user.firstName} ${user.lastName}`;
                        utilidad.fecha = utilidadFecha.format('DD/MM/YYYY');

                        // Sum the monto for each user
                        if (!userMontos[userId]) {
                            userMontos[userId] = { monto: 0, nombreUsuario: utilidad.nombreUsuario };
                        }
                        userMontos[userId].monto += utilidad.monto;


                    }

                    if (utilidad.idReserva) {
                        const reserva = reservasMap.find(reservation => reservation.id.toString() === utilidad.idReserva.toString())
                        if (reserva) {
                            const idHabitacion = reserva.resourceId;
                            utilidad.idHabitacion = idHabitacion;
                            const matchId = nombreCabañas.find(cabaña => cabaña.id.toString() === idHabitacion.toString());
                            utilidad.nombreHabitacion = matchId ? matchId.name : "N/A";
                            utilidad.chaletAdmin = matchId ? chaletAdminMap[matchId.chaletAdmin] : "N/A";

                            utilidad.nochesReservadas = reserva.nNights
                            const arrivalCheckOut = moment.utc(reserva.departureDate, 'DD/MM/YYYY');
                            utilidad.checkOut = arrivalCheckOut.format('DD/MM/YYYY');
                            utilidad.statusReserva = reserva.status.toUpperCase();

                            utilidad.totalReserva = reserva.total;
                            utilidad.pagadoReserva = reserva.pagadoReserva;
                            utilidad.restanteReserva = reserva.restanteReserva;

                        } else {
                            utilidad.nombreHabitacion = 'N/A';
                        }

                    } else {
                        utilidad.nombreHabitacion = "N/A";
                    }
                }
            }
        }

        if (Object.keys(utilidades).length > 0) {
            utilidadesPorReserva = utilidades.filter(utilidad => utilidad.concepto.includes("Utilidad"))
            utilidadesPorMes.forEach((total, index) => {
                const monthName = moment().month(index).format('MMMM');
            });

        } else {
            throw new Error("No hay utilidades para mostrar")
        }

        utilidadesPorReserva.forEach(utilidad => {
            // utilidadCantidad += utilidad.monto
            const utilidadFecha = moment.utc(utilidad.fecha, 'DD/MM/YYYY');
            if (utilidadFecha.month() === currentMonth && utilidadFecha.year() === currentYear) {
                // Asignar nombre del usuario y formatear fecha
                utilidad.fecha = utilidadFecha.format('DD/MM/YYYY');

                // Sumar al total de comisiones
                totalEarnings += utilidad.monto;

                if (utilidad.nombreHabitacion !== 'N/A' && utilidad.nombreHabitacion !== null) {
                    if (!utilidadMontos[utilidad.nombreHabitacion]) {
                        utilidadMontos[utilidad.nombreHabitacion] = { monto: 0, nombreHabitacion: utilidad.nombreHabitacion };
                    }
                    utilidadMontos[utilidad.nombreHabitacion].monto += utilidad.monto;

                }
            }

            const monthIndex = utilidadFecha.month(); // Obtiene el índice del mes (0-11)
            utilidadesPorMes[monthIndex] += utilidad.monto;

        })


        const limit = 10000;

        // console.log(Object.values(userMontos));
        // console.log(Object.values(utilidadMontos));

        utilidades.sort((a, b) => moment(b.fecha, 'DD-MM-YYYY').valueOf() - moment(a.fecha, 'DD-MM-YYYY').valueOf());
        res.render('vistaUtilidadesGlobales', {
            utilidades: utilidades,
            totalEarnings,
            limit,
            utilidadesPorMes,
            userMontos: Object.values(userMontos),
            utilidadMontos: Object.values(utilidadMontos)
        })

    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services: ' + error.message);
    }
}
async function vistaParaReporte(req, res, next) {
    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if (!userPermissions) {
            // throw new Error("El usuario no tiene un rol definido, contacte al administrador");
            return next(new Error("El usuario no tiene un rol definido, contacte al administrador"));
        }

        const permittedRole = "VIEW_RESERVATIONS_REPORT";
        if (!userPermissions.permissions.includes(permittedRole)) {
            // throw new Error("El usuario no tiene permiso para ver utilidades globales.");
            return next(new Error("El usuario no tiene permiso para ver esta página."));
        }

        let users = await usersController.getAllUsersMongo();
        const pagos = await Pago.find().lean();
        const clientes = await Cliente.find().lean();



        const currentMonth = moment().month(); // Mes actual (0-11)
        const currentYear = moment().year(); // Año actual


        const habitacionesExistentes = await Habitacion.find().lean();
        if (!habitacionesExistentes) {
            return res.status(404).send('No rooms found');
        }

        const reservasExistentes = await Documento.find().lean();
        if (!reservasExistentes) {
            return res.status(404).send('No documents found');
        }

        // const reservas = reservasExistentes.filter(reserva => reserva.status !== 'cancelled');
        const reservas = reservasExistentes;

        const habitaciones = habitacionesExistentes;

        reservas.forEach(reserva => {
            reserva.reservationDate = momentTz.tz(reserva.reservationDate, "America/Mexico_City").format("DD-MM-YYYY")
            reserva.arrivalDate = momentTz.tz(reserva.arrivalDate, "America/Mexico_City").format("DD-MM-YYYY")
            reserva.departureDate = momentTz.tz(reserva.departureDate, "America/Mexico_City").format("DD-MM-YYYY")

            const creadaPor = users.find(user => user._id.toString() === reserva.createdBy.toString());
            reserva.agenteReserva = creadaPor ? creadaPor.firstName + " " + creadaPor.lastName : "N/A"
            reserva.adminLigado = creadaPor ? creadaPor.adminname : "N/A"

            const habitacion = habitaciones.find(habitacion => habitacion._id.toString() === reserva.resourceId.toString());
            reserva.nombreHabitacion = habitacion ? habitacion.propertyDetails.name : "N/A"
            reserva.costoLimpieza = habitacion ? habitacion.additionalInfo.extraCleaningCost : "N/A"


            const pagosReserva = pagos.filter(pago => pago.reservacionId.toString() === reserva._id.toString())
            const pagosNoLiquidaEfectivoFilter = pagosReserva.filter(pago => pago.metodoPago !== "Recibio dueño")
            const pagosNoLiquidaEfectivo = pagosNoLiquidaEfectivoFilter.reduce((total, pago) => total + pago.importe, 0);

            const totalPagosReserva = pagosReserva.reduce((total, pago) => total + pago.importe, 0);
            reserva.pagosCliente = totalPagosReserva !== NaN ? totalPagosReserva : "N/A"
            reserva.pagosNoLiquidaEfectivo = pagosNoLiquidaEfectivo !== NaN ? pagosNoLiquidaEfectivo : "N/A"



            if (Array.isArray(reserva.notes) && reserva.notes.length > 0) {
                reserva.notes = reserva.notes.map(note => note.texto).join(', ')
            }

            if (Array.isArray(reserva.privateNotes) && reserva.privateNotes.length > 0) {
                reserva.privateNotes = reserva.privateNotes.map(note => note.texto).join(', ')
            }

            const liquidaEfectivo = pagosReserva.filter(pago => pago.metodoPago === "Recibio dueño").reduce((liquidaEfectivo, pago) =>
                liquidaEfectivo + pago.importe, 0);
            reserva.liquidaEfectivo = liquidaEfectivo !== NaN ? liquidaEfectivo : "N/A"

            const cliente = clientes.find(cliente => {
                if (!reserva.client) {
                    return false;
                } else {
                    return cliente._id.toString() === reserva.client.toString();
                }
            });
            reserva.nombreCliente = cliente ? (cliente.firstName + " " + cliente.lastName) : (reserva.clienteProvisional || "N/A");
            reserva.correoCliente = cliente ? cliente.email : "N/A";
            reserva.telefonoCliente = cliente ? cliente.phone : "N/A";


        })

        reservas.sort((a, b) => moment(b.arrivalDate, 'DD-MM-YYYY').valueOf() - moment(a.arrivalDate, 'DD-MM-YYYY').valueOf());
        // // Extract the IDs and names of the rooms
        // const nombreCabañas = habitacionesExistentes.resources.map(habitacion => ({ id: habitacion._id.toString(), name: habitacion.propertyDetails.name }));
        // const reservasMap = reservas.events.map(reserva => ({ id: reserva._id.toString(), resourceId: reserva.resourceId.toString() }));

        // console.log(reservas)


        res.render('reportes', {
            reservas: reservas
        })

    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while retrieving services.');
    }
}

async function altaComision(req, res) {
    try {
        const { monto, concepto, fecha, idUsuario } = req.body

        const newUtilidad = new Utilidades({
            monto,
            concepto,
            fecha,
            idUsuario: idUsuario.toString()
        })

        await newUtilidad.save()
        res.status(200).send({ newUtilidad });

    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while creating utility.');
    }
}

async function altaComisionReturn(req, res) {
    try {
        const { monto, concepto, fecha, idUsuario, idReserva, idServicio } = req

        if (monto !== null) {

            const newUtilidad = new Utilidades({
                monto,
                concepto,
                fecha,
                idUsuario,
                idReserva,
                idServicio
            })
            const savedUtilidad = await newUtilidad.save()
            if (savedUtilidad) {
                console.log("Utility created successfully.")
            } else {
                console.log("'Failed to create utility.'")
            }
        }







    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while creating utility.');
    }
}

async function editarComision(req, res) {
    try {
        const { monto, concepto, fecha, idUsuario } = req.body
        const { id } = req.params;
        const updateFields = {};

        if (monto) { updateFields.monto = monto; }
        if (concepto) { updateFields.concepto = concepto; }
        if (fecha) { updateFields.fecha = fecha; }
        if (idUsuario) { updateFields.idUsuario = idUsuario; }

        await Utilidades.findByIdAndUpdate(id, updateFields);
        res.status(200).send({ message: "Comision updated" });

    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while editing utility.');
    }
}

async function editarComisionReturn(comision) {
    try {
        const { monto, concepto, fecha, idUsuario, idReserva, idServicio, status } = comision;
        const { id } = comision;
        const updateFields = {};

        if (monto) { updateFields.monto = monto; }
        if (concepto) { updateFields.concepto = concepto; }
        if (fecha) { updateFields.fecha = fecha; }
        if (idUsuario) { updateFields.idUsuario = idUsuario; }
        if (idReserva) { updateFields.idReserva = idReserva; }
        if (idServicio) { updateFields.idServicio = idServicio; }
        if (status) { updateFields.status = status; }

        const confirmation = await Utilidades.findByIdAndUpdate(id, updateFields);
        if (confirmation) {
            console.log("Comision updated successfully.")
        } else {
            console.log("'Failed to update comision.'")
        }

    } catch (error) {
        console.log(error.message);
    }
}

async function eliminarComision(req, res) {
    try {
        const { id } = req.params;

        await Utilidades.findByIdAndDelete(id);
        res.status(200).send({ message: "Comision deleted" });

    } catch (error) {
        console.log(error.message);
        res.status(200).send('Something went wrong while deleting utility.');
    }
}

async function eliminarComisionReturn(idComision) {
    try {

        const utilidadEliminada = await Utilidades.findByIdAndDelete(idComision);
        return utilidadEliminada;

    } catch (error) {
        console.log(error.message);
    }
}

async function eliminarComisionServicio(idReserva, idServicio) {
    try {
        const deletionCriteria = {
            idReserva: idReserva,
            idServicio: idServicio
        };
        const utilidadEliminada = await Utilidades.deleteMany(deletionCriteria);
        return utilidadEliminada;

    } catch (error) {
        console.log(error.message);
    }
}

async function renderReporteTodoEnUno(req, res) {
    try {
        res.render('reporteCompleto', { layout: 'tailwindMain' });
    } catch (error) {
        console.log(error.message);
    }
}

async function reporteTodoEnUno(req, res) {
    try {
        const { fechaInicio, fechaFin } = req.query;

        // Validar parámetros
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fechaInicio y fechaFin'
            });
        }

        // Cargar datos en paralelo
        const [reservas, habitaciones, clientes, usuarios, pagos] = await Promise.all([
            Documento.find({
                arrivalDate: { 
                    $gte: new Date(fechaInicio), 
                    $lte: new Date(fechaFin) 
                },
                status: { $nin: ['cancelled', 'reserva de dueño'] },
                // _id: '6893afdf60992b7e4e8c9943'
            }).lean(),
            Habitacion.find().lean(),
            Cliente.find().lean(),
            usersController.getAllUsersMongo(),
            Pago.find().lean()
        ]);

        if (!reservas || reservas.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No se encontraron reservas en el rango de fechas especificado',
                metadata: {
                    fechaInicio,
                    fechaFin,
                    totalReservas: 0
                }
            });
        }

        // Obtener IDs de reservas y cargar utilidades
        const reservaIds = reservas.map(r => r._id);
        const utilidades = await Utilidades.find({ 
            idReserva: { $in: reservaIds } 
        }).lean();

        // Crear mapas para búsqueda rápida O(1)
        const habitacionesMap = new Map(
            habitaciones.map(h => [h._id.toString(), h])
        );

        const clientesMap = new Map(
            clientes.map(c => [c._id.toString(), c])
        );

        const usuariosMap = new Map(
            usuarios.map(u => [u._id.toString(), u])
        );

        const utilidadesPorReserva = new Map();
        utilidades.forEach(u => {
            const rid = u.idReserva?.toString();
            if (rid) {
                if (!utilidadesPorReserva.has(rid)) {
                    utilidadesPorReserva.set(rid, []);
                }
                utilidadesPorReserva.get(rid).push(u);
            }
        });

        const pagosPorReserva = new Map();
        pagos.forEach(p => {
            const rid = p.reservacionId?.toString();
            if (rid) {
                if (!pagosPorReserva.has(rid)) {
                    pagosPorReserva.set(rid, []);
                }
                pagosPorReserva.get(rid).push(p);
            }
        });

        // Procesar cada reserva
        const reporteData = reservas.map(reserva => {
            const reservaId = reserva._id.toString();
            const utilidadesReserva = utilidadesPorReserva.get(reservaId) || [];
            const pagosReserva = pagosPorReserva.get(reservaId) || [];

            // Obtener habitación
            const habitacion = habitacionesMap.get(reserva.resourceId?.toString());
            const nombreHabitacion = habitacion?.propertyDetails?.name || 'N/A';
            const costoLimpieza = habitacion?.additionalInfo?.extraCleaningCost || 0;

            // Obtener cliente
            const cliente = clientesMap.get(reserva.client?.toString());
            const nombreCliente = cliente 
                ? `${cliente.firstName || ''} ${cliente.lastName || ''}`.trim()
                : reserva.clienteProvisional || 'N/A';
            const correoCliente = cliente?.email || 'N/A';
            const telefonoCliente = cliente?.phone || 'N/A';

            // Obtener usuario que creó la reserva
            const usuarioCreador = usuariosMap.get(reserva.createdBy?.toString());
            const agenteReserva = usuarioCreador 
                ? `${usuarioCreador.firstName || ''} ${usuarioCreador.lastName || ''}`.trim()
                : 'N/A';
            const adminLigadoReserva = usuarioCreador?.adminname || 'N/A';

            // Obtener administrador ligado a la cabaña
            const adminCabana = usuariosMap.get(habitacion?.others?.admin?.toString());
            const adminLigadoCabana = adminCabana
                ? `${adminCabana.firstName || ''} ${adminCabana.lastName || ''}`.trim()
                : 'N/A';

            // Procesar utilidades
            let comisionDueno = 0;
            let comisionLimpieza = 0;
            let comisionSistema = 0;
            let comisionAdminCabana = 0;
            let comisionGerente = 0;
            let comisionVendedor = 0;
            let utilidadTotal = 0;
            let comisionInversionistas = 0;

            utilidadesReserva.forEach(utilidad => {
                const concepto = utilidad.concepto || '';
                const monto = utilidad.monto || 0;

                if (concepto.includes('Dueño de cabaña') || concepto.includes('inversionista')) {
                    if (concepto.includes('inversionista') && monto > 0) {
                        comisionInversionistas += monto;
                    } else if (concepto.includes('Dueño de cabaña') && monto > 0) {
                        comisionDueno += monto;
                    }
                } else if (concepto.includes('limpieza') || concepto.includes('Limpieza')) {
                    comisionLimpieza += monto;
                } else if (concepto.includes('uso de sistema') || concepto.includes('NyN')) {
                    comisionSistema += monto;
                } else if ((concepto.includes('administrador ligado de vendedor') || concepto.includes('Administrador ligado de vendedor')) && monto / reserva.nNights === 150) {
                    comisionAdminCabana += monto;
                } else if ((concepto.includes('administrador ligado de Cabaña') || concepto.includes('Administrador ligado de Cabaña'))) {
                    utilidadTotal += monto;
                    
                // } else if (concepto.includes('admnistrador ligado de vendedor') || concepto.includes('Administrador ligado de vendedor')) {
                //     comisionVendedor += monto;
                } else if (concepto.includes('Reservación')) {
                    if (monto / reserva.nNights === 100 || concepto.toLowerCase().includes('gerente')) {
                        comisionGerente += monto;
                    } else {
                        comisionVendedor += monto;
                    }
                }
            });

            // Calcular totales de pagos
            const totalPagado = pagosReserva.reduce((sum, pago) => sum + (pago.importe || 0), 0);
            const pagosNoEfectivo = pagosReserva
                .filter(p => p.metodoPago !== 'Recibio dueño')
                .reduce((sum, pago) => sum + (pago.importe || 0), 0);
            const liquidaEfectivo = pagosReserva
                .filter(p => p.metodoPago === 'Recibio dueño')
                .reduce((sum, pago) => sum + (pago.importe || 0), 0);

            const isNoShow = reserva.status === 'no-show';
            
            // Cálculos finales
            const precioBase = comisionDueno + comisionInversionistas;
            const precioBasePorNoche = reserva.nNights > 0 ? precioBase / reserva.nNights : 0;
            const participacionBosques = (precioBase + utilidadTotal + comisionLimpieza) * 0.20;
            const excedente = totalPagado - (isNoShow ? reserva.total / 2 : reserva.total || 0);
            const totalAgencia = comisionAdminCabana + comisionGerente + comisionVendedor + excedente;

            // Procesar notas
            const notas = Array.isArray(reserva.notes) 
                ? reserva.notes.map(n => n.texto || n).filter(Boolean).join(' | ')
                : '';
            const notasPrivadas = Array.isArray(reserva.privateNotes)
                ? reserva.privateNotes.map(n => n.texto || n).filter(Boolean).join(' | ')
                : '';

            return {
                // Identificación
                id: reserva._id,
                status: reserva.status || 'N/A',
                
                // Información de la reserva
                cabana: nombreHabitacion,
                agencia: totalAgencia,
                fechaEntrada: momentTz.tz(reserva.arrivalDate, 'America/Mexico_City').format('DD/MM/YYYY'),
                fechaSalida: momentTz.tz(reserva.departureDate, 'America/Mexico_City').format('DD/MM/YYYY'),
                noches: reserva.nNights || 0,
                huespedes: reserva.pax || 0,
                
                // Información del cliente
                nombreCliente,
                correoCliente,
                telefonoCliente,
                
                // Información de agentes
                agenteReserva,
                adminLigadoReserva,
                adminLigadoCabana,
                
                // Precios y comisiones
                precioBasePorNoche: Math.round(precioBasePorNoche * 100) / 100,
                precioBase: Math.round(precioBase * 100) / 100,
                // precioReserva: reserva.total || 0,
                precioReserva: reserva.status === 'no-show' ? reserva.total / 2 : reserva.total,
                limpieza: comisionLimpieza,
                participacionBosques: Math.round(participacionBosques * 100) / 100,
                administracionNyN: comisionSistema,
                comisionAdminCabana,
                comisionGerente,
                comisionVendedor,
                utilidadTotal,
                comisionInversionistas,
                comisionDueno,
                
                // Pagos
                totalPagado,
                pagosNoEfectivo,
                liquidaEfectivo,
                excedente: Math.round(excedente * 100) / 100,
                balanceDue: reserva.balanceDue || 0,
                
                // Notas
                notas,
                notasPrivadas,
                
                // Metadata
                fechaReservacion: momentTz.tz(reserva.reservationDate, 'America/Mexico_City').format('DD/MM/YYYY HH:mm'),
                paymentStatus: reserva.paymentStatus || 'N/A',
                
                // Detalles de utilidades (para referencia)
                detalleUtilidades: utilidadesReserva.map(u => ({
                    concepto: u.concepto,
                    monto: u.monto,
                    fecha: momentTz.tz(u.fecha, 'America/Mexico_City').format('DD/MM/YYYY')
                }))
            };
        });

        // Calcular totales generales (solo valores positivos)
        const totales = {
            totalReservas: reporteData.length,
            totalNoches: reporteData.reduce((sum, r) => sum + (r.noches > 0 ? r.noches : 0), 0),
            totalIngresos: reporteData.reduce((sum, r) => sum + (r.totalPagado > 0 ? r.totalPagado : 0), 0),
            totalPrecioReservas: reporteData.reduce((sum, r) => sum + (r.precioReserva > 0 ? r.precioReserva : 0), 0),
            totalComisionSistema: reporteData.reduce((sum, r) => sum + (r.administracionNyN > 0 ? r.administracionNyN : 0), 0),
            totalComisionAdmin: reporteData.reduce((sum, r) => sum + (r.comisionAdminCabana > 0 ? r.comisionAdminCabana : 0), 0),
            totalComisionVendedor: reporteData.reduce((sum, r) => sum + (r.comisionVendedor > 0 ? r.comisionVendedor : 0), 0),
            totalUtilidades: reporteData.reduce((sum, r) => sum + (r.utilidadTotal > 0 ? r.utilidadTotal : 0), 0),
            totalExcedente: reporteData.reduce((sum, r) => sum + (r.excedente > 0 ? r.excedente : 0), 0),
            totalAgencia: reporteData.reduce((sum, r) => sum + (r.agencia > 0 ? r.agencia : 0), 0),
        };

        // Definir headers para el Excel
        const headers = [
            { key: 'id', label: 'ID Reserva', width: 25 },
            { key: 'status', label: 'Estatus', width: 15 },
            { key: 'adminLigadoCabana', label: 'Admin Cabaña', width: 25 },
            { key: 'agenteReserva', label: 'Agente Reserva', width: 25 },
            { key: 'cabana', label: 'Cabaña', width: 30 },
            { key: 'agencia', label: 'Agencia', width: 20 },
            { key: 'fechaEntrada', label: 'Fecha Entrada', width: 15 },
            { key: 'fechaSalida', label: 'Fecha Salida', width: 15 },
            { key: 'noches', label: 'Noches', width: 10 },
            { key: 'huespedes', label: 'Huéspedes', width: 10 },
            { key: 'precioBasePorNoche', label: 'Precio Base/Noche', width: 15 },
            { key: 'precioBase', label: 'Precio Base Total', width: 15 },
            { key: 'utilidadTotal', label: 'Utilidad', width: 12 },
            { key: 'limpieza', label: 'Limpieza', width: 12 },
            { key: 'participacionBosques', label: 'Participación 20%', width: 15 },
            { key: 'administracionNyN', label: 'Admin NyN', width: 12 },
            { key: 'comisionGerente', label: 'Comisión Gerente', width: 15 },
            { key: 'comisionAdminCabana', label: 'Comisión Admin', width: 15 },
            { key: 'comisionVendedor', label: 'Comisión Vendedor', width: 15 },
            { key: 'precioReserva', label: 'Precio Reserva', width: 15 },
            { key: 'totalPagado', label: 'Total Pagado', width: 15 },
            { key: 'excedente', label: 'Excedente', width: 12 },
            { key: 'comisionInversionistas', label: 'Inversionistas', width: 15 },
            { key: 'nombreCliente', label: 'Cliente', width: 30 },
            { key: 'correoCliente', label: 'Correo', width: 30 },
            { key: 'telefonoCliente', label: 'Teléfono', width: 15 },
            { key: 'notas', label: 'Notas', width: 40 }
        ];

        // Respuesta exitosa
        res.status(200).json({
            success: true,
            data: reporteData,
            totales,
            headers,
            metadata: {
                fechaInicio,
                fechaFin,
                fechaGeneracion: momentTz.tz(new Date(), 'America/Mexico_City').format('DD/MM/YYYY HH:mm:ss'),
                totalRegistros: reporteData.length
            }
        });

    } catch (error) {
        console.error('Error en reporteTodoEnUno:', error);
        res.status(500).json({
            success: false,
            error: 'Error generando reporte Todo en Uno',
            message: error.message
        });
    }
}

module.exports = {
    obtenerComisionesPorReserva,
    calcularComisiones,
    calcularComisionesInternas,
    calcularComisionesOTA,
    mostrarUtilidadesPorUsuario,
    mostrarUtilidadesPorUsuarioJson,
    mostrarUtilidadesGlobales,
    vistaParaReporte,
    generarComisionReserva,
    generarComisionReservaBackend,
    generarComisionOTA,
    altaComision,
    altaComisionReturn,
    editarComision,
    editarComisionReturn,
    eliminarComision,
    eliminarComisionReturn,
    eliminarComisionServicio,
    renderReporteTodoEnUno,
    reporteTodoEnUno
}