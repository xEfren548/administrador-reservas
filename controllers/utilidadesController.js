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
        console.log("nnights: ",  nNights)

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
        console.log("nnights: ",  nNights)

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
        if (!chaletAdmin){
            throw new Error("No chalet admin found.")
        }

        // Utilidad
        if (chaletType === "Bosque Imperial"){
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
        let cuantosInversionistas = chaletInvestors.length
        console.log('cuantos inversionistas: ', cuantosInversionistas)
        let comisionInversionistas = Math.round((nuevoCostoBase / cuantosInversionistas + Number.EPSILON) * 100) / 100;
        console.log('comision inversionistas: ', comisionInversionistas)


        if (cuantosInversionistas > 0) {
            for (let investor of chaletInvestors) {
                let userInvestor = await User.findById(investor._id);
                if (userInvestor) {
                    if (userInvestor.investorType === 'Asimilado'){
                        // Comision normal
                        await altaComisionReturn({
                            monto: comisionInversionistas,
                            concepto: `Comisión de inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comisionInversionistas * 0.16;
                        let comisionNegativaIva = Math.round((comisionInversionistas * 0.16 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaIva,
                            concepto: `IVA inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de ISR (5%)
                        // let comisionNegativaIsr = comisionInversionistas * 0.05;
                        let comisionNegativaIsr = Math.round(((comisionInversionistas - comisionNegativaIva) * 0.16 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaIsr,
                            concepto: `ISR inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })

                        // Retencion "Servicios indirectos Bosque imperial"
                        let comisionNegativaServiciosIndirectos = Math.round(((comisionInversionistas - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaServiciosIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })

                    } else if (userInvestor.investorType === 'RESICO Fisico'){
                        // Comision normal
                        await altaComisionReturn({
                            monto: comisionInversionistas,
                            concepto: `Comisión de inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })

                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comisionInversionistas * 0.16;
                        let comisionNegativaIva = Math.round((comisionInversionistas * 0.16 + Number.EPSILON) * 100) / 100;

                        // Comision Retencion IVA
                        let comisionNegativaRetIva = Math.round((comisionInversionistas * 0.1066 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaRetIva,
                            concepto: `Retención IVA inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })

                        // Comision Retencion ISR
                        let comisionNegativaRetIsr = Math.round((comisionInversionistas * 0.0125 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionNegativaRetIsr,
                            concepto: `ISR inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })

                        // Comision Retencion Servicios Indirectos
                        let comisionServIndirectos = Math.round(((comisionInversionistas - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })

                    } else if(userInvestor.investorType === 'PF con AE y PM') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comisionInversionistas,
                            concepto: `Comisión de inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })

                        // IVA
                        let comisionNegativaIva = Math.round((comisionInversionistas * 0.16 + Number.EPSILON) * 100) / 100;

                        // Comision Retencion Servicios Indirectos
                        let comisionServIndirectos = Math.round(((comisionInversionistas - comisionNegativaIva) * 0.04 + Number.EPSILON) * 100) / 100;
                        await altaComisionReturn({
                            monto: -comisionServIndirectos,
                            concepto: `Servicios Indirectos Bosque Imperial`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })
                    } else if (userInvestor.investorType === 'Efectivo') {
                        // Comision normal
                        await altaComisionReturn({
                            monto: comisionInversionistas,
                            concepto: `Comisión de inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de IVA (16%)
                        // let comisionNegativaIva = comisionInversionistas * 0.16;
                        let comisionNegativaIva = Math.round((comisionInversionistas * 0.08 + Number.EPSILON) * 100) / 100;

                        await altaComisionReturn({
                            monto: -comisionNegativaIva,
                            concepto: `IVA inversionista por Reserva de cabaña`,
                            fecha: new Date(arrivalDate),
                            idUsuario: investor._id,
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
                            const arrivalCheckOut =  moment.utc(reserva.departureDate, 'DD/MM/YYYY');
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

async function mostrarUtilidadesGlobales(req, res, next) {
    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
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
                            const arrivalCheckOut =  moment.utc(reserva.departureDate, 'DD/MM/YYYY');
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




        // let userMontos = {}; // Object to store total monto for each user
        // let utilidadMontos = {}; // Object to store total monto for each user

        // if (Object.keys(utilidades).length > 0) {
        //     utilidadesPorReserva = utilidades.filter(utilidad => utilidad.concepto.includes("Utilidad"))

        //     for (let utilidad of utilidades) {
        //         let idUser = utilidad.idUsuario;
        //         let user = await usersController.obtenerUsuarioPorIdMongo(idUser)
        //         if (user) {
        //             utilidad.nombreUsuario = `${user.firstName} ${user.lastName}`
        //             utilidad.fecha = moment.utc(utilidad.fecha).format('DD/MM/YYYY');
        //             const utilidadFecha = moment.utc(utilidad.fecha, 'DD/MM/YYYY');

        //             if (utilidadFecha.month() === currentMonth && utilidadFecha.year() === currentYear) {
        //                 // Asignar nombre del usuario y formatear fecha
        //                 utilidad.nombreUsuario = `${user.firstName} ${user.lastName}`;
        //                 utilidad.fecha = utilidadFecha.format('DD/MM/YYYY');

        //                 // Sum the monto for each user
        //                 if (!userMontos[idUser]) {
        //                     userMontos[idUser] = { monto: 0, nombreUsuario: utilidad.nombreUsuario };
        //                 }
        //                 userMontos[idUser].monto += utilidad.monto;


        //             }
        //             if (utilidad.idReserva) {
        //                 const reserva = reservasMap.find(reservation => reservation.id.toString() === utilidad.idReserva.toString())
        //                 if (reserva) {
        //                     const idHabitacion = reserva.resourceId;
        //                     const matchId = nombreCabañas.find(cabaña => cabaña.id.toString() === idHabitacion.toString());
        //                     utilidad.nombreHabitacion = matchId.name;
        //                 } else {
        //                     utilidad.nombreHabitacion = 'N/A';
        //                 }

        //             } else {
        //                 utilidad.nombreHabitacion = "N/A";
        //             }



        //         }

        //     }

        //     utilidadesPorMes.forEach((total, index) => {
        //         const monthName = moment().month(index).format('MMMM');
        //     });
        // }


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
        if(!userPermissions){
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

        const reservas = reservasExistentes.filter(reserva => reserva.status !== 'cancelled');

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
            const pagosNoLiquidaEfectivoFilter = pagos.filter(pago => pago.metodoPago !== "Recibio dueño")
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


module.exports = {
    obtenerComisionesPorReserva,
    calcularComisiones,
    calcularComisionesInternas,
    mostrarUtilidadesPorUsuario,
    mostrarUtilidadesGlobales,
    vistaParaReporte,
    generarComisionReserva,
    altaComision,
    altaComisionReturn,
    editarComision,
    editarComisionReturn,
    eliminarComision,
    eliminarComisionReturn,
    eliminarComisionServicio
}