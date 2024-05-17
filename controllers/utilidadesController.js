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
                counter+= 1;
                if (counter === 1) {
                    finalComission = 400
                } else {
                    finalComission += comission
                }
                break;
            } else {
                user = await usersController.obtenerUsuarioPorIdMongo(user.administrator)
                counter+= 1;
                if (counter >=2 ) {
                    user.privilege = "Gerente de ventas"
                }
                let costos = await Costos.find({category: user.privilege});
                console.log(costos)
                finalComission += comission
                console.log(counter)

            }
        }

        console.log(finalComission)
    } catch (err) {
        res.status(404).send(err.message);
    }
}

module.exports = {
    calcularComisiones
}