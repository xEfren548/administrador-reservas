const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'backups');

const createBackup = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}`;
    const dumpCommand = `mongodump --uri="${process.env.DB_URL}" --out=${path.join(backupPath, backupFileName)}`;

    exec(dumpCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Error al crear el respaldo:', error.message);
            return;
        }
        if (stderr) {
            console.error('Stderr:', stderr);
            return;
        }
        console.log(`Respaldo creado exitosamente: ${backupFileName}`);
    });
};

module.exports = {
    createBackup
}