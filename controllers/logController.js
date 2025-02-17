const Log = require('../models/Log');
const Usuario = require('../models/Usuario');
const Roles = require('../models/Roles');
// const logController = require('../controllers/logcontroller');

async function showLogs() {
    try {
        const logs = await Log.find().lean();
        return logs;
    } catch (err) {
        return 'No logs found'
    }
}

async function renderLogs(req, res, next) {
    try {
        const userRole = req.session.role;

        const userPermissions = await Roles.findById(userRole);
        if(!userPermissions){
            // throw new Error("El usuario no tiene un rol definido, contacte al administrador");
            return next(new Error("El usuario no tiene un rol definido, contacte al administrador"));
        }
    
        const permittedRole = "VIEW_LOGS";
        if (!userPermissions.permissions.includes(permittedRole)) {
            // throw new Error("El usuario no tiene permiso para ver utilidades globales.");
            return next(new Error("El usuario no tiene permiso para ver esta página."));
        }
    
        const logs = await showLogs();
        console.log(logs)

        logs.sort((a, b) => a.fecha - b.fecha);

        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses en JavaScript son 0-indexados
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        };

        const formattedActions = logs.map(action => {
            const fecha = formatDate(action.fecha);
            const hora = action.fecha.toTimeString().split(' ')[0];
            return {
                ...action,
                fecha,
                hora
            };
        });

        res.render('logsView', {
            logs: formattedActions
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