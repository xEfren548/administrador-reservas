const usersController = require('./../controllers/usersController');
const Costos = require('./../models/Costos');

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
        res.status(200).send({finalComission});
    } catch (err) {
        res.status(404).send(err.message);
    }
}

module.exports = {
    calcularComisiones
}