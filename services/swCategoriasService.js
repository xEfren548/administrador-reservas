const fs = require('fs');
const path = require('path');
const SWCategoriaFinancieraConfig = require('../models/SWCategoriaFinancieraConfig');
const SWTransaccion = require('../models/SWTransaccion');
const SWSolicitudTransaccion = require('../models/SWSolicitudTransaccion');
const SWSolicitudOrganizacion = require('../models/SWSolicitudOrganizacion');

const CATEGORIAS_FILE_PATH = path.join(__dirname, '..', 'config', 'swCategorias.json');
const CATEGORIAS_CONFIG_CLAVE = 'finanzas';

const CATEGORIAS_POR_DEFECTO = [
    'Otro',
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
    'Reserva',
    'Transferencia'
];

const CATEGORIAS_FIJAS = ['Otro', 'Transferencia'];

function sanitizarCategorias(categorias = []) {
    const categoriasValidas = categorias
        .filter((categoria) => typeof categoria === 'string')
        .map((categoria) => categoria.trim())
        .filter((categoria) => categoria.length > 0);

    const categoriasUnicas = [];
    const mapaNormalizado = new Set();

    categoriasValidas.forEach((categoria) => {
        const llave = categoria.toLowerCase();
        if (!mapaNormalizado.has(llave)) {
            mapaNormalizado.add(llave);
            categoriasUnicas.push(categoria);
        }
    });

    return categoriasUnicas;
}

function asegurarCategoriasFijas(categorias = []) {
    const lista = [...categorias];
    CATEGORIAS_FIJAS.forEach((categoriaFija) => {
        if (!lista.some((cat) => cat.toLowerCase() === categoriaFija.toLowerCase())) {
            lista.push(categoriaFija);
        }
    });
    return lista;
}

function normalizarCategoriasGuardadas(categorias = []) {
    const sanitizadas = sanitizarCategorias(categorias);
    const conFijas = asegurarCategoriasFijas(sanitizadas);

    if (conFijas.length === 0) {
        return [...CATEGORIAS_POR_DEFECTO];
    }

    return conFijas;
}

function leerCategoriasMigracion() {
    try {
        if (!fs.existsSync(CATEGORIAS_FILE_PATH)) {
            return null;
        }

        const fileContent = fs.readFileSync(CATEGORIAS_FILE_PATH, 'utf8');
        const parsed = JSON.parse(fileContent);
        const categorias = Array.isArray(parsed.categorias) ? parsed.categorias : [];

        return normalizarCategoriasGuardadas(categorias);
    } catch (error) {
        console.error('Error al leer categorías financieras para migración inicial:', error);
        return null;
    }
}

async function asegurarCatalogoCategorias() {
    const categoriasIniciales = leerCategoriasMigracion() || [...CATEGORIAS_POR_DEFECTO];

    const config = await SWCategoriaFinancieraConfig.findOneAndUpdate(
        { clave: CATEGORIAS_CONFIG_CLAVE },
        {
            $setOnInsert: {
                clave: CATEGORIAS_CONFIG_CLAVE,
                categorias: categoriasIniciales
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    ).select('categorias').lean();

    return normalizarCategoriasGuardadas(config?.categorias);
}

async function getCategorias() {
    try {
        const config = await SWCategoriaFinancieraConfig.findOne({
            clave: CATEGORIAS_CONFIG_CLAVE
        }).select('categorias').lean();

        if (!config || !Array.isArray(config.categorias) || config.categorias.length === 0) {
            return await asegurarCatalogoCategorias();
        }

        const categoriasNormalizadas = normalizarCategoriasGuardadas(config.categorias);

        if (JSON.stringify(categoriasNormalizadas) !== JSON.stringify(config.categorias)) {
            await SWCategoriaFinancieraConfig.updateOne(
                { clave: CATEGORIAS_CONFIG_CLAVE },
                { $set: { categorias: categoriasNormalizadas } }
            );
        }

        return categoriasNormalizadas;
    } catch (error) {
        console.error('Error al leer catálogo de categorías SW:', error);
        return [...CATEGORIAS_POR_DEFECTO];
    }
}

async function saveCategorias(categorias = []) {
    const categoriasFinales = normalizarCategoriasGuardadas(categorias);

    const config = await SWCategoriaFinancieraConfig.findOneAndUpdate(
        { clave: CATEGORIAS_CONFIG_CLAVE },
        {
            $set: {
                categorias: categoriasFinales
            },
            $setOnInsert: {
                clave: CATEGORIAS_CONFIG_CLAVE
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    ).select('categorias').lean();

    return normalizarCategoriasGuardadas(config?.categorias);
}

async function isCategoriaValida(categoria) {
    if (typeof categoria !== 'string' || !categoria.trim()) {
        return false;
    }

    const categoriaNormalizada = categoria.trim().toLowerCase();
    const categorias = await getCategorias();

    return categorias.some((cat) => cat.toLowerCase() === categoriaNormalizada);
}

/**
 * Devuelve la categoría tal como está en el catálogo, o null si no existe
 * o es 'Transferencia' (la asigna el sistema, no se elige a mano).
 */
async function resolverCategoriaEditable(categoria) {
    if (typeof categoria !== 'string' || !categoria.trim()) return null;
    const llave = categoria.trim().toLowerCase();
    if (llave === 'transferencia') return null;
    const categorias = await getCategorias();
    return categorias.find((cat) => cat.toLowerCase() === llave) || null;
}

/**
 * Cambia la categoría de una transacción y de todas las solicitudes que la generaron,
 * para que solicitud y transacción nunca difieran.
 * ponytail: updateOne/updateMany saltan a propósito los pre('save') que bloquean registros
 *           aprobados; la categoría es el único campo que se abre así.
 */
async function aplicarCategoria({ transaccionId, categoria }) {
    await Promise.all([
        SWTransaccion.updateOne({ _id: transaccionId, tipo: { $ne: 'Transferencia' } }, { categoria, updatedAt: Date.now() }),
        SWSolicitudTransaccion.updateMany({ transaccionCreada: transaccionId }, { categoria, updatedAt: Date.now() }),
        SWSolicitudOrganizacion.updateMany({ transaccionCreada: transaccionId }, { categoria, updatedAt: Date.now() })
    ]);
}

module.exports = {
    resolverCategoriaEditable,
    aplicarCategoria,
    CATEGORIAS_POR_DEFECTO,
    CATEGORIAS_FIJAS,
    getCategorias,
    saveCategorias,
    isCategoriaValida
};
