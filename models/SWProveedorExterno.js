const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const swProveedorExternoSchema = new Schema({
    organizacion: {
        type: Schema.Types.ObjectId,
        ref: 'SWOrganizacion',
        required: true,
        index: true
    },
    nombre: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    beneficiario: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    banco: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    cuentaClabe: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30
    },
    activa: {
        type: Boolean,
        default: true,
        index: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

swProveedorExternoSchema.index({ organizacion: 1, activa: 1, nombre: 1 });
swProveedorExternoSchema.index({ organizacion: 1, cuentaClabe: 1, beneficiario: 1 });

swProveedorExternoSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const SWProveedorExterno = mongoose.model('SWProveedorExterno', swProveedorExternoSchema);

module.exports = SWProveedorExterno;