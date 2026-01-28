const mongoose = require('mongoose');

const cuentaReferidoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true,
        maxlength: [100, 'El nombre no puede exceder 100 caracteres']
    },
    celular: {
        type: String,
        trim: true,
        maxlength: [20, 'El celular no puede exceder 20 caracteres']
    },
    tipo: {
        type: String,
        enum: {
            values: ['influencer', 'marca', 'afiliado', 'otro'],
            message: 'El tipo debe ser influencer, marca, afiliado u otro'
        },
        required: [true, 'El tipo es requerido'],
        default: 'influencer'
    },
    cupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cupon',
        default: null
    },
    comisionReferidor: {
        tipo: {
            type: String,
            enum: {
                values: ['percentage', 'fixed_amount'],
                message: 'El tipo de comisión debe ser percentage o fixed_amount'
            },
            default: 'percentage'
        },
        valor: {
            type: Number,
            default: 0,
            min: [0, 'El valor de la comisión no puede ser negativo']
        }
    },
    notas: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
    },
    activo: {
        type: Boolean,
        default: true
    },
    creadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    modificadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    }
}, {
    timestamps: true
});

// Índices
cuentaReferidoSchema.index({ nombre: 1 });
cuentaReferidoSchema.index({ tipo: 1 });
cuentaReferidoSchema.index({ activo: 1 });
cuentaReferidoSchema.index({ cupon: 1 });

// Virtual para obtener estadísticas (se calculará en el controlador)
cuentaReferidoSchema.virtual('estadisticas', {
    ref: 'CuponUsage',
    localField: 'cupon',
    foreignField: 'cupon'
});

// Método para calcular comisión total acumulada
cuentaReferidoSchema.methods.calcularComisionTotal = async function() {
    const CuponUsage = mongoose.model('CuponUsage');
    
    if (!this.cupon) return 0;
    
    const usos = await CuponUsage.find({ cupon: this.cupon });
    
    let comisionTotal = 0;
    
    usos.forEach(uso => {
        if (this.comisionReferidor.tipo === 'percentage') {
            // Comisión = porcentaje del monto original de la reserva
            comisionTotal += (uso.montoOriginal * this.comisionReferidor.valor) / 100;
        } else if (this.comisionReferidor.tipo === 'fixed_amount') {
            // Comisión fija por cada uso
            comisionTotal += this.comisionReferidor.valor;
        }
    });
    
    return comisionTotal;
};

module.exports = mongoose.model('CuentaReferido', cuentaReferidoSchema);
