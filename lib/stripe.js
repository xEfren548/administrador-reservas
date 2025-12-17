// lib/stripe.js
const Stripe = require('stripe');

const isProduction = process.env.NODE_ENV === 'production';

// Usar la clave secreta según el ambiente
const secretKey = isProduction 
    // ? process.env.STRIPE_SECRET_KEY 
    ? process.env.STRIPE_SECRET_KEY_ISRA
    : process.env.DEV_STRIPE_SECRET_KEY;

if (!secretKey) {
    console.warn('⚠️ STRIPE_SECRET_KEY no está configurado');
}

const stripe = Stripe(secretKey, {
    apiVersion: '2023-10-16', // Usar versión estable de la API
    timeout: 30000
});

module.exports = stripe;
