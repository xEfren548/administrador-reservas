const fs = require('fs');
const path = require('path');

const CATEGORIAS_FILE_PATH = path.join(__dirname, '..', 'config', 'swCategorias.json');

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

function getCategorias() {
    try {
        if (!fs.existsSync(CATEGORIAS_FILE_PATH)) {
            return [...CATEGORIAS_POR_DEFECTO];
        }

        const fileContent = fs.readFileSync(CATEGORIAS_FILE_PATH, 'utf8');
        const parsed = JSON.parse(fileContent);
        const categorias = Array.isArray(parsed.categorias) ? parsed.categorias : [];

        const sanitizadas = sanitizarCategorias(categorias);
        const conFijas = asegurarCategoriasFijas(sanitizadas);

        if (conFijas.length === 0) {
            return [...CATEGORIAS_POR_DEFECTO];
        }

        return conFijas;
    } catch (error) {
        console.error('Error al leer catálogo de categorías SW:', error);
        return [...CATEGORIAS_POR_DEFECTO];
    }
}

function saveCategorias(categorias = []) {
    const sanitizadas = sanitizarCategorias(categorias);
    const conFijas = asegurarCategoriasFijas(sanitizadas);

    const payload = {
        categorias: conFijas
    };

    fs.writeFileSync(CATEGORIAS_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');

    return conFijas;
}

function isCategoriaValida(categoria) {
    if (typeof categoria !== 'string' || !categoria.trim()) {
        return false;
    }

    const categoriaNormalizada = categoria.trim().toLowerCase();
    return getCategorias().some((cat) => cat.toLowerCase() === categoriaNormalizada);
}

module.exports = {
    CATEGORIAS_POR_DEFECTO,
    CATEGORIAS_FIJAS,
    getCategorias,
    saveCategorias,
    isCategoriaValida
};
