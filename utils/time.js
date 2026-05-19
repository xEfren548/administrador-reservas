const moment = require('moment-timezone');

const MEXICO_TZ = 'America/Mexico_City';
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeStoredTime(value, fallback = null) {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (TIME_PATTERN.test(trimmedValue)) {
            return trimmedValue;
        }

        const parsedTime = moment.utc(trimmedValue);
        if (parsedTime.isValid()) {
            return parsedTime.tz(MEXICO_TZ).format('HH:mm');
        }

        return fallback;
    }

    if (value instanceof Date || typeof value === 'number') {
        const parsedTime = moment.utc(value);
        if (parsedTime.isValid()) {
            return parsedTime.tz(MEXICO_TZ).format('HH:mm');
        }
    }

    if (moment.isMoment(value) && value.isValid()) {
        return value.format('HH:mm');
    }

    return fallback;
}

function getTimeParts(value, fallback = '00:00') {
    const normalizedTime = normalizeStoredTime(value, fallback) || fallback;
    const safeTime = TIME_PATTERN.test(normalizedTime) ? normalizedTime : fallback;
    const [hours, minutes] = safeTime.split(':').map(Number);

    return {
        normalized: safeTime,
        hours,
        minutes
    };
}

function setTimeOnDate(date, value, options = {}) {
    const { useUtc = false, fallback = '00:00' } = options;
    const { hours, minutes } = getTimeParts(value, fallback);

    if (useUtc) {
        date.setUTCHours(hours, minutes, 0, 0);
        return date;
    }

    date.setHours(hours, minutes, 0, 0);
    return date;
}

module.exports = {
    TIME_PATTERN,
    normalizeStoredTime,
    getTimeParts,
    setTimeOnDate
};