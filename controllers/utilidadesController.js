const moment = require('moment');

const usersController = require('./../controllers/usersController');
const Costos = require('./../models/Costos');
const Utilidades = require('./../models/Utilidades');

async function calcularComisiones(req, res) {
    try {
        const loggedUserId = req.session.id;
        console.log(loggedUserId)


        let counter = 0

        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)
        let finalComission = 0

        while (true) {
            // console.log(user)
            if (user.privilege === 'Administrador') {
                counter += 1;
                let costos = await Costos.find({ category: "Gerente" });

                if (costos.comisison === "Aumento por costo fijo") {
                    finalComission += costos.maxAmount;
                }


                break;
            } else {

                counter += 1;
                console.log(counter)
                if (counter >= 2 && user.privilege !== "Administrador") {
                    user.privilege = "Gerente"
                }
                let costos = await Costos.findOne({ category: user.privilege })

                if (costos.commission == "Aumento por costo fijo") {
                    finalComission += costos.maxAmount;
                }

                user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                if (!user) {
                    res.status(400).send({ message: "user not found" })
                }


            }
        }

        console.log(finalComission)
        res.status(200).send({ finalComission });
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
    altaComision,
    editarComision,
    eliminarComision
}