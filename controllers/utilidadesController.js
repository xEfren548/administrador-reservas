const moment = require('moment');
const mongoose = require('mongoose');

const usersController = require('./../controllers/usersController');
const Habitacion = require('./../models/Habitacion');
const Costos = require('./../models/Costos');
const Utilidades = require('./../models/Utilidades');
const Servicio = require('./../models/Servicio');
const User = require('./../models/Usuario');

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
        console.log(loggedUserId)

        const costosGerente = await Costos.findOne({ category: "Gerente" }); // amount
        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        const costosAdministrador = await Costos.findOne({ category: "Administrador" }); //


        let counter = 0

        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        let minComission = 0
        let finalComission = 0

        while (true) {
            // console.log(user)
            if (user.privilege === 'Administrador') {
                counter += 1;
                // let costos = await Costos.find({ category: "Gerente" });

                if (user.administrator.toString() === user._id.toString()) {
                    if (costosGerente.commission === "Aumento por costo fijo") {
                        finalComission += costosAdministrador.amount;
                        minComission += costosAdministrador.amount
                        console.log('comision master admin: ', costosAdministrador.amount, user._id.toString());
                    }
                    break;
                } else {
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        finalComission += costosVendedor.maxAmount;
                        minComission += costosVendedor.minAmount;

                        console.log('comision admin vendedor: ', costosAdministrador.amount, user._id.toString());
                        user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                    }
                }
            } else {

                counter += 1;
                console.log(counter)
                if (counter >= 2 && user.privilege !== "Administrador") {
                    user.privilege = "Gerente"
                }
                // let costos = await Costos.findOne({ category: user.privilege })


                if (user.privilege === "Vendedor") {
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        finalComission += costosVendedor.maxAmount;

                        minComission += costosVendedor.minAmount;

                        console.log('comision vendedor: ', costosVendedor.maxAmount, user._id.toString())
                    }
                } else if (user.privilege === "Gerente") {
                    if (costosGerente.commission === "Aumento por costo fijo") {
                        finalComission += costosGerente.amount;
                        minComission += costosGerente.amount;

                        console.log('comision gerente: ', costosGerente.amount, user._id.toString())
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
        console.log("min comission", minComission)
        console.log("max comission", finalComission)
        res.status(200).send({ minComission, finalComission });
    } catch (err) {
        res.status(404).send(err.message);
    }
}

async function generarComisionReserva(req, res) {
    try {
        const loggedUserId = req.session.id;
        const { precioAsignado, precioMinimo, costoBase, totalSinComisiones, idReserva, chaletName, arrivalDate, departureDate } = req.body;
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




        const chalets = await Habitacion.findOne();
        const chalet = chalets.resources.find(chalet => chalet.propertyDetails.name === chaletName);
        if (!chalet) {
            throw new NotFoundError('Chalet does not exist 2');
        }

        let comisionVendedor = precioAsignado - precioMinimo;
        let utilidadChalet = totalSinComisiones - costoBase;


        const costosGerente = await Costos.findOne({ category: "Gerente" }); // amount
        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        const costosAdministrador = await Costos.findOne({ category: "Administrador" }); //

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
                            conceptoAdmin = `Comisión administrador ligado por reservación ${chaletName}`

                        } else {
                            conceptoAdmin = `Reservación ${chaletName}`
                        }
                        // finalComission += costosGerente.amount;
                        // minComission += costosGerente.amount;
                        await altaComisionReturn({
                            monto: costosAdministrador.amount,
                            concepto: conceptoAdmin,
                            fecha: new Date(departureDate),
                            idUsuario: user._id.toString(),
                            idReserva: idReserva
                        })
                    }
                    break;
                } else {
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        await altaComisionReturn({
                            monto: comisionVendedor,
                            concepto: `Comisión por Reservación admin. ${chaletName}`,
                            fecha: new Date(departureDate),
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
                            monto: comisionVendedor,
                            concepto: `Reservación ${chaletName}`,
                            fecha: new Date(departureDate),
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
                        monto: costosGerente.amount,
                        concepto: `Reservación ${chaletName}`,
                        fecha: new Date(departureDate),
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

        const chaletAdmin = chalet.others.admin.toString();
        const chaletJanitor = chalet.others.janitor.toString();
        const chaletOwner = chalet.others.owner.toString();
        const chaletInvestors = chalet.others.investors
        console.log('comision inversionistas')
        console.log(chaletInvestors)
        const idBosqueImperial = '66a7c2f2915b94d6630b67f2'

        // Comisión de administrador top
        await altaComisionReturn({
            monto: utilidadChalet,
            concepto: `Utilidad de reservación ${chaletName}`,
            fecha: new Date(departureDate),
            idUsuario: idBosqueImperial,
            idReserva: idReserva
        })

        // Comisión de limpieza
        await altaComisionReturn({
            monto: chalet.additionalInfo.extraCleaningCost,
            concepto: `Comisión limpieza ${chaletName}`,
            fecha: new Date(departureDate),
            idUsuario: chaletJanitor,
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
        let comisionInversionistas = nuevoCostoBase / cuantosInversionistas
        console.log('comision inversionistas: ', comisionInversionistas)

        if (cuantosInversionistas > 0) {
            for (let investor of chaletInvestors) {
                let userInvestor = await User.findById(investor._id);
                if (userInvestor) {
                    if (userInvestor.investorType === 'F'){
                        // Comision normal
                        await altaComisionReturn({
                            monto: comisionInversionistas,
                            concepto: `Comisión de inversionista por Reserva de cabaña: ${chaletName}`,
                            fecha: new Date(departureDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de IVA (16%)
                        let comisionNegativaIva = comisionInversionistas * 0.16;
                        await altaComisionReturn({
                            monto: -comisionNegativaIva,
                            concepto: `Retención IVA inversionista por Reserva de cabaña: ${chaletName}`,
                            fecha: new Date(departureDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })
                        // Comision negativa de ISR (5%)
                        let comisionNegativaIsr = comisionInversionistas * 0.05;
                        await altaComisionReturn({
                            monto: -comisionNegativaIsr,
                            concepto: `Retención ISR inversionista por Reserva de cabaña: ${chaletName}`,
                            fecha: new Date(departureDate),
                            idUsuario: investor._id,
                            idReserva: idReserva
                        })
        
                    } else {
                        await altaComisionReturn({
                            monto: comisionInversionistas,
                            concepto: `Comisión de inversionista por Reserva de cabaña: ${chaletName}`,
                            fecha: new Date(departureDate),
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
                concepto: `Comisión Dueño de cabaña: ${chaletName}`,
                fecha: new Date(departureDate),
                idUsuario: chaletOwner,
                idReserva: idReserva
            })
        }





        res.status(200).json({ success: true, message: "Comision agregada con éxito" })
    } catch (err) {
        res.status(404).send(err.message);
    }
}

async function mostrarUtilidadesPorUsuario(req, res) {
    try {
        const loggedUserId = req.session.id;
        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        let utilidades = {};


        utilidades = await Utilidades.find({ idUsuario: loggedUserId }).lean();

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

            })
            utilidadesPorMes.forEach((total, index) => {
                const monthName = moment().month(index).format('MMMM');
                console.log(`${monthName}: ${total}`);
            });
            console.log(utilidades)
            console.log(utilidadesPorMes)
        }




        const limit = 1000;


        console.log(utilidades);

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

async function mostrarUtilidadesGlobales(req, res) {
    try {
        const loggedUserId = req.session.id;
        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        let utilidades = {};
        let utilidadesPorReserva = []


        utilidades = await Utilidades.find().lean();

        let totalEarnings = 0

        const currentMonth = moment().month(); // Mes actual (0-11)
        const currentYear = moment().year(); // Año actual
        const utilidadesPorMes = Array(12).fill(0); // Inicializa un array con 12 elementos, todos con valor 0

        if (Object.keys(utilidades).length > 0) {
            utilidadesPorReserva = utilidades.filter(utilidad => utilidad.concepto.includes("Utilidad"))

            for (let utilidad of utilidades){
                let idUser = utilidad.idUsuario;
                let user = await usersController.obtenerUsuarioPorIdMongo(idUser)
                if (user) {
                    utilidad.nombreUsuario = `${user.firstName} ${user.lastName}`
                    utilidad.fecha = moment.utc(utilidad.fecha).format('DD/MM/YYYY');
                    const utilidadFecha = moment.utc(utilidad.fecha, 'DD/MM/YYYY');
    
                    if (utilidadFecha.month() === currentMonth && utilidadFecha.year() === currentYear) {
                        // Asignar nombre del usuario y formatear fecha
                        utilidad.nombreUsuario = `${user.firstName} ${user.lastName}`;
                        utilidad.fecha = utilidadFecha.format('DD/MM/YYYY');
    
    
                    }

                }

            }

            utilidadesPorMes.forEach((total, index) => {
                const monthName = moment().month(index).format('MMMM');
            });
        }


        utilidadesPorReserva.forEach(utilidad => {
            // utilidadCantidad += utilidad.monto
            const utilidadFecha = moment.utc(utilidad.fecha, 'DD/MM/YYYY');
            if (utilidadFecha.month() === currentMonth && utilidadFecha.year() === currentYear) {
                // Asignar nombre del usuario y formatear fecha
                utilidad.fecha = utilidadFecha.format('DD/MM/YYYY');

                // Sumar al total de comisiones
                totalEarnings += utilidad.monto;


            }

            const monthIndex = utilidadFecha.month(); // Obtiene el índice del mes (0-11)
            utilidadesPorMes[monthIndex] += utilidad.monto;

        })


        const limit = 10000;

        res.render('vistaUtilidadesGlobales', {
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

        if (monto !== 0) {

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
    mostrarUtilidadesPorUsuario,
    mostrarUtilidadesGlobales,
    generarComisionReserva,
    altaComision,
    altaComisionReturn,
    editarComision,
    editarComisionReturn,
    eliminarComision,
    eliminarComisionReturn,
    eliminarComisionServicio
}