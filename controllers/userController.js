const Usuario = require('../models/Usuario');
const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');

async function obtenerUsuarios(req, res) { 
    try {
        const usuarios = await Usuario.find();
        res.send(usuarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
}

async function obtenerUsuarioPorId(id) {
    try {
        const usuariosExistentes = await Usuario.findOne(); // Buscar el documento que contiene los usuarios
        
        if (!usuariosExistentes) {
            throw new Error('No se encontraron usuarios');
        }

        // Buscar el usuario por su id
        const usuario = usuariosExistentes.events.find(usuario => usuario.uuid === id);

        if (!usuario) {
            throw new Error('El usuario no fue encontrado');
        }



        return usuario;
    } catch (error) {
        throw new Error('Error al obtener el usuario por id: ' + error.message);
    }
}

async function agregarUsuario(req, res) {
    try {
        const uuid = nanoid();
        const { firstName, lastName, email, password, privilege, administrator} = req.body;
        const nuevoUsuario = new Usuario ({
            uuid,
            firstName,
            lastName,
            email,
            password,
            privilege,
            administrator
        });

        // Encuentra el documento existente
        const usuarioGuardado = await nuevoUsuario.save();
        res.status(201).json(usuarioGuardado);


    } catch (error) {
        console.error('Error al agregar usuario:', error);
        res.status(500).send('Error interno del servidor');
    }
}


async function editarUsuario(req, res) {
    try {
        const id = req.params.uuid;
        const { firstName, lastName, email, password, privilege, administrator } = req.body;

        // Buscar el usuario por su UUID
        const usuarioExistente = await Usuario.findOne({ uuid: id });

        if (!usuarioExistente) {
            return res.status(404).json({ mensaje: 'El usuario no fue encontrado' });
        }

        // Actualizar solo los campos proporcionados
        if (firstName !== undefined) {
            usuarioExistente.firstName = firstName;
        }

        if (lastName !== undefined) {
            usuarioExistente.lastName = lastName;
        }

        if (email !== undefined) {
            usuarioExistente.email = email;
        }

        if (password !== undefined) {
            usuarioExistente.password = password;
        }

        if (privilege !== undefined) {
            usuarioExistente.privilege = privilege;
        }

        if (administrator !== undefined) {
            usuarioExistente.administrator = administrator;
        }

        // Guardar el usuario actualizado en la base de datos
        await usuarioExistente.save();

        console.log('Usuario editado:', usuarioExistente);
        res.status(200).json({ mensaje: 'Usuario editado correctamente', usuario: usuarioExistente });
    } catch (error) {
        console.error('Error al editar usuario:', error);
        res.status(500).json({ error });
    }
}

async function eliminarUsuario(req, res) {
    try {
        const id = req.params.uuid;

        // Buscar el usuario por su UUID y eliminarlo
        const resultado = await Usuario.deleteOne({ uuid: id });

        if (resultado.deletedCount === 0) {
            return res.status(404).json({ mensaje: 'El usuario no fue encontrado' });
        }

        res.status(200).json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error });
    }
}




module.exports = {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    agregarUsuario,
    editarUsuario,
    eliminarUsuario
}