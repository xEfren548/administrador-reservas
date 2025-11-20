const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const swCuentaSchema = new Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    descripcion: {
        type: String,
        trim: true
    },
    tipoCuenta: {
        type: String,
        enum: ['Bancaria', 'Efectivo', 'Tarjeta', 'Billetera Digital', 'Otra'],
        required: true,
        default: 'Bancaria'
    },
    moneda: {
        type: String,
        enum: ['MXN', 'USD', 'EUR'],
        default: 'MXN',
        required: true
    },
    saldoInicial: {
        type: Number,
        default: 0,
        required: true
    },
    saldoActual: {
        type: Number,
        default: 0,
        required: true
    },
    organizacion: {
        type: Schema.Types.ObjectId,
        ref: 'SWOrganizacion',
        required: true
    },
    propietario: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    datosBancarios: {
        beneficiario: {
            type: String,
            trim: true
        },
        banco: {
            type: String,
            trim: true
        },
        clabe: {
            type: String,
            trim: true,
            maxlength: 18
        },
        numeroCuenta: {
            type: String,
            trim: true
        },
        referencia: {
            type: String,
            trim: true
        }
    },
    activa: {
        type: Boolean,
        default: true
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

// Índices para mejorar las consultas
swCuentaSchema.index({ organizacion: 1, propietario: 1 });
swCuentaSchema.index({ activa: 1 });

// Middleware para actualizar updatedAt
swCuentaSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Método para calcular saldo basado en transacciones
swCuentaSchema.methods.calcularSaldo = async function() {
    const SWTransaccion = mongoose.model('SWTransaccion');
    const result = await SWTransaccion.aggregate([
        {
            $match: {
                cuenta: this._id,
                aprobada: true
            }
        },
        {
            $group: {
                _id: null,
                totalIngresos: {
                    $sum: {
                        $cond: [{ $eq: ['$tipo', 'Ingreso'] }, '$monto', 0]
                    }
                },
                totalGastos: {
                    $sum: {
                        $cond: [{ $eq: ['$tipo', 'Gasto'] }, '$monto', 0]
                    }
                }
            }
        }
    ]);

    if (result.length > 0) {
        this.saldoActual = this.saldoInicial + result[0].totalIngresos - result[0].totalGastos;
    } else {
        this.saldoActual = this.saldoInicial;
    }
    
    return this.saldoActual;
};

const SWCuenta = mongoose.model('SWCuenta', swCuentaSchema);

module.exports = SWCuenta;
