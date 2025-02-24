const multer = require('multer');
const path = require('path');

console.log("Entrando a multer");
// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Carpeta donde se guardarán los archivos temporalmente
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Nombre único para el archivo
    }
});
const upload = multer({ storage });
console.log("Saliendo de multer");

module.exports = upload;