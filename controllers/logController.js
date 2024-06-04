const Log = require('../models/Log');
const Usuario = require('../models/Usuario');
// const logController = require('../controllers/logcontroller');

async function showLogs() {
    try {
        const logs = await Log.find().lean();
        return logs;
    } catch (err) {
        return 'No logs found'
    }
}

async function renderLogs(req, res) {
    try {
        const idReserva = req.query
        const logs = await showLogs();
        console.log(logs)

        res.render('logsView', {
            logs: logs
        });
    } catch (error) {
        res.status(404).send(error.message)
    }
}

async function createBackendLog(logDetails) {
    try {
        const { fecha, idUsuario, type, idReserva, acciones, nombreUsuario } = logDetails
        
        const newLog = new Log({
            fecha,
            idUsuario,
            type,
            idReserva,
            acciones,
            nombreUsuario
        });
        console.log(newLog);
        const savedLog = await newLog.save();

        if (savedLog) {
            console.log("Log created successfully.")
        } else {
            console.log("Failed to create log.")
        }
    } catch (error) {
        console.log(error.message);
    }
}

async function createFrontendLog(req, res) {
    try {

    } catch (error) {

    }
}









module.exports = {
    renderLogs,
    createBackendLog
}