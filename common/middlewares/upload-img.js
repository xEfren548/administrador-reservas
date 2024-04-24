const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require('path');

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
    if(type === 'image/png' || type === 'image/jpg' || type === 'image/jpeg' || type === 'image/svg' || type === 'image/bmp' || type === 'image/bmp'){
        return cb(null, true)
    } else{
        cb(null, false)
    }
};

//module.exports = multer({ storage }).single("image");
module.exports = multer({ storage, fileFilter }).array("images", 10);