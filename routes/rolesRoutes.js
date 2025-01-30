const express = require('express');
const router = express.Router();

const rolesController = require('../controllers/rolesController');

router.get('/roles', (req, res) => {
    res.render('rolesView');
});

router.get('/newroles', rolesController.showCreateRoleForm)
router.post('/newroles', rolesController.createRole)
router.put('/roles/:id/edit', rolesController.updateRole)

module.exports = router;