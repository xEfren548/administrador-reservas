const express = require('express');
const router = express.Router();

const rolesController = require('../controllers/rolesController');

router.get('/roles', (req, res) => {
    res.render('rolesView');
});

router.get('/newroles', rolesController.showCreateRoleForm)

module.exports = router;