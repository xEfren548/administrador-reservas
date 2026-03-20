const Usuario = require('../models/Usuario');
const logController = require('../controllers/logController');
const {
    CATEGORIAS_FIJAS,
    getCategorias,
    saveCategorias
} = require('../services/swCategoriasService');

async function getUsuarioAdministrador(userId) {
    const usuario = await Usuario.findById(userId).select('privilege firstName lastName email');

    if (!usuario || usuario.privilege !== 'Administrador') {
        return null;
    }

    return usuario;
}

const getCategoriasFinancieras = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            data: {
                categorias: getCategorias(),
                categoriasFijas: CATEGORIAS_FIJAS
            }
        });
    } catch (error) {
        console.error('Error al obtener categorías financieras:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener categorías financieras',
            error: error.message
        });
    }
};

const updateCategoriasFinancieras = async (req, res) => {
    try {
        const userId = req.session.userId;
        const usuarioAdministrador = await getUsuarioAdministrador(userId);

        if (!usuarioAdministrador) {
            return res.status(403).json({
                success: false,
                message: 'Solo usuarios con privilegio Administrador pueden modificar categorías'
            });
        }

        const { categorias } = req.body;

        if (!Array.isArray(categorias)) {
            return res.status(400).json({
                success: false,
                message: 'El campo "categorias" debe ser un arreglo de textos'
            });
        }

        const categoriasAntes = getCategorias();
        const categoriasActualizadas = saveCategorias(categorias);
        const huboCambios = JSON.stringify(categoriasAntes) !== JSON.stringify(categoriasActualizadas);

        if (huboCambios) {
            const nombreUsuario = `${usuarioAdministrador.firstName || ''} ${usuarioAdministrador.lastName || ''}`.trim() || usuarioAdministrador.email || 'Administrador';

            await logController.createBackendLog({
                fecha: Date.now(),
                idUsuario: userId || req.session.id,
                type: 'modification',
                acciones: `Categorías financieras actualizadas por ${nombreUsuario}. Antes: [${categoriasAntes.join(', ')}]. Después: [${categoriasActualizadas.join(', ')}]`,
                nombreUsuario
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Categorías actualizadas exitosamente',
            data: {
                categorias: categoriasActualizadas,
                categoriasFijas: CATEGORIAS_FIJAS
            }
        });
    } catch (error) {
        console.error('Error al actualizar categorías financieras:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al actualizar categorías financieras',
            error: error.message
        });
    }
};

module.exports = {
    getCategoriasFinancieras,
    updateCategoriasFinancieras
};
