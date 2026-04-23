const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require('path');
const RequestValidationError = require("../error/request-validation-error");

const MAX_IMAGES_PER_REQUEST = 40;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "upload");
    },
    filename: (req, file, cb) => {
        const filename = uuidv4() + path.extname(file.originalname);
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const type = file.mimetype;
    if(type === 'image/png' || type === 'image/jpg' || type === 'image/jpeg' || type === 'image/svg' || type === 'image/bmp'){
        return cb(null, true)
    } else{
        cb(new RequestValidationError([
            { msg: 'Solo se permiten imagenes PNG, JPG, JPEG, SVG y BMP', param: 'images' }
        ]))
    }
};

//module.exports = multer({ storage }).single("image");
const uploadImages = multer({
    storage,
    fileFilter,
    limits: {
        files: MAX_IMAGES_PER_REQUEST
    }
}).array("images", MAX_IMAGES_PER_REQUEST);

module.exports = (req, res, next) => {
    uploadImages(req, res, (err) => {
        if (!err) {
            return next();
        }

        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
                return next(new RequestValidationError([
                    { msg: `Puedes subir un maximo de ${MAX_IMAGES_PER_REQUEST} imagenes por solicitud`, param: 'images' }
                ]));
            }

            return next(new RequestValidationError([
                { msg: `Error al subir imagenes: ${err.message}`, param: 'images' }
            ]));
        }

        return next(err);
    });
};
// module.exports = multer({ storage, fileFilter }).single('file');
