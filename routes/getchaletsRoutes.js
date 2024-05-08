express = require("express");
router = express.Router();
const cabanasController = require('../controllers/getcabanasController');

router.get('/', cabanasController.showChaletsData);


module.exports = router;