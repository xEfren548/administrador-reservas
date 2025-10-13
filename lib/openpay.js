// lib/openpay.js
const Openpay = require('openpay');

const merchantId = process.env.DEV_OPENPAY_ID;
const privateKey = process.env.DEV_OPENPAY_PRIVATE_KEY;
const url = (process.env.DEV_OPENPAY_URL || '').toLowerCase();

// Modo producción si NO es sandbox
const isProduction = !(url.includes('sandbox') || process.env.NODE_ENV !== 'production');

// Instancias válidas: new Openpay(merchant, private, [isProduction])  |  new Openpay(merchant, private, 'mx', isProduction)
const openpay = new Openpay(merchantId, privateKey, isProduction);
// Timeout opcional
openpay.setTimeout(30000);

module.exports = openpay;
