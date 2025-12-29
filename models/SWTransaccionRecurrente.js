const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const swTransaccionRecurrenteSchema = new Schema({
    cuenta: {
        type: Schema.Types.ObjectId,
        ref: 'SWCuenta',
        required: true
    },
    tipo: {
        type: String,
        enum: ['Ingreso', 'Gasto'],
        required: true
    },
    monto: {
        type: Number,
        required: true,
        min: [0.01, 'El monto debe ser mayor a 0']
    },
    concepto: {
        type: String,
        required: true,
        trim: true
    },
    descripcion: {
        type: String,
        trim: true
    },
    categoria: {
        type: String,
        enum: [
            'Alimentación',
            'Transporte',
            'Servicios',
            'Mantenimiento',
            'Compras',
            'Salud',
            'Entretenimiento',
            'Educación',
            'Hogar',
            'Salario',
            'Venta',
            'Inversión',
            'Préstamo',
            'Reembolso',
            'Otro'
        ],
        required: true,
        default: 'Otro'
    },
    
    // Configuración de recurrencia
    frecuencia: {
        type: String,
        enum: ['Diaria', 'Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral', 'Anual'],
        required: true
    },
    diaEjecucion: {
        type: Number,
        min: 1,
        max: 31
    },
    fechaInicio: {
        type: Date,
        required: true
    },
    fechaFin: {
        type: Date
    },
    
    // Estado y control
    activa: {
        type: Boolean,
        default: true
    },
    ultimaEjecucion: {
        type: Date
    },
    proximaEjecucion: {
        type: Date,
        required: true
    },
    
    // Información adicional
    creadoPor: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    notificarAntes: {
        type: Number,
        default: 1,
        min: 0
    },
    ejecutarAutomaticamente: {
        type: Boolean,
        default: false
    },
    
    // Historial de transacciones generadas
    transaccionesGeneradas: [{
        transaccion: {
            type: Schema.Types.ObjectId,
            ref: 'SWTransaccion'
        },
        fecha: {
            type: Date,
            default: Date.now
        }
    }],
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Índices
swTransaccionRecurrenteSchema.index({ cuenta: 1, activa: 1 });
swTransaccionRecurrenteSchema.index({ proximaEjecucion: 1, activa: 1 });
swTransaccionRecurrenteSchema.index({ creadoPor: 1 });

// Middleware para actualizar updatedAt
swTransaccionRecurrenteSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Método para calcular la próxima ejecución
swTransaccionRecurrenteSchema.methods.calcularProximaEjecucion = function() {
    const fecha = new Date(this.proximaEjecucion || this.fechaInicio);
    
    switch (this.frecuencia) {
        case 'Diaria':
            fecha.setDate(fecha.getDate() + 1);
            break;
        case 'Semanal':
            fecha.setDate(fecha.getDate() + 7);
            break;
        case 'Quincenal':
            fecha.setDate(fecha.getDate() + 15);
            break;
        case 'Mensual':
            fecha.setMonth(fecha.getMonth() + 1);
            break;
        case 'Bimestral':
            fecha.setMonth(fecha.getMonth() + 2);
            break;
        case 'Trimestral':
            fecha.setMonth(fecha.getMonth() + 3);
            break;
        case 'Anual':
            fecha.setFullYear(fecha.getFullYear() + 1);
            break;
    }
    
    // Si hay un día de ejecución específico, ajustar
    if (this.diaEjecucion && this.frecuencia === 'Mensual') {
        fecha.setDate(Math.min(this.diaEjecucion, new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate()));
    }
    
    return fecha;
};

module.exports = mongoose.model('SWTransaccionRecurrente', swTransaccionRecurrenteSchema);
