const moment = require('moment');

const usersController = require('./../controllers/usersController');
const Costos = require('./../models/Costos');
const Utilidades = require('./../models/Utilidades');

async function calcularComisiones(req, res) {
    try {
        const loggedUserId = req.session.id;
        console.log(loggedUserId)

        const costosGerente = await Costos.findOne({ category: "Gerente" }); // amount
        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        const costosDuenio = await Costos.findOne({ category: "Dueño" }); //


        let counter = 0

        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        let minComission = 0
        let finalComission = 0

        while (true) {
            // console.log(user)
            if (user.privilege === 'Administrador') {
                counter += 1;
                // let costos = await Costos.find({ category: "Gerente" });
                
                if (costosGerente.commission === "Aumento por costo fijo") {
                    finalComission += costosGerente.amount;
                    minComission += costosGerente.amount
                }


                break;
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

                        minComission += costosDuenio.amount;
                        finalComission += costosDuenio.amount;
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
        console.log(minComission)
        console.log(finalComission)
        res.status(200).send({ minComission, finalComission });
    } catch (err) {
        res.status(404).send(err.message);
    }
}

async function generarComisionReserva(req, res) {
    try {
        const loggedUserId = req.session.id;
        const { precioAsignado, precioMinimo, precioMaximo, chaletName} = req.body;
        console.log("Desde generar comision reserva")
        console.log(req.body)
        
        const comisiones = {
            precioAsignado,
            precioMinimo,
            precioMaximo
        }

        console.log(loggedUserId)

        const costosGerente = await Costos.findOne({ category: "Gerente" }); // amount
        const costosVendedor = await Costos.findOne({ category: "Vendedor" }); // minAmount, maxAmount
        const costosDuenio = await Costos.findOne({ category: "Dueño" }); //



        let counter = 0

        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)

        let minComission = 0
        let finalComission = 0

        while (true) {
            // console.log(user)
            if (user.privilege === 'Administrador') {
                counter += 1;
                // let costos = await Costos.find({ category: "Gerente" });
                if (costosGerente.commission === "Aumento por costo fijo") {
                    // finalComission += costosGerente.amount;
                    // minComission += costosGerente.amount;
                    await altaComisionReturn({
                        monto: costosGerente.amount,
                        concepto: `Reservación ${chaletName}`,
                        fecha: new Date('T00:00:00'),
                        idUsuario: user._id.toString()
                    })
                }


                break;
            } else {

                counter += 1;
                console.log(counter)
                if (counter >= 2 && user.privilege !== "Administrador") {
                    user.privilege = "Gerente"
                }
                // let costos = await Costos.findOne({ category: user.privilege })

                console.log(user.privilege)

                if (user.privilege === "Vendedor") {
                    console.log(costosVendedor.commission)
                    if (costosVendedor.commission === "Aumento por costo fijo") {
                        finalComission += costosVendedor.maxAmount;
                        minComission += costosVendedor.minAmount;

                        minComission += costosDuenio.amount;
                        finalComission += costosDuenio.amount;
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
        console.log(minComission)
        console.log(finalComission)
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

        if (user.privilege !== "Administrador") {
            console.log('is not admin')
            utilidades = await Utilidades.find({ idUsuario: loggedUserId }).lean();
            // console.log(utilidades)

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
        const { monto, concepto, fecha, idUsuario } = req
        console.log(req)
        console.log(monto),
        console.log(concepto),
        console.log(fecha),
        console.log(idUsuario)
        const newUtilidad = new Utilidades({
            monto,
            concepto,
            fecha,
            idUsuario
        })

        const savedUtilidad = await newUtilidad.save()

        if (savedUtilidad) {
            console.log("Utility created successfully." )
        } else {
            console.log("'Failed to create utility.'")
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


module.exports = {
    calcularComisiones,
    mostrarUtilidadesPorUsuario,
    generarComisionReserva,
    altaComision,
    editarComision,
    eliminarComision
}