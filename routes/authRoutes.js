const express = require('express');
const router = express.Router();
const userController = require('../controllers/authController');

router.post("/auth/login", userController.login);
router.post("/auth/logout", userController.logout);
router.get('/auth/logout', (req, res) => {
    req.session = null;
    res.redirect('/login');
});


module.exports = router;