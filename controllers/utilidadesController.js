const usersController = require('./../controllers/usersController');
const Costos = require('./../models/Costos');

async function calcularComisiones(req, res) {
    try {
        const loggedUserId = req.session.id;
        console.log(loggedUserId)



        let user = await usersController.obtenerUsuarioPorIdMongo(loggedUserId)
        let comission = 100
        let finalComission = 0
        let counter = 0
        while (true) {
            if (user.privilege === 'Administrador') {
                counter += 1;
                if (counter === 1) {
                    let costos = await Costos.find({ category: "Gerente" });

                    if (costos.comisison === "Aumento por costo fijo") {
                        finalComission += costos.amount_max;
                    }

                } else {
                    finalComission += comission
                }
                break;
            } else {
                user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                counter += 1;
                if (counter >= 2) {
                    user.privilege = "Gerente"
                }
                let costos = await Costos.find({ category: user.privilege });

                if (costos.comisison === "Aumento por costo fijo") {
                    finalComission += costos.amount_max;
                } 
                
                console.log(counter)

            }
        }

        console.log(finalComission)
        res.send(finalComission);
    } catch (err) {
        res.status(404).send(err.message);
    }
}

module.exports = {
    calcularComisiones
}