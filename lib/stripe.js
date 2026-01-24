// lib/stripe.js
const Stripe = require('stripe');

const isProduction = process.env.NODE_ENV === 'production';

// Configuración de múltiples cuentas Stripe
const stripeAccounts = {
    ISRA: process.env.STRIPE_SECRET_KEY_ISRA,
    FERNANDO: process.env.STRIPE_SECRET_KEY_FERNANDO,
    CARLOS: process.env.STRIPE_SECRET_KEY_CARLOS
};

// Crear instancias de Stripe para cada cuenta
const stripeInstances = {};
const stripeConfig = {
    apiVersion: '2023-10-16',
    timeout: 30000
};

Object.keys(stripeAccounts).forEach(accountKey => {
    const secretKey = stripeAccounts[accountKey];
    if (secretKey) {
        stripeInstances[accountKey] = Stripe(secretKey, stripeConfig);
    } else {
        console.warn(`⚠️ STRIPE_SECRET_KEY_${accountKey} no está configurado`);
    }
});

// Instancia por defecto (ISRA)
const defaultStripe = stripeInstances.ISRA;

if (!defaultStripe) {
    console.warn('⚠️ No hay cuenta Stripe por defecto configurada');
}

/**
 * Obtiene la instancia de Stripe según la referencia de cuenta
 * @param {string} accountRef - Referencia a la cuenta ('ISRA', 'FERNANDO', 'CARLOS')
 * @returns {Stripe} Instancia de Stripe
 */
function getStripeInstance(accountRef = 'ISRA') {
    return stripeInstances[accountRef] || defaultStripe;
}

/**
 * Obtiene la publishable key según la cuenta
 * @param {string} accountRef - Referencia a la cuenta
 * @returns {string} Publishable key
 */
function getPublishableKey(accountRef = 'ISRA') {
    const envVar = isProduction 
        ? `STRIPE_PUBLISHABLE_KEY_${accountRef}`
        : 'DEV_STRIPE_PUBLISHABLE_KEY';
    
    return process.env[envVar] || process.env.STRIPE_PUBLISHABLE_KEY;
}

// Exportar instancia por defecto y funciones helper
module.exports = defaultStripe;
module.exports.getStripeInstance = getStripeInstance;
module.exports.getPublishableKey = getPublishableKey;
module.exports.availableAccounts = Object.keys(stripeInstances);
