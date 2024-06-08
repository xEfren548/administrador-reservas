express = require("express");
router = express.Router();

const logController = require("../controllers/logController");

router.get('/logs', logController.renderLogs);














module.exports = router;