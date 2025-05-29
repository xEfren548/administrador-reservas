const mongoose = require('mongoose');

const AirbnbChannelSchema = new mongoose.Schema({
    userId: { type: String, required: true },  // tu ID interno (del token)
    channelId: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    airbnbUserId: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('AirbnbChannel', AirbnbChannelSchema);
