const { Schema, model } = require('mongoose');

const rackLimpiezaSchema = new Schema({
    id_reserva: {
        type: Schema.Types.ObjectId,
        ref: 'documentos',
        required: true
    },
    descripcion: {
        type: String,
        required: true
    },
    fecha: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    nombreHabitacion: {
        type: String
    }
    
});

rackLimpiezaSchema.statics.obtenerServiciosLimpieza = async function(){
    const serviciosLimpieza = await RackLimpieza.find();
    return serviciosLimpieza;
}

const RackLimpieza = model('racklimpieza', rackLimpiezaSchema);


module.exports = RackLimpieza;