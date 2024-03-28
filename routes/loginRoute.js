express = require("express");

router = express.Router();

router.get("/login", (req, res) => {
    res.render("login", {
        layout: null
    });
})

module.exports = router;