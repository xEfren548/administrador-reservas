const mongoose = require('mongoose');


const PermissionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
        required: false,
    },
});

module.exports = mongoose.model('RolePermissions', PermissionSchema);
