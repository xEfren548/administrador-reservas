const mongoose = require('mongoose');

const { Schema } = mongoose;

const pushDeviceSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true
    },
    token: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    platform: {
        type: String,
        enum: ['android', 'ios', 'web', 'unknown'],
        default: 'unknown'
    },
    app: {
        type: String,
        trim: true,
        default: 'flutter-finanzas'
    },
    deviceId: {
        type: String,
        trim: true
    },
    deviceName: {
        type: String,
        trim: true
    },
    appVersion: {
        type: String,
        trim: true
    },
    appBuild: {
        type: String,
        trim: true
    },
    active: {
        type: Boolean,
        default: true
    },
    lastSeenAt: {
        type: Date,
        default: Date.now
    },
    unregisteredAt: {
        type: Date,
        default: null
    },
    invalidatedAt: {
        type: Date,
        default: null
    },
    lastErrorCode: {
        type: String,
        trim: true,
        default: null
    }
}, {
    timestamps: true
});

pushDeviceSchema.index({ user: 1, active: 1, app: 1 });
pushDeviceSchema.index({ user: 1, deviceId: 1 }, { sparse: true });

module.exports = mongoose.model('PushDevice', pushDeviceSchema);