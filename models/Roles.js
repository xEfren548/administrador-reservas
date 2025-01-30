const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
        required: false,
    },
    permissions: [{
        type: String,
        required: true
    }],
});

const Roles = mongoose.model('Roles', RoleSchema);

module.exports = Roles;
