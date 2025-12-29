// Estado global
let organizaciones = [];
let cuentas = [];
let transacciones = [];
let solicitudes = [];
let cuentaSeleccionada = null;
let usuarios = []; // Lista de usuarios disponibles
let participantes = []; // Lista de participantes de la cuenta actual
let participantesOrganizacion = []; // Lista temporal de participantes para nueva organización
let organizacionSeleccionada = null; // Organización seleccionada para gestionar participantes

// Funciones de spinner global
function mostrarSpinner() {
    const spinner = document.getElementById('globalSpinner');
    if (spinner) {
        spinner.classList.remove('hidden');
        spinner.classList.add('block');
    }
}

function ocultarSpinner() {
    const spinner = document.getElementById('globalSpinner');
    if (spinner) {
        spinner.classList.add('hidden');
        spinner.classList.remove('block');
    }
}

// Inicialización
$(document).ready(function() {
    inicializarEventos();
    cargarOrganizaciones();
    cargarMisCuentas();
});

// ===== NAVEGACIÓN ENTRE TABS =====
function inicializarEventos() {
    // Navegación de tabs
    $('.tab-button').on('click', function() {
        const tab = $(this).data('tab');
        cambiarTab(tab);
    });

    // Botones de acción
    $('#btnGuardarOrganizacion').on('click', guardarOrganizacion);
    $('#btnGuardarCuenta').on('click', guardarCuenta);
    $('#btnGuardarSolicitud').on('click', guardarSolicitud);
    $('#btnGuardarParticipante').on('click', guardarParticipante);
    $('#btnGuardarTransaccion').on('click', guardarTransaccion);

    // Eventos para participantes de organización
    $('#btnAgregarParticipanteOrg').on('click', agregarParticipanteOrganizacionTemporal);
    $('#btnAgregarParticipanteOrgGestion').on('click', agregarParticipanteOrganizacion);

    // Listener para cuando se abre el modal de organización
    $('#modalOrganizacion').on('show.bs.modal', function(e) {
        if ($(e.relatedTarget).attr('id') === 'btn-nueva-organizacion') {
            $('#formOrganizacion')[0].reset();
            $('#organizacion-id').val('');
            $('#modalOrganizacionTitle').text('Nueva Organización');
            participantesOrganizacion = []; // Resetear lista temporal
            $('#organizacion-participantes-section').show();
            $('#lista-participantes-org').empty();
            cargarUsuariosParaOrganizacion();
        } else {
            // Si se está editando, ocultar la sección de participantes
            $('#organizacion-participantes-section').hide();
        }
    });

    // Listener para cuando se abre el modal de cuenta
    $('#modalCuenta').on('show.bs.modal', function(e) {
        // Si se abre desde el botón "Nueva Cuenta", resetear el formulario
        if ($(e.relatedTarget).attr('id') === 'btn-nueva-cuenta') {
            $('#formCuenta')[0].reset();
            $('#cuenta-id').val('');
            $('#cuenta-saldo-inicial').prop('readonly', false).css({
                'background-color': '',
                'color': '',
                'cursor': ''
            });
            $('#modalCuentaTitle').text('Nueva Cuenta');
        }
    });

    // Listener para cuando se abre el modal de solicitud
    $('#modalSolicitud').on('show.bs.modal', function(e) {
        if ($(e.relatedTarget).attr('id') === 'btn-nueva-solicitud') {
            $('#formSolicitud')[0].reset();
            $('#solicitud-fecha').val(new Date().toISOString().split('T')[0]);
            cargarCuentasParaSolicitudes();
        }
    });

    // Establecer fecha actual en el input de solicitud
    $('#solicitud-fecha').val(new Date().toISOString().split('T')[0]);
}

function cambiarTab(tabName) {
    // Actualizar botones
    $('.tab-button').removeClass('active border-blue-500 text-teal-600')
        .addClass('border-transparent text-gray-500');
    $(`.tab-button[data-tab="${tabName}"]`)
        .addClass('active border-blue-500 text-teal-600')
        .removeClass('border-transparent text-gray-500');

    // Actualizar contenido
    $('.tab-content').removeClass('active').addClass('hidden');
    $(`#tab-${tabName}`).addClass('active').removeClass('hidden');

    // Cargar datos según el tab
    switch(tabName) {
        case 'organizaciones':
            cargarOrganizaciones();
            break;
        case 'cuentas':
            cargarMisCuentas();
            break;
        case 'transacciones':
            cargarTransacciones();
            break;
        case 'solicitudes':
            cargarSolicitudes();
            break;
    }
}

// ===== ORGANIZACIONES =====
async function cargarOrganizaciones() {
    try {
        mostrarSpinner();
        const response = await fetch('/api/sw/organizaciones');
        const data = await response.json();
        
        if (data.success) {
            organizaciones = data.data;
            renderizarOrganizaciones();
            actualizarSelectOrganizaciones();
        }
    } catch (error) {
        console.error('Error al cargar organizaciones:', error);
        mostrarError('Error al cargar organizaciones');
    } finally {
        ocultarSpinner();
    }
}

function renderizarOrganizaciones() {
    const tbody = $('#tabla-organizaciones-body');
    tbody.empty();

    if (organizaciones.length === 0) {
        tbody.html(`
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    No hay organizaciones creadas o no eres participante de ninguna
                </td>
            </tr>
        `);
        return;
    }

    organizaciones.forEach(org => {
        const fecha = new Date(org.createdAt).toLocaleDateString('es-MX');
        const estado = org.activa ? 
            '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-300">Activa</span>' :
            '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-900 text-red-300">Inactiva</span>';

        // Obtener información de participantes
        const totalParticipantes = org.participantes?.length || 0;
        const miParticipacion = org.participantes?.find(p => p.usuario._id === window.currentUserId);
        const esAdmin = miParticipacion?.rol === 'Administrador';

        // Botones de acción según permisos
        let botones = `
            <button onclick="verCuentasOrganizacion('${org._id}')" class="btn btn-sm btn-info me-1" title="Ver cuentas">
                <i class="fas fa-eye"></i>
            </button>
            <button onclick="verParticipantesOrganizacion('${org._id}')" class="btn btn-sm btn-success me-1" title="Ver participantes">
                <i class="fas fa-users"></i>
            </button>
        `;
        
        // Solo MASTER ADMIN o Administradores de la organización pueden editar
        if (window.isMasterAdmin || esAdmin) {
            botones += `
                <button onclick="editarOrganizacion('${org._id}')" class="btn btn-sm btn-warning me-1" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
            `;
        }

        // Solo MASTER ADMIN puede activar/desactivar
        if (window.isMasterAdmin) {
            botones += `
                <button onclick="toggleOrganizacion('${org._id}', ${org.activa})" class="btn btn-sm btn-${org.activa ? 'danger' : 'success'}" title="${org.activa ? 'Desactivar' : 'Activar'}">
                    <i class="fas fa-${org.activa ? 'ban' : 'check'}"></i>
                </button>
            `;
        }

        tbody.append(`
            <tr class="border-b border-gray-200 hover:bg-gray-100">
                <td class="px-6 py-4 font-medium text-gray-900">${org.nombre}</td>
                <td class="px-6 py-4">${org.descripcion || '-'}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-300">
                        <i class="fas fa-users me-1"></i>${totalParticipantes}
                    </span>
                    ${esAdmin ? '<span class="ms-1 px-2 py-1 text-xs font-semibold rounded-full bg-purple-900 text-purple-300">Admin</span>' : ''}
                </td>
                <td class="px-6 py-4">${estado}</td>
                <td class="px-6 py-4">${fecha}</td>
                <td class="px-6 py-4 text-center">
                    ${botones}
                </td>
            </tr>
        `);
    });
}

function actualizarSelectOrganizaciones() {
    const select = $('#cuenta-organizacion');
    select.empty().append('<option value="">Seleccione...</option>');
    
    organizaciones.filter(org => org.activa).forEach(org => {
        select.append(`<option value="${org._id}">${org.nombre}</option>`);
    });
}

async function guardarOrganizacion() {
    const id = $('#organizacion-id').val();
    const nombre = $('#organizacion-nombre').val().trim();
    const descripcion = $('#organizacion-descripcion').val().trim();

    if (!nombre) {
        mostrarError('El nombre es requerido');
        return;
    }

    const datos = { nombre, descripcion };

    // Solo incluir participantes al crear (no al editar)
    if (!id && participantesOrganizacion.length > 0) {
        datos.participantes = participantesOrganizacion;
    }

    try {
        const url = id ? `/api/sw/organizaciones/${id}` : '/api/sw/organizaciones';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const data = await response.json();

        if (data.success) {
            mostrarExito(id ? 'Organización actualizada' : 'Organización creada');
            $('#modalOrganizacion').modal('hide');
            $('#formOrganizacion')[0].reset();
            participantesOrganizacion = [];
            cargarOrganizaciones();
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al guardar organización');
    }
}

function editarOrganizacion(id) {
    const org = organizaciones.find(o => o._id === id);
    if (!org) return;

    $('#organizacion-id').val(org._id);
    $('#organizacion-nombre').val(org.nombre);
    $('#organizacion-descripcion').val(org.descripcion || '');
    $('#modalOrganizacionTitle').text('Editar Organización');
    $('#modalOrganizacion').modal('show');
}

async function toggleOrganizacion(id, activa) {
    const accion = activa ? 'desactivar' : 'activar';
    
    if (!confirm(`¿Está seguro de ${accion} esta organización?`)) return;

    try {
        const response = await fetch(`/api/sw/organizaciones/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activa: !activa })
        });

        const data = await response.json();

        if (data.success) {
            mostrarExito(`Organización ${accion === 'activar' ? 'activada' : 'desactivada'}`);
            cargarOrganizaciones();
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al actualizar organización');
    }
}

// Cargar usuarios disponibles para agregar a organizaciones
async function cargarUsuariosParaOrganizacion() {
    try {
        const response = await fetch('/api/usuarios/all');
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            usuarios = data.data;
            actualizarSelectUsuariosOrganizacion();
        } else {
            console.error('Error en la respuesta:', data.message);
            mostrarError('Error al cargar usuarios');
        }
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        mostrarError('Error al cargar la lista de usuarios');
    }
}

function actualizarSelectUsuariosOrganizacion() {
    const select1 = $('#organizacion-nuevo-participante');
    const select2 = $('#nuevo-participante-org-select');
    
    select1.empty().append('<option value="">Seleccione un usuario...</option>');
    select2.empty().append('<option value="">Seleccione un usuario...</option>');
    
    // Filtrar usuarios que ya son participantes temporales o el usuario actual
    const participantesIds = participantesOrganizacion.map(p => p.usuario);
    const usuariosDisponibles = usuarios.filter(u => 
        u._id !== window.currentUserId && !participantesIds.includes(u._id)
    );
    
    usuariosDisponibles.forEach(usuario => {
        const nombreCompleto = `${usuario.firstName} ${usuario.lastName} (${usuario.email})`;
        const option = `<option value="${usuario._id}">${nombreCompleto}</option>`;
        select1.append(option);
        select2.append(option);
    });
}

// Agregar participante temporal al crear organización
function agregarParticipanteOrganizacionTemporal() {
    const usuarioId = $('#organizacion-nuevo-participante').val();
    const rol = $('#organizacion-rol-participante').val();
    
    if (!usuarioId) {
        mostrarError('Seleccione un usuario');
        return;
    }
    
    const usuario = usuarios.find(u => u._id === usuarioId);
    if (!usuario) return;
    
    // Agregar a la lista temporal
    participantesOrganizacion.push({
        usuario: usuarioId,
        rol: rol
    });
    
    // Actualizar vista
    renderizarParticipantesOrganizacionTemporales();
    actualizarSelectUsuariosOrganizacion();
    
    // Limpiar selección
    $('#organizacion-nuevo-participante').val('');
}

function renderizarParticipantesOrganizacionTemporales() {
    const container = $('#lista-participantes-org');
    container.empty();
    
    if (participantesOrganizacion.length === 0) {
        container.html('<p class="text-gray-500 text-sm">No hay participantes agregados</p>');
        return;
    }
    
    participantesOrganizacion.forEach((participante, index) => {
        const usuario = usuarios.find(u => u._id === participante.usuario);
        if (!usuario) return;
        
        const nombreCompleto = `${usuario.firstName} ${usuario.lastName}`;
        const rolBadge = participante.rol === 'Administrador' 
            ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-900 text-purple-300">Administrador</span>'
            : '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-300">Miembro</span>';
        
        container.append(`
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded mb-2">
                <div>
                    <span class="font-semibold text-gray-900">${nombreCompleto}</span>
                    <span class="text-gray-500 text-sm ms-2">${usuario.email}</span>
                    <span class="ms-2">${rolBadge}</span>
                </div>
                <button type="button" class="btn btn-sm btn-danger" onclick="eliminarParticipanteOrganizacionTemporal(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `);
    });
}

function eliminarParticipanteOrganizacionTemporal(index) {
    participantesOrganizacion.splice(index, 1);
    renderizarParticipantesOrganizacionTemporales();
    actualizarSelectUsuariosOrganizacion();
}

// Ver y gestionar participantes de una organización existente
async function verParticipantesOrganizacion(id) {
    try {
        mostrarSpinner();
        
        organizacionSeleccionada = organizaciones.find(o => o._id === id);
        if (!organizacionSeleccionada) {
            mostrarError('Organización no encontrada');
            return;
        }
        
        // Cargar usuarios disponibles
        await cargarUsuariosParaOrganizacion();
        
        $('#participantes-org-id').val(id);
        renderizarParticipantesOrganizacionGestion();
        
        // Actualizar select con usuarios que no son participantes
        const participantesIds = organizacionSeleccionada.participantes?.map(p => p.usuario._id) || [];
        const select = $('#nuevo-participante-org-select');
        select.empty().append('<option value="">Seleccione un usuario...</option>');
        
        usuarios.filter(u => !participantesIds.includes(u._id)).forEach(usuario => {
            const nombreCompleto = `${usuario.firstName} ${usuario.lastName} (${usuario.email})`;
            select.append(`<option value="${usuario._id}">${nombreCompleto}</option>`);
        });
        
        $('#modalParticipantesOrganizacion').modal('show');
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar participantes');
    } finally {
        ocultarSpinner();
    }
}

function renderizarParticipantesOrganizacionGestion() {
    const container = $('#lista-participantes-org-gestion');
    container.empty();
    
    if (!organizacionSeleccionada || !organizacionSeleccionada.participantes || organizacionSeleccionada.participantes.length === 0) {
        container.html('<p class="text-gray-500 text-sm">No hay participantes</p>');
        return;
    }
    
    const miParticipacion = organizacionSeleccionada.participantes.find(p => p.usuario._id === window.currentUserId);
    const soyAdmin = miParticipacion?.rol === 'Administrador';
    const esCreador = organizacionSeleccionada.createdBy._id === window.currentUserId;
    
    organizacionSeleccionada.participantes.forEach(participante => {
        const usuario = participante.usuario;
        const nombreCompleto = `${usuario.firstName} ${usuario.lastName}`;
        const esCreadorDeOrg = organizacionSeleccionada.createdBy._id === usuario._id;
        
        const rolBadge = participante.rol === 'Administrador' 
            ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-900 text-purple-300">Administrador</span>'
            : '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-300">Miembro</span>';
        
        let acciones = '';
        
        // Solo administradores pueden modificar participantes
        if (soyAdmin && !esCreadorDeOrg) {
            acciones = `
                <div class="flex gap-2">
                    ${participante.rol === 'Miembro' ? `
                        <button class="btn btn-sm btn-warning" onclick="cambiarRolParticipanteOrg('${usuario._id}', 'Administrador')" title="Promover a Administrador">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-secondary" onclick="cambiarRolParticipanteOrg('${usuario._id}', 'Miembro')" title="Degradar a Miembro">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                    `}
                    <button class="btn btn-sm btn-danger" onclick="eliminarParticipanteOrg('${usuario._id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        } else if (esCreadorDeOrg) {
            acciones = '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-900 text-yellow-300">Creador</span>';
        }
        
        container.append(`
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 mb-2">
                <div>
                    <div class="font-semibold text-gray-900">${nombreCompleto}</div>
                    <div class="text-gray-500 text-sm">${usuario.email}</div>
                    <div class="mt-1">${rolBadge}</div>
                </div>
                <div>
                    ${acciones}
                </div>
            </div>
        `);
    });
}

// Agregar participante a organización existente
async function agregarParticipanteOrganizacion() {
    const organizacionId = $('#participantes-org-id').val();
    const usuarioId = $('#nuevo-participante-org-select').val();
    const rol = $('#nuevo-participante-org-rol').val();
    
    if (!usuarioId) {
        mostrarError('Seleccione un usuario');
        return;
    }
    
    try {
        const response = await fetch(`/api/sw/organizaciones/${organizacionId}/participantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuarioId, rol })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarExito('Participante agregado exitosamente');
            // Actualizar organización en la lista
            const index = organizaciones.findIndex(o => o._id === organizacionId);
            if (index !== -1) {
                organizaciones[index] = data.data;
                organizacionSeleccionada = data.data;
            }
            renderizarParticipantesOrganizacionGestion();
            renderizarOrganizaciones();
            
            // Limpiar selección
            $('#nuevo-participante-org-select').val('');
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al agregar participante');
    }
}

// Eliminar participante de organización
async function eliminarParticipanteOrg(usuarioId) {
    if (!confirm('¿Está seguro de eliminar este participante?')) return;
    
    const organizacionId = $('#participantes-org-id').val();
    
    try {
        const response = await fetch(`/api/sw/organizaciones/${organizacionId}/participantes/${usuarioId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarExito('Participante eliminado exitosamente');
            // Actualizar organización en la lista
            const index = organizaciones.findIndex(o => o._id === organizacionId);
            if (index !== -1) {
                organizaciones[index] = data.data;
                organizacionSeleccionada = data.data;
            }
            renderizarParticipantesOrganizacionGestion();
            renderizarOrganizaciones();
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al eliminar participante');
    }
}

// Cambiar rol de participante
async function cambiarRolParticipanteOrg(usuarioId, nuevoRol) {
    const organizacionId = $('#participantes-org-id').val();
    
    try {
        const response = await fetch(`/api/sw/organizaciones/${organizacionId}/participantes/${usuarioId}/rol`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rol: nuevoRol })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarExito('Rol actualizado exitosamente');
            // Actualizar organización en la lista
            const index = organizaciones.findIndex(o => o._id === organizacionId);
            if (index !== -1) {
                organizaciones[index] = data.data;
                organizacionSeleccionada = data.data;
            }
            renderizarParticipantesOrganizacionGestion();
            renderizarOrganizaciones();
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al actualizar rol');
    }
}

// Ver detalles de una organización
async function verCuentasOrganizacion(organizacionId) {
    try {
        mostrarSpinner();
        
        const response = await fetch(`/api/sw/organizaciones/${organizacionId}`);
        const data = await response.json();
        
        if (data.success) {
            const org = data.data;
            const participantes = org.participantes || [];
            const participantesHTML = participantes.map(p => {
                const rolBadge = p.rol === 'Administrador' 
                    ? '<span class="badge bg-purple-600">Administrador</span>'
                    : '<span class="badge bg-blue-600">Miembro</span>';
                return `
                    <div class="d-flex justify-content-between align-items-center p-2 bg-gray-50 rounded mb-2">
                        <div>
                            <strong>${p.usuario.firstName} ${p.usuario.lastName}</strong>
                            <br><small class="text-muted">${p.usuario.email}</small>
                        </div>
                        <div>${rolBadge}</div>
                    </div>
                `;
            }).join('');
            
            Swal.fire({
                title: `<i class="fas fa-building me-2"></i>${org.nombre}`,
                html: `
                    <div class="text-start">
                        <div class="mb-3">
                            <h6 class="text-muted">Descripción</h6>
                            <p>${org.descripcion || 'Sin descripción'}</p>
                        </div>
                        
                        <div class="mb-3">
                            <h6 class="text-muted">Estado</h6>
                            <span class="badge ${org.activa ? 'bg-success' : 'bg-danger'}">
                                ${org.activa ? 'Activa' : 'Inactiva'}
                            </span>
                        </div>
                        
                        <div class="mb-3">
                            <h6 class="text-muted">Estadísticas</h6>
                            <div class="row">
                                <div class="col-6">
                                    <div class="p-2 bg-light rounded text-center">
                                        <div class="fs-4 fw-bold text-primary">${org.stats?.totalCuentas || 0}</div>
                                        <small class="text-muted">Cuentas Totales</small>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="p-2 bg-light rounded text-center">
                                        <div class="fs-4 fw-bold text-success">${org.stats?.cuentasActivas || 0}</div>
                                        <small class="text-muted">Cuentas Activas</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <h6 class="text-muted">Participantes (${participantes.length})</h6>
                            <div style="max-height: 200px; overflow-y: auto;">
                                ${participantesHTML || '<p class="text-muted">No hay participantes</p>'}
                            </div>
                        </div>
                        
                        <div>
                            <small class="text-muted">
                                <i class="fas fa-calendar me-1"></i>
                                Creada el ${new Date(org.createdAt).toLocaleDateString('es-MX', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}
                            </small>
                        </div>
                    </div>
                `,
                width: '600px',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#3b82f6'
            });
        } else {
            mostrarError(data.message || 'Error al cargar detalles de la organización');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar detalles de la organización');
    } finally {
        ocultarSpinner();
    }
}

// ===== CUENTAS =====
async function cargarMisCuentas() {
    try {
        mostrarSpinner();
        const response = await fetch('/api/sw/cuentas/mis-cuentas');
        const data = await response.json();
        
        if (data.success) {
            cuentas = data.data.map(cuenta => ({
                ...cuenta,
                propietario: cuenta.propietario?._id || cuenta.propietario
            }));
            renderizarCuentas();
            actualizarSelectCuentas();
        }
    } catch (error) {
        console.error('Error al cargar cuentas:', error);
        mostrarError('Error al cargar cuentas');
    } finally {
        ocultarSpinner();
    }
}

function renderizarCuentas() {
    const grid = $('#cuentas-grid');
    grid.empty();

    if (cuentas.length === 0) {
        grid.html(`
            <div class="col-span-full text-center py-12 text-gray-500">
                <i class="fas fa-wallet text-6xl mb-4 opacity-50"></i>
                <p>No tienes cuentas creadas</p>
                <button class="btn btn-success btn-sm mt-3" data-bs-toggle="modal" data-bs-target="#modalCuenta">
                    <i class="fas fa-plus me-1"></i> Crear Primera Cuenta
                </button>
            </div>
        `);
        return;
    }

    // Agrupar cuentas por organización
    const cuentasPorOrg = {};
    cuentas.forEach(cuenta => {
        const orgId = cuenta.organizacion?._id || cuenta.organizacion || 'sin-org';
        const orgNombre = cuenta.organizacion?.nombre || 'Sin organización';
        
        if (!cuentasPorOrg[orgId]) {
            cuentasPorOrg[orgId] = {
                nombre: orgNombre,
                cuentas: []
            };
        }
        cuentasPorOrg[orgId].cuentas.push(cuenta);
    });

    // Renderizar por grupos de organización
    Object.keys(cuentasPorOrg).forEach(orgId => {
        const grupo = cuentasPorOrg[orgId];
        
        // Separador de organización
        grid.append(`
            <div class="col-span-full mt-4 mb-3">
                <div class="flex items-center gap-3">
                    <div class="flex-grow border-t border-gray-300"></div>
                    <div class="flex items-center gap-2 px-4 py-2 bg-teal-50 rounded-lg">
                        <i class="fas fa-building text-teal-600"></i>
                        <span class="font-semibold text-gray-800 text-lg">${grupo.nombre}</span>
                        <span class="badge bg-teal-600 text-white">${grupo.cuentas.length}</span>
                    </div>
                    <div class="flex-grow border-t border-gray-300"></div>
                </div>
            </div>
        `);
        
        // Renderizar cuentas del grupo
        grupo.cuentas.forEach(cuenta => {
            const saldo = cuenta.puedeVerSaldo !== false 
                ? formatearMoneda(cuenta.saldoActual || 0, cuenta.moneda)
                : '***';
            const icono = obtenerIconoCuenta(cuenta.tipoCuenta);
            const colorSaldo = cuenta.saldoActual >= 0 ? 'text-green-600' : 'text-red-600';

            grid.append(`
                <div class="bg-white rounded-lg shadow-lg p-6 border border-gray-200 hover:border-teal-500 transition-colors cursor-pointer" onclick="verDetalleCuenta('${cuenta._id}')">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <div class="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                                <i class="fas ${icono} text-teal-600"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900">${cuenta.nombre}</h3>
                                <p class="text-xs text-gray-500">${cuenta.tipoCuenta}</p>
                            </div>
                        </div>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full bg-${cuenta.activa ? 'green' : 'red'}-900 text-${cuenta.activa ? 'green' : 'red'}-300">
                            ${cuenta.activa ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>
                    
                    <div class="border-t border-gray-200 pt-4">
                        <p class="text-sm text-gray-500 mb-1">Saldo Actual</p>
                        ${cuenta.puedeVerSaldo !== false 
                            ? `<p class="text-2xl font-bold ${colorSaldo}">${saldo}</p>`
                            : `<p class="text-2xl font-bold text-gray-500"><i class="fas fa-lock me-2"></i>${saldo}</p>
                               <p class="text-xs text-gray-500 mt-1">No tienes permiso para ver el saldo</p>`
                        }
                    </div>

                    ${cuenta.descripcion ? `
                        <div class="mt-4 pt-4 border-t border-gray-200">
                            <p class="text-sm text-gray-500">${cuenta.descripcion}</p>
                        </div>
                    ` : ''}

                    <div class="mt-4 flex gap-2">
                        ${cuenta.miRol === 'Propietario' ? `
                            <button onclick="event.stopPropagation(); agregarTransaccion('${cuenta._id}')" class="btn btn-sm btn-primary flex-1" ${!cuenta.activa ? 'disabled' : ''}>
                                <i class="fas fa-plus me-1"></i> Transacción
                            </button>
                            <button onclick="event.stopPropagation(); editarCuenta('${cuenta._id}')" class="btn btn-sm btn-warning">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : `
                            <button onclick="event.stopPropagation(); verDetalleCuenta('${cuenta._id}')" class="btn btn-sm btn-info flex-1">
                                <i class="fas fa-eye me-1"></i> Ver Detalle
                            </button>
                        `}
                    </div>
                </div>
            `);
        });
    });
}

function obtenerIconoCuenta(tipo) {
    const iconos = {
        'Bancaria': 'fa-university',
        'Efectivo': 'fa-money-bill-wave',
        'Tarjeta': 'fa-credit-card',
        'Billetera Digital': 'fa-mobile-alt',
        'Otra': 'fa-wallet'
    };
    return iconos[tipo] || 'fa-wallet';
}

function actualizarSelectCuentas() {
    const selectFiltro = $('#filtro-cuenta-transacciones');
    const selectSolicitud = $('#solicitud-cuenta');
    
    selectFiltro.empty().append('<option value="">Todas las cuentas</option>');
    selectSolicitud.empty().append('<option value="">Seleccione...</option>');
    
    cuentas.filter(c => c.activa).forEach(cuenta => {
        const option = `<option value="${cuenta._id}">${cuenta.nombre} (${cuenta.moneda})</option>`;
        selectFiltro.append(option);
        selectSolicitud.append(option);
    });
}

async function guardarCuenta() {
    const id = $('#cuenta-id').val();
    const datos = {
        nombre: $('#cuenta-nombre').val().trim(),
        tipoCuenta: $('#cuenta-tipo').val(),
        moneda: $('#cuenta-moneda').val(),
        descripcion: $('#cuenta-descripcion').val().trim(),
        datosBancarios: {
            beneficiario: $('#cuenta-beneficiario').val().trim(),
            banco: $('#cuenta-banco').val().trim(),
            clabe: $('#cuenta-clabe').val().trim(),
            numeroCuenta: $('#cuenta-numero').val().trim(),
            referencia: $('#cuenta-referencia').val().trim()
        }
    };

    // Solo incluir organización y saldoInicial al crear (no al editar)
    if (!id) {
        datos.organizacion = $('#cuenta-organizacion').val();
        datos.saldoInicial = parseFloat($('#cuenta-saldo-inicial').val()) || 0;
    }

    if (!datos.nombre || (!id && !datos.organizacion)) {
        mostrarError('Nombre y organización son requeridos');
        return;
    }

    try {
        const url = id ? `/api/sw/cuentas/${id}` : '/api/sw/cuentas';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const data = await response.json();

        if (data.success) {
            mostrarExito(id ? 'Cuenta actualizada' : 'Cuenta creada');
            $('#modalCuenta').modal('hide');
            $('#formCuenta')[0].reset();
            cargarMisCuentas();
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al guardar cuenta');
    }
}

function editarCuenta(id) {
    const cuenta = cuentas.find(c => c._id === id);
    if (!cuenta) return;

    $('#cuenta-id').val(cuenta._id);
    $('#cuenta-nombre').val(cuenta.nombre);
    $('#cuenta-tipo').val(cuenta.tipoCuenta);
    $('#cuenta-moneda').val(cuenta.moneda);
    $('#cuenta-saldo-inicial').val(cuenta.saldoInicial).prop('readonly', true).css({
        'background-color': '#ffffff',
        'color': '#9CA3AF',
        'cursor': 'not-allowed'
    });
    $('#cuenta-descripcion').val(cuenta.descripcion || '');

    // Preseleccionar la organización (debe hacerse después de que el select esté poblado)
    const orgId = cuenta.organizacion?._id || cuenta.organizacion;
    $('#cuenta-organizacion').val(orgId);

    // Datos bancarios
    if (cuenta.datosBancarios) {
        $('#cuenta-beneficiario').val(cuenta.datosBancarios.beneficiario || '');
        $('#cuenta-banco').val(cuenta.datosBancarios.banco || '');
        $('#cuenta-clabe').val(cuenta.datosBancarios.clabe || '');
        $('#cuenta-numero').val(cuenta.datosBancarios.numeroCuenta || '');
        $('#cuenta-referencia').val(cuenta.datosBancarios.referencia || '');
    }

    $('#modalCuentaTitle').text('Editar Cuenta');
    $('#modalCuenta').modal('show');
}

async function verDetalleCuenta(id) {
    try {
        mostrarSpinner();
        const response = await fetch(`/api/sw/cuentas/${id}`);
        const data = await response.json();
        
        if (data.success) {
            mostrarDetalleCuenta(data.data);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar detalle de cuenta');
    } finally {
        ocultarSpinner();
    }
}

function mostrarDetalleCuenta(cuenta) {
    const puedeVerSaldo = cuenta.puedeVerSaldo !== false;
    const saldo = puedeVerSaldo 
        ? formatearMoneda(cuenta.saldoActual || 0, cuenta.moneda)
        : '***';
    const colorSaldo = cuenta.saldoActual >= 0 ? 'text-green-600' : 'text-red-600';

    let html = `
        <div class="bg-gray-100 rounded-lg p-6 mb-4">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-2xl font-bold text-gray-900">${cuenta.nombre}</h3>
                ${puedeVerSaldo 
                    ? `<span class="text-3xl font-bold ${colorSaldo}">${saldo}</span>`
                    : `<span class="text-3xl font-bold text-gray-500"><i class="fas fa-lock me-2"></i>${saldo}</span>`
                }
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                    <p class="text-gray-500">Tipo de Cuenta</p>
                    <p class="text-gray-900 font-semibold">${cuenta.tipoCuenta}</p>
                </div>
                <div>
                    <p class="text-gray-500">Moneda</p>
                    <p class="text-gray-900 font-semibold">${cuenta.moneda}</p>
                </div>
                ${puedeVerSaldo ? `
                    <div>
                        <p class="text-gray-500">Saldo Inicial</p>
                        <p class="text-gray-900 font-semibold">${formatearMoneda(cuenta.saldoInicial || 0, cuenta.moneda)}</p>
                    </div>
                ` : `
                    <div>
                        <p class="text-gray-500">Saldo Inicial</p>
                        <p class="text-gray-500"><i class="fas fa-lock me-2"></i>Oculto</p>
                    </div>
                `}
                <div>
                    <p class="text-gray-500">Estado</p>
                    <p class="text-gray-900 font-semibold">${cuenta.activa ? 'Activa' : 'Inactiva'}</p>
                </div>
            </div>
    `;

    // Datos bancarios si existen
    if (cuenta.datosBancarios && (cuenta.datosBancarios.beneficiario || cuenta.datosBancarios.banco)) {
        html += `
            <div class="mt-4 pt-4 border-t border-gray-300">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Datos Bancarios</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    ${cuenta.datosBancarios.beneficiario ? `
                        <div>
                            <p class="text-gray-500">Beneficiario</p>
                            <p class="text-gray-900">${cuenta.datosBancarios.beneficiario}</p>
                        </div>
                    ` : ''}
                    ${cuenta.datosBancarios.banco ? `
                        <div>
                            <p class="text-gray-500">Banco</p>
                            <p class="text-gray-900">${cuenta.datosBancarios.banco}</p>
                        </div>
                    ` : ''}
                    ${cuenta.datosBancarios.clabe ? `
                        <div>
                            <p class="text-gray-500">CLABE</p>
                            <p class="text-gray-900 font-mono">${cuenta.datosBancarios.clabe}</p>
                        </div>
                    ` : ''}
                    ${cuenta.datosBancarios.numeroCuenta ? `
                        <div>
                            <p class="text-gray-500">Número de Cuenta</p>
                            <p class="text-gray-900 font-mono">${cuenta.datosBancarios.numeroCuenta}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    html += `</div>`;

    // Sección de participantes
    html += `
        <div class="bg-gray-100 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
                <h4 class="text-lg font-semibold text-gray-900">Participantes</h4>
                <button class="btn btn-sm btn-primary" onclick="abrirModalParticipantes('${cuenta._id}')">
                    <i class="fas fa-user-plus me-2"></i>Agregar Participante
                </button>
            </div>
            <div id="participantes-lista-${cuenta._id}">
                <p class="text-gray-500 text-sm">Cargando participantes...</p>
            </div>
        </div>
    `;

    $('#detalleCuentaNombre').text(cuenta.nombre);
    $('#detalleCuentaContent').html(html);
    $('#modalDetalleCuenta').modal('show');
    
    // Cargar participantes
    cargarParticipantes(cuenta._id);
}

// ===== SOLICITUDES =====
async function cargarSolicitudes() {
    try {
        mostrarSpinner();
        const response = await fetch('/api/sw/solicitudes/mis-solicitudes');
        const data = await response.json();
        
        if (data.success) {
            solicitudes = data.data;
            renderizarSolicitudes();
        }
    } catch (error) {
        console.error('Error al cargar solicitudes:', error);
        mostrarError('Error al cargar solicitudes');
    } finally {
        ocultarSpinner();
    }
}

function renderizarSolicitudes() {
    const tbody = $('#tabla-solicitudes-body');
    tbody.empty();

    if (solicitudes.length === 0) {
        tbody.html(`
            <tr>
                <td colspan="8" class="px-6 py-4 text-center text-gray-500">
                    No hay solicitudes
                </td>
            </tr>
        `);
        return;
    }

    solicitudes.forEach(sol => {
        const fecha = new Date(sol.fecha).toLocaleDateString('es-MX');
        const monto = formatearMoneda(sol.monto, 'MXN');
        const tipoColor = sol.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-600';
        const estadoBadge = obtenerBadgeEstado(sol.estado);
        const nombreCuenta = sol.cuenta?.nombre || 'N/A';
        
        // Determinar si el usuario actual es propietario de la cuenta
        const propietarioId = sol.propietarioCuenta?._id || sol.propietarioCuenta;
        const esPropietario = propietarioId === window.currentUserId;
        
        // Determinar si es el solicitante
        const solicitanteId = sol.solicitadoPor?._id || sol.solicitadoPor;
        const esSolicitante = solicitanteId === window.currentUserId;

        let botonesAccion = `
            <button onclick="verDetalleSolicitud('${sol._id}')" class="btn btn-sm btn-info" title="Ver detalle">
                <i class="fas fa-eye"></i>
            </button>
        `;

        // Si está pendiente y es propietario, mostrar aprobar/rechazar
        if (sol.estado === 'Pendiente' && esPropietario) {
            botonesAccion += `
                <button onclick="aprobarSolicitud('${sol._id}')" class="btn btn-sm btn-success ms-1" title="Aprobar">
                    <i class="fas fa-check"></i>
                </button>
                <button onclick="rechazarSolicitud('${sol._id}')" class="btn btn-sm btn-danger ms-1" title="Rechazar">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }
        
        // Si está pendiente y es solicitante, mostrar cancelar
        if (sol.estado === 'Pendiente' && esSolicitante && !esPropietario) {
            botonesAccion += `
                <button onclick="cancelarSolicitud('${sol._id}')" class="btn btn-sm btn-warning ms-1" title="Cancelar">
                    <i class="fas fa-ban"></i>
                </button>
            `;
        }

        tbody.append(`
            <tr class="border-b border-gray-200 hover:bg-gray-100">
                <td class="px-6 py-4">${fecha}</td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-teal-100 text-blue-300">
                        <i class="fas fa-wallet me-1"></i>${nombreCuenta}
                    </span>
                </td>
                <td class="px-6 py-4 ${tipoColor}">${sol.tipo}</td>
                <td class="px-6 py-4 font-medium text-gray-900">
                    ${sol.concepto}
                    ${sol.imagenes && sol.imagenes.length > 0 ? `
                        <i class="fas fa-paperclip text-gray-500 ms-2" title="${sol.imagenes.length} imagen(es)"></i>
                    ` : ''}
                </td>
                <td class="px-6 py-4">${sol.solicitadoPor?.firstName || 'N/A'} ${sol.solicitadoPor?.lastName || ''}</td>
                <td class="px-6 py-4 text-right font-semibold ${tipoColor}">${monto}</td>
                <td class="px-6 py-4">${estadoBadge}</td>
                <td class="px-6 py-4 text-center">
                    ${botonesAccion}
                </td>
            </tr>
        `);
    });
}

// Cargar cuentas de organizaciones donde el usuario es participante
async function cargarCuentasParaSolicitudes() {
    try {
        mostrarSpinner();
        const response = await fetch('/api/sw/cuentas/para-solicitudes');
        const data = await response.json();
        
        if (data.success) {
            const select = $('#solicitud-cuenta');
            select.empty().append('<option value="">Seleccione una cuenta...</option>');
            
            // Agrupar por organización
            const cuentasPorOrg = {};
            data.data.forEach(cuenta => {
                const orgNombre = cuenta.organizacion?.nombre || 'Sin organización';
                if (!cuentasPorOrg[orgNombre]) {
                    cuentasPorOrg[orgNombre] = [];
                }
                cuentasPorOrg[orgNombre].push(cuenta);
            });
            
            // Agregar opciones agrupadas
            Object.keys(cuentasPorOrg).sort().forEach(orgNombre => {
                const optgroup = $(`<optgroup label="${orgNombre}"></optgroup>`);
                cuentasPorOrg[orgNombre].forEach(cuenta => {
                    const propietario = `${cuenta.propietario.firstName} ${cuenta.propietario.lastName}`;
                    optgroup.append(`<option value="${cuenta._id}">${cuenta.nombre} (${cuenta.moneda}) - ${propietario}</option>`);
                });
                select.append(optgroup);
            });
        } else {
            mostrarError('Error al cargar cuentas disponibles');
        }
    } catch (error) {
        console.error('Error al cargar cuentas:', error);
        mostrarError('Error al cargar cuentas disponibles');
    } finally {
        ocultarSpinner();
    }
}

async function guardarSolicitud() {
    const datos = {
        cuentaId: $('#solicitud-cuenta').val(),
        tipo: $('#solicitud-tipo').val(),
        monto: parseFloat($('#solicitud-monto').val()),
        concepto: $('#solicitud-concepto').val().trim(),
        categoria: $('#solicitud-categoria').val(),
        descripcion: $('#solicitud-descripcion').val().trim(),
        fecha: $('#solicitud-fecha').val()
    };

    if (!datos.cuentaId || !datos.concepto || !datos.monto) {
        mostrarError('Complete todos los campos requeridos');
        return;
    }

    try {
        mostrarSpinner();
        
        // Crear la solicitud primero
        const response = await fetch('/api/sw/solicitudes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const data = await response.json();

        if (data.success) {
            const solicitudId = data.data._id;
            
            // Si hay imágenes seleccionadas, subirlas
            const archivosInput = document.getElementById('solicitud-imagenes');
            if (archivosInput && archivosInput.files.length > 0) {
                try {
                    await subirImagenesSolicitud(solicitudId, archivosInput.files);
                    mostrarExito('Solicitud e imágenes guardadas exitosamente');
                } catch (errorImg) {
                    console.error('Error al subir imágenes:', errorImg);
                    mostrarError('Solicitud creada, pero hubo un error al subir las imágenes');
                }
            } else {
                mostrarExito('Solicitud creada exitosamente');
            }
            
            $('#modalSolicitud').modal('hide');
            $('#formSolicitud')[0].reset();
            $('#preview-solicitud-imagenes').empty();
            cargarSolicitudes();
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al crear solicitud');
    } finally {
        ocultarSpinner();
    }
}

async function aprobarSolicitud(solicitudId) {
    const result = await Swal.fire({
        title: '¿Aprobar solicitud?',
        html: `
            <p class="mb-3">Esta acción creará una transacción en la cuenta</p>
            <div class="mb-3 text-start">
                <label for="comentario-aprobacion" class="form-label text-gray-900">Comentario (opcional)</label>
                <textarea id="comentario-aprobacion" class="form-control" rows="2" placeholder="Agregar un comentario..."></textarea>
            </div>
            <div class="mb-3 text-start">
                <label for="comprobante-confirmacion" class="form-label text-gray-900">
                    Comprobante de confirmación (opcional)
                    <i class="fas fa-info-circle ms-1" title="Sube una imagen del comprobante de pago o confirmación"></i>
                </label>
                <input type="file" id="comprobante-confirmacion" class="form-control" accept="image/*,.pdf">
                <small class="text-muted">Formatos: imágenes o PDF</small>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Aprobar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        background: '#ffffff',
        color: '#1f2937',
        preConfirm: () => {
            const comentario = document.getElementById('comentario-aprobacion').value;
            const archivo = document.getElementById('comprobante-confirmacion').files[0];
            return { comentario, archivo };
        }
    });

    if (result.isConfirmed) {
        try {
            const formData = new FormData();
            formData.append('accion', 'aprobar');
            formData.append('comentario', result.value.comentario || '');
            
            if (result.value.archivo) {
                formData.append('comprobanteConfirmacion', result.value.archivo);
            }

            const response = await fetch(`/api/sw/solicitudes/${solicitudId}/procesar`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                if (response.status === 403) {
                    mostrarError('No tienes permiso para aprobar esta solicitud');
                    return;
                }
                const data = await response.json();
                throw new Error(data.message || `Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                mostrarExito('Solicitud aprobada exitosamente');
                cargarSolicitudes();
                cargarMisCuentas(); // Actualizar saldos
            } else {
                mostrarError(data.message || 'Error al aprobar solicitud');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarError(error.message || 'Error al aprobar solicitud');
        }
    }
}

async function rechazarSolicitud(solicitudId) {
    const result = await Swal.fire({
        title: '¿Rechazar solicitud?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        input: 'textarea',
        inputLabel: 'Motivo del rechazo *',
        inputPlaceholder: 'Explica por qué se rechaza la solicitud...',
        inputValidator: (value) => {
            if (!value) {
                return 'Debes especificar un motivo';
            }
        },
        showCancelButton: true,
        confirmButtonText: 'Rechazar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        background: '#ffffff',
        color: '#1f2937'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/sw/solicitudes/${solicitudId}/procesar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    accion: 'rechazar',
                    motivoRechazo: result.value
                })
            });

            if (!response.ok) {
                if (response.status === 403) {
                    mostrarError('No tienes permiso para rechazar esta solicitud');
                    return;
                }
                const data = await response.json();
                throw new Error(data.message || `Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                mostrarExito('Solicitud rechazada');
                cargarSolicitudes();
            } else {
                mostrarError(data.message || 'Error al rechazar solicitud');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarError(error.message || 'Error al rechazar solicitud');
        }
    }
}

async function cancelarSolicitud(solicitudId) {
    const result = await Swal.fire({
        title: '¿Cancelar solicitud?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'No',
        confirmButtonColor: '#f59e0b',
        background: '#ffffff',
        color: '#1f2937'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/sw/solicitudes/${solicitudId}/cancelar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    mostrarError('No tienes permiso para cancelar esta solicitud');
                    return;
                }
                const data = await response.json();
                throw new Error(data.message || `Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                mostrarExito('Solicitud cancelada');
                cargarSolicitudes();
            } else {
                mostrarError(data.message || 'Error al cancelar solicitud');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarError(error.message || 'Error al cancelar solicitud');
        }
    }
}

function agregarTransaccion(cuentaId) {
    $('#transaccion-cuenta-id').val(cuentaId);
    $('#formTransaccion')[0].reset();
    $('#transaccion-fecha').val(new Date().toISOString().split('T')[0]);
    $('#preview-imagenes').empty();
    $('#modalTransaccion').modal('show');
}

async function guardarTransaccion() {
    const cuentaId = $('#transaccion-cuenta-id').val();
    const datos = {
        cuentaId: cuentaId,
        tipo: $('#transaccion-tipo').val(),
        monto: parseFloat($('#transaccion-monto').val()),
        concepto: $('#transaccion-concepto').val().trim(),
        categoria: $('#transaccion-categoria').val(),
        descripcion: $('#transaccion-descripcion').val().trim(),
        fecha: $('#transaccion-fecha').val(),
        notas: $('#transaccion-notas').val().trim()
    };

    if (!datos.cuentaId || !datos.concepto || !datos.monto) {
        mostrarError('Complete todos los campos requeridos');
        return;
    }

    if (datos.monto <= 0) {
        mostrarError('El monto debe ser mayor a 0');
        return;
    }

    try {
        mostrarSpinner();
        
        // Crear la transacción primero
        const response = await fetch('/api/sw/transacciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        if (!response.ok) {
            if (response.status === 403) {
                mostrarError('No tienes permiso para crear transacciones en esta cuenta');
                return;
            }
            const data = await response.json();
            throw new Error(data.message || `Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            const transaccionId = data.data._id;
            
            // Si hay imágenes seleccionadas, subirlas
            const archivosInput = document.getElementById('transaccion-imagenes');
            if (archivosInput && archivosInput.files.length > 0) {
                try {
                    await subirImagenesTransaccion(transaccionId, archivosInput.files);
                    mostrarExito('Transacción e imágenes guardadas exitosamente');
                } catch (errorImg) {
                    console.error('Error al subir imágenes:', errorImg);
                    mostrarError('Transacción creada, pero hubo un error al subir las imágenes');
                }
            } else {
                mostrarExito('Transacción creada exitosamente');
            }
            
            $('#modalTransaccion').modal('hide');
            $('#formTransaccion')[0].reset();
            $('#preview-imagenes').empty();
            cargarMisCuentas(); // Actualizar saldos
            
            // Recargar transacciones para mostrar la nueva con sus imágenes
            await cargarTransacciones();
        } else {
            mostrarError(data.message || 'Error al crear transacción');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError(error.message || 'Error al crear transacción');
    } finally {
        ocultarSpinner();
    }
}

function verDetalleSolicitud(solicitudId) {
    const solicitud = solicitudes.find(s => s._id === solicitudId);
    
    if (!solicitud) {
        mostrarError('Solicitud no encontrada');
        return;
    }
    
    const fecha = new Date(solicitud.fecha).toLocaleDateString('es-MX');
    const monto = formatearMoneda(solicitud.monto, solicitud.cuenta?.moneda || 'MXN');
    const tipoColor = solicitud.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-600';
    
    let detalleHtml = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-gray-500 text-sm">Cuenta</p>
                    <p class="text-gray-900 font-semibold">${solicitud.cuenta?.nombre || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-500 text-sm">Estado</p>
                    <p class="text-gray-900">${obtenerBadgeEstado(solicitud.estado)}</p>
                </div>
                <div>
                    <p class="text-gray-500 text-sm">Tipo</p>
                    <p class="${tipoColor} font-semibold">${solicitud.tipo}</p>
                </div>
                <div>
                    <p class="text-gray-500 text-sm">Monto</p>
                    <p class="${tipoColor} font-semibold text-lg">${monto}</p>
                </div>
                <div>
                    <p class="text-gray-500 text-sm">Fecha</p>
                    <p class="text-gray-900">${fecha}</p>
                </div>
                <div>
                    <p class="text-gray-500 text-sm">Categoría</p>
                    <p class="text-gray-900">${solicitud.categoria}</p>
                </div>
            </div>
            
            <div>
                <p class="text-gray-500 text-sm">Concepto</p>
                <p class="text-gray-900 font-semibold text-lg">${solicitud.concepto}</p>
            </div>
            
            ${solicitud.descripcion ? `
                <div>
                    <p class="text-gray-500 text-sm">Descripción</p>
                    <p class="text-gray-900">${solicitud.descripcion}</p>
                </div>
            ` : ''}
            
            <div>
                <p class="text-gray-500 text-sm">Solicitado por</p>
                <p class="text-gray-900">${solicitud.solicitadoPor?.firstName || 'N/A'} ${solicitud.solicitadoPor?.lastName || ''}</p>
            </div>
            
            ${solicitud.respuesta?.comentario ? `
                <div class="border-t border-gray-200 pt-4">
                    <p class="text-gray-500 text-sm">Respuesta del propietario</p>
                    <p class="text-gray-900">${solicitud.respuesta.comentario}</p>
                    <p class="text-gray-500 text-xs mt-2">
                        ${solicitud.respuesta.procesadaPor?.firstName || ''} - 
                        ${new Date(solicitud.respuesta.fechaProcesada).toLocaleString('es-MX')}
                    </p>
                </div>
            ` : ''}
            
            ${solicitud.imagenes && solicitud.imagenes.length > 0 ? `
                <div class="border-t border-gray-200 pt-4">
                    <p class="text-gray-500 text-sm mb-3">
                        <i class="fas fa-paperclip me-2"></i>Comprobantes del Participante (${solicitud.imagenes.length})
                    </p>
                    <div class="grid grid-cols-3 gap-3">
                        ${solicitud.imagenes.map(imagen => {
                            const imagenUrl = `https://navarro.integradev.site/navarro/splitwise/${imagen}`;
                            return `
                                <div class="relative group cursor-pointer" onclick="visualizarImagenCompleta('${imagenUrl}')">
                                    <img src="${imagenUrl}" alt="Imagen adjunta" class="w-full h-24 object-cover rounded-lg border border-gray-300 hover:border-teal-500 transition-colors">
                                    ${solicitud.estado === 'Pendiente' ? `
                                        <button onclick="event.stopPropagation(); eliminarImagenSolicitud('${solicitud._id}', '${imagen}')" 
                                                class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-gray-900 rounded-full p-1 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <i class="fas fa-times text-xs"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${solicitud.respuesta?.comprobanteConfirmacion?.url ? `
                <div class="border-t border-gray-200 pt-4">
                    <p class="text-gray-500 text-sm mb-3">
                        <i class="fas fa-check-circle me-2"></i>Comprobante de Confirmación del Propietario
                    </p>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="relative cursor-pointer" onclick="visualizarImagenCompleta('https://navarro.integradev.site/navarro/splitwise/${solicitud.respuesta.comprobanteConfirmacion.url}')">
                            ${solicitud.respuesta.comprobanteConfirmacion.tipo && solicitud.respuesta.comprobanteConfirmacion.tipo.includes('pdf') ? `
                                <div class="w-full h-24 bg-red-900 rounded-lg border border-gray-300 hover:border-teal-500 transition-colors flex items-center justify-center">
                                    <i class="fas fa-file-pdf text-4xl text-red-300"></i>
                                </div>
                                <p class="text-xs text-gray-500 text-center mt-1">${solicitud.respuesta.comprobanteConfirmacion.nombre}</p>
                            ` : `
                                <img src="https://navarro.integradev.site/navarro/splitwise/${solicitud.respuesta.comprobanteConfirmacion.url}" alt="Comprobante confirmación" class="w-full h-24 object-cover rounded-lg border border-gray-300 hover:border-teal-500 transition-colors">
                            `}
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    Swal.fire({
        title: 'Detalle de Solicitud',
        html: detalleHtml,
        width: 600,
        showCloseButton: true,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#1f2937'
    });
}

// ===== TRANSACCIONES =====
async function cargarTransacciones() {
    const cuentaId = $('#filtro-cuenta-transacciones').val();
    
    // Si no hay cuenta seleccionada, mostrar mensaje
    if (!cuentaId && cuentas.length > 0) {
        $('#tabla-transacciones-body').html(`
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                    Seleccione una cuenta para ver sus transacciones
                </td>
            </tr>
        `);
        return;
    }

    if (!cuentaId) return;

    try {
        mostrarSpinner();
        const response = await fetch(`/api/sw/transacciones/cuenta/${cuentaId}`);
        
        if (!response.ok) {
            if (response.status === 403) {
                mostrarError('No tienes permiso para ver las transacciones de esta cuenta');
                $('#tabla-transacciones-body').html(`
                    <tr>
                        <td colspan="7" class="px-6 py-4 text-center text-yellow-400">
                            <i class="fas fa-lock me-2"></i>No tienes permiso para ver las transacciones de esta cuenta
                        </td>
                    </tr>
                `);
                return;
            }
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            transacciones = data.data;
            renderizarTransacciones();
        } else {
            mostrarError(data.message || 'Error al cargar transacciones');
        }
    } catch (error) {
        console.error('Error al cargar transacciones:', error);
        mostrarError('Error al cargar transacciones');
    } finally {
        ocultarSpinner();
    }
}

function renderizarTransacciones() {
    const tbody = $('#tabla-transacciones-body');
    tbody.empty();

    if (transacciones.length === 0) {
        tbody.html(`
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                    No hay transacciones en esta cuenta
                </td>
            </tr>
        `);
        return;
    }

    transacciones.forEach(trans => {
        const fecha = new Date(trans.fecha).toLocaleDateString('es-MX');
        const monto = formatearMoneda(trans.monto, 'MXN');
        const tipoColor = trans.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-600';
        const estadoBadge = trans.aprobada ? 
            '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-300">Aprobada</span>' :
            '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-900 text-yellow-300">Pendiente</span>';

        // Indicador de imágenes
        const cantidadImagenes = trans.imagenes?.length || 0;
        const iconoImagenes = cantidadImagenes > 0 ? 
            `<i class="fas fa-paperclip text-teal-600" title="${cantidadImagenes} imagen(es)"></i>` : '';

        tbody.append(`
            <tr class="border-b border-gray-200 hover:bg-gray-100">
                <td class="px-6 py-4">${fecha} ${iconoImagenes}</td>
                <td class="px-6 py-4 ${tipoColor}">${trans.tipo}</td>
                <td class="px-6 py-4 font-medium text-gray-900">${trans.concepto}</td>
                <td class="px-6 py-4">${trans.categoria}</td>
                <td class="px-6 py-4 text-right font-semibold ${tipoColor}">${monto}</td>
                <td class="px-6 py-4">${estadoBadge}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="verDetalleTransaccion('${trans._id}')" class="btn btn-sm btn-info me-1" title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="gestionarImagenesTransaccion('${trans._id}')" class="btn btn-sm btn-secondary" title="Ver/Gestionar comprobantes">
                        <i class="fas fa-images"></i>
                    </button>
                </td>
            </tr>
        `);
    });
}

// Listener para filtro de cuenta
$('#filtro-cuenta-transacciones').on('change', cargarTransacciones);

// ===== UTILIDADES =====
function formatearMoneda(monto, moneda = 'MXN') {
    const simbolos = { MXN: '$', USD: '$', EUR: '€' };
    const simbolo = simbolos[moneda] || '$';
    return `${simbolo}${parseFloat(monto).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function obtenerBadgeEstado(estado) {
    const badges = {
        'Pendiente': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-900 text-yellow-300">Pendiente</span>',
        'Aprobada': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-300">Aprobada</span>',
        'Rechazada': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-900 text-red-300">Rechazada</span>',
        'Cancelada': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-600 text-gray-600">Cancelada</span>'
    };
    return badges[estado] || estado;
}

function mostrarExito(mensaje) {
    Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: mensaje,
        background: '#ffffff',
        color: '#374151',
        confirmButtonColor: '#3b82f6'
    });
}

function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        background: '#ffffff',
        color: '#374151',
        confirmButtonColor: '#ef4444'
    });
}

function mostrarInfo(mensaje) {
    Swal.fire({
        icon: 'info',
        title: 'Información',
        text: mensaje,
        background: '#ffffff',
        color: '#374151',
        confirmButtonColor: '#3b82f6'
    });
}

// Limpiar formularios al cerrar modales
$('#modalOrganizacion, #modalCuenta, #modalSolicitud, #modalParticipantes').on('hidden.bs.modal', function() {
    $(this).find('form')[0]?.reset();
    $(this).find('input[type="hidden"]').val('');
    $(this).find('.modal-title').text($(this).find('.modal-title').text().replace('Editar', 'Nueva'));
});

// ===== PARTICIPANTES =====
async function cargarUsuarios() {
    try {
        mostrarSpinner();
        const response = await fetch('/api/usuarios/all');
        const data = await response.json();
        
        if (data.success) {
            usuarios = data.data || data.users || [];
            actualizarSelectUsuarios();
        }
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
    } finally {
        ocultarSpinner();
    }
}

function actualizarSelectUsuarios() {
    const select = $('#selectUsuario');
    
    // Destruir Select2 si ya existe
    if (select.data('select2')) {
        select.select2('destroy');
    }
    
    // Limpiar y agregar opciones
    select.empty().append('<option value="">Seleccione un usuario...</option>');
    
    usuarios.forEach(usuario => {
        const nombre = `${usuario.firstName} ${usuario.lastName}`;
        const email = usuario.email;
        select.append(`<option value="${usuario._id}" data-email="${email}">${nombre} - ${email}</option>`);
    });
    
    // Inicializar Select2 con búsqueda
    select.select2({
        theme: 'bootstrap-5',
        dropdownParent: $('#modalParticipantes'),
        placeholder: 'Buscar usuario por nombre o email...',
        allowClear: true,
        language: {
            noResults: function() {
                return 'No se encontraron usuarios';
            },
            searching: function() {
                return 'Buscando...';
            }
        },
        matcher: function(params, data) {
            // Si no hay término de búsqueda, mostrar todo
            if ($.trim(params.term) === '') {
                return data;
            }
            
            // Búsqueda en texto visible y email
            const searchTerm = params.term.toLowerCase();
            const text = data.text.toLowerCase();
            
            if (text.indexOf(searchTerm) > -1) {
                return data;
            }
            
            return null;
        }
    });
}

async function abrirModalParticipantes(cuentaId) {
    $('#participanteCuentaId').val(cuentaId);
    
    // Cargar usuarios si no están cargados
    if (usuarios.length === 0) {
        await cargarUsuarios();
    }
    
    $('#modalParticipantes').modal('show');
}

async function guardarParticipante() {
    const cuentaId = $('#participanteCuentaId').val();
    const usuarioId = $('#selectUsuario').val();

    if (!usuarioId) {
        mostrarError('Debe seleccionar un usuario');
        return;
    }

    const permisos = {
        puedeVerTransacciones: $('#checkVerTransacciones').is(':checked'),
        puedeCrearSolicitudes: $('#checkCrearSolicitudes').is(':checked'),
        puedeVerSaldo: $('#checkVerSaldo').is(':checked')
    };

    try {
        const response = await fetch(`/api/sw/cuentas/${cuentaId}/participantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuarioId, permisos })
        });

        if (!response.ok) {
            if (response.status === 403) {
                mostrarError('No tienes permiso para agregar participantes a esta cuenta');
                return;
            }
            const data = await response.json();
            throw new Error(data.message || `Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            mostrarExito('Participante agregado exitosamente');
            $('#modalParticipantes').modal('hide');
            cargarParticipantes(cuentaId);
        } else {
            mostrarError(data.message || 'Error al agregar participante');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al agregar participante');
    }
}

async function cargarParticipantes(cuentaId) {
    try {
        mostrarSpinner();
        const response = await fetch(`/api/sw/cuentas/${cuentaId}/participantes`);
        
        if (!response.ok) {
            if (response.status === 403) {
                $(`#participantes-lista-${cuentaId}`).html(`
                    <p class="text-yellow-400 text-sm">
                        <i class="fas fa-lock me-2"></i>No tienes permiso para ver los participantes de esta cuenta
                    </p>
                `);
                return;
            }
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            participantes = data.data || [];
            renderizarParticipantes(cuentaId);
        } else {
            $(`#participantes-lista-${cuentaId}`).html(`<p class="text-red-600 text-sm">${data.message || 'Error al cargar participantes'}</p>`);
        }
    } catch (error) {
        console.error('Error al cargar participantes:', error);
        $(`#participantes-lista-${cuentaId}`).html('<p class="text-red-600 text-sm">Error al cargar participantes</p>');
    } finally {
        ocultarSpinner();
    }
}

function renderizarParticipantes(cuentaId) {
    const container = $(`#participantes-lista-${cuentaId}`);
    container.empty();

    if (participantes.length === 0) {
        container.html('<p class="text-gray-500 text-sm">No hay participantes agregados</p>');
        return;
    }

    participantes.forEach(part => {
        const nombre = part.usuario ? `${part.usuario.firstName} ${part.usuario.lastName}` : 'Usuario desconocido';
        const rol = part.rol === 'Propietario' ? 
            '<span class="badge bg-warning text-dark">Propietario</span>' : 
            '<span class="badge bg-info">Participante</span>';

        const permisos = [];
        if (part.permisos?.puedeVerTransacciones) permisos.push('Ver transacciones');
        if (part.permisos?.puedeCrearSolicitudes) permisos.push('Crear solicitudes');
        if (part.permisos?.puedeVerSaldo) permisos.push('Ver saldo');

        const botonEliminar = part.rol !== 'Propietario' ? 
            `<button onclick="eliminarParticipante('${cuentaId}', '${part.usuario?._id}')" class="btn btn-sm btn-danger">
                <i class="fas fa-trash"></i>
            </button>` : '';

        container.append(`
            <div class="d-flex justify-content-between align-items-center p-3 mb-2 bg-white rounded border border-gray-300">
                <div>
                    <div class="fw-bold text-gray-900">${nombre}</div>
                    <div class="text-sm text-gray-500">${rol}</div>
                    ${permisos.length > 0 ? `<div class="text-xs text-gray-500 mt-1">${permisos.join(', ')}</div>` : ''}
                </div>
                <div>
                    ${botonEliminar}
                </div>
            </div>
        `);
    });
}

async function eliminarParticipante(cuentaId, usuarioId) {
    if (!confirm('¿Está seguro de eliminar este participante?')) return;

    try {
        const response = await fetch(`/api/sw/cuentas/${cuentaId}/participantes/${usuarioId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            if (response.status === 403) {
                mostrarError('No tienes permiso para eliminar participantes de esta cuenta');
                return;
            }
            const data = await response.json();
            throw new Error(data.message || `Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            mostrarExito('Participante eliminado exitosamente');
            cargarParticipantes(cuentaId);
        } else {
            mostrarError(data.message || 'Error al eliminar participante');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al eliminar participante');
    }
}

// ===== GESTIÓN DE IMÁGENES DE TRANSACCIONES =====

// Preview de imágenes al seleccionarlas en el formulario de crear transacción
$(document).on('change', '#transaccion-imagenes', function(e) {
    const files = e.target.files;
    const previewContainer = $('#preview-imagenes');
    previewContainer.empty();

    if (files.length > 3) {
        mostrarError('Solo puede seleccionar máximo 3 imágenes');
        e.target.value = '';
        return;
    }

    Array.from(files).forEach((file, index) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgContainer = $(`
                    <div class="preview-image-container">
                        <img src="${e.target.result}" class="preview-image" alt="Preview ${index + 1}">
                        <button type="button" class="preview-image-remove" onclick="removerImagenPreview(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `);
                previewContainer.append(imgContainer);
            };
            reader.readAsDataURL(file);
        }
    });
});

function removerImagenPreview(index) {
    const input = document.getElementById('transaccion-imagenes');
    const dt = new DataTransfer();
    
    Array.from(input.files).forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    input.files = dt.files;
    $('#transaccion-imagenes').trigger('change');
}

// Subir imágenes de una transacción
async function subirImagenesTransaccion(transaccionId, files) {
    const formData = new FormData();
    
    Array.from(files).forEach(file => {
        formData.append('imagenes', file);
    });

    const response = await fetch(`/api/sw/transacciones/${transaccionId}/imagenes`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al subir imágenes');
    }

    return await response.json();
}

// Abrir modal para gestionar imágenes de una transacción
async function gestionarImagenesTransaccion(transaccionId) {
    try {
        mostrarSpinner();
        
        const response = await fetch(`/api/sw/transacciones/${transaccionId}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error al cargar transacción');
        }

        const transaccion = data.data;
        $('#modal-imagenes-transaccion-id').val(transaccionId);

        // Mostrar imágenes existentes
        const imagenesGrid = $('#imagenes-existentes-grid');
        imagenesGrid.empty();

        if (transaccion.imagenes && transaccion.imagenes.length > 0) {
            transaccion.imagenes.forEach(imagen => {
                const imagenUrl = `https://navarro.integradev.site/navarro/splitwise/${imagen}`;
                const card = $(`
                    <div class="col-md-4">
                        <div class="imagen-existente-card" onclick="visualizarImagenCompleta('${imagenUrl}')">
                            <img src="${imagenUrl}" alt="Comprobante" class="img-fluid">
                            <button type="button" class="imagen-existente-delete" onclick="event.stopPropagation(); eliminarImagenTransaccion('${transaccionId}', '${imagen}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `);
                imagenesGrid.append(card);
            });
        } else {
            imagenesGrid.html('<p class="text-gray-500 col-12">No hay imágenes adjuntas</p>');
        }

        // Mostrar/ocultar sección de subir nuevas según el límite
        const cantidadActual = transaccion.imagenes?.length || 0;
        if (cantidadActual >= 3) {
            $('#subir-imagenes-container').hide();
        } else {
            $('#subir-imagenes-container').show();
            $('#nuevas-imagenes-input').attr('max', 3 - cantidadActual);
        }

        $('#modalImagenesTransaccion').modal('show');
    } catch (error) {
        console.error('Error:', error);
        mostrarError(error.message || 'Error al cargar imágenes');
    } finally {
        ocultarSpinner();
    }
}

// Preview de nuevas imágenes a subir
$(document).on('change', '#nuevas-imagenes-input', function(e) {
    const files = e.target.files;
    const previewContainer = $('#preview-nuevas-imagenes');
    const btnSubir = $('#btnSubirNuevasImagenes');
    previewContainer.empty();

    const transaccionId = $('#modal-imagenes-transaccion-id').val();
    const imagenesActuales = $('#imagenes-existentes-grid .col-md-4').length;

    if (imagenesActuales + files.length > 3) {
        mostrarError(`Solo puede tener máximo 3 imágenes. Actualmente tiene ${imagenesActuales}`);
        e.target.value = '';
        btnSubir.hide();
        return;
    }

    if (files.length > 0) {
        Array.from(files).forEach((file, index) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imgCol = $(`
                        <div class="col-4">
                            <img src="${e.target.result}" class="img-fluid rounded" style="height: 100px; object-fit: cover;" alt="Preview ${index + 1}">
                        </div>
                    `);
                    previewContainer.append(imgCol);
                };
                reader.readAsDataURL(file);
            }
        });
        btnSubir.show();
    } else {
        btnSubir.hide();
    }
});

// Subir nuevas imágenes desde el modal de gestión
$(document).on('click', '#btnSubirNuevasImagenes', async function() {
    const transaccionId = $('#modal-imagenes-transaccion-id').val();
    const input = document.getElementById('nuevas-imagenes-input');
    
    if (!input.files || input.files.length === 0) {
        mostrarError('Seleccione al menos una imagen');
        return;
    }

    try {
        mostrarSpinner();
        await subirImagenesTransaccion(transaccionId, input.files);
        mostrarExito('Imágenes subidas exitosamente');
        
        // Recargar transacciones para actualizar el ícono
        await cargarTransacciones();
        
        // Recargar el modal
        $('#modalImagenesTransaccion').modal('hide');
        setTimeout(() => gestionarImagenesTransaccion(transaccionId), 500);
    } catch (error) {
        console.error('Error:', error);
        mostrarError(error.message || 'Error al subir imágenes');
    } finally {
        ocultarSpinner();
    }
});

// Eliminar una imagen específica
async function eliminarImagenTransaccion(transaccionId, imagenNombre) {
    const confirmar = await Swal.fire({
        title: '¿Eliminar imagen?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#ffffff',
        color: '#374151'
    });

    if (!confirmar.isConfirmed) return;

    try {
        mostrarSpinner();
        
        const response = await fetch(`/api/sw/transacciones/${transaccionId}/imagenes/${imagenNombre}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error al eliminar imagen');
        }

        mostrarExito('Imagen eliminada exitosamente');
        
        // Recargar transacciones para actualizar el ícono
        await cargarTransacciones();
        
        // Recargar el modal
        $('#modalImagenesTransaccion').modal('hide');
        setTimeout(() => gestionarImagenesTransaccion(transaccionId), 500);
    } catch (error) {
        console.error('Error:', error);
        mostrarError(error.message || 'Error al eliminar imagen');
    } finally {
        ocultarSpinner();
    }
}

// Visualizar imagen completa en modal
function visualizarImagenCompleta(imagenUrl, fromSolicitudDetail = false) {
    // Si viene desde el detalle de solicitud (SweetAlert), cerrar SweetAlert primero
    if (Swal.isVisible()) {
        Swal.close();
    }
    
    // Si viene desde el modal de detalle de transacción (Bootstrap), cerrarlo primero
    if ($('#modalDetalleTransaccion').hasClass('show')) {
        $('#modalDetalleTransaccion').modal('hide');
        // Esperar a que se cierre el modal antes de abrir el visor
        setTimeout(() => {
            $('#imagen-visualizar-full').attr('src', imagenUrl);
            $('#btn-descargar-imagen').attr('href', imagenUrl);
            $('#modalVisualizarImagen').modal('show');
        }, 300);
    } else {
        $('#imagen-visualizar-full').attr('src', imagenUrl);
        $('#btn-descargar-imagen').attr('href', imagenUrl);
        $('#modalVisualizarImagen').modal('show');
    }
}

// Ver detalle completo de una transacción
async function verDetalleTransaccion(transaccionId) {
    try {
        mostrarSpinner();
        
        const response = await fetch(`/api/sw/transacciones/${transaccionId}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error al cargar transacción');
        }

        const trans = data.data;
        
        // Formatear valores
        const fecha = new Date(trans.fecha).toLocaleDateString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const monto = formatearMoneda(trans.monto, trans.cuenta?.moneda || 'MXN');
        const tipoColor = trans.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-600';
        const tipoBadge = trans.tipo === 'Ingreso' ? 
            '<span class="px-3 py-1 text-sm font-semibold rounded-full bg-green-900 text-green-300"><i class="fas fa-arrow-up me-1"></i>Ingreso</span>' :
            '<span class="px-3 py-1 text-sm font-semibold rounded-full bg-red-900 text-red-300"><i class="fas fa-arrow-down me-1"></i>Gasto</span>';
        const estadoBadge = trans.aprobada ? 
            '<span class="px-3 py-1 text-sm font-semibold rounded-full bg-green-900 text-green-300"><i class="fas fa-check-circle me-1"></i>Aprobada</span>' :
            '<span class="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-900 text-yellow-300"><i class="fas fa-clock me-1"></i>Pendiente</span>';

        // Construir HTML del detalle
        let html = `
            <div class="bg-gray-100 rounded-lg p-4 mb-4">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <h4 class="text-gray-900 mb-2">${trans.concepto}</h4>
                        <p class="text-gray-500 mb-0"><i class="far fa-calendar me-2"></i>${fecha}</p>
                    </div>
                    <div class="text-end">
                        <div class="mb-2">${tipoBadge}</div>
                        <h3 class="${tipoColor} mb-0">${monto}</h3>
                    </div>
                </div>
                
                <div class="border-top border-gray-300 pt-3 mt-3">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <p class="text-gray-500 mb-1 text-sm">Categoría</p>
                            <p class="text-gray-900 mb-0"><i class="fas fa-tag me-2"></i>${trans.categoria}</p>
                        </div>
                        <div class="col-md-6">
                            <p class="text-gray-500 mb-1 text-sm">Estado</p>
                            <div>${estadoBadge}</div>
                        </div>
                        <div class="col-md-6">
                            <p class="text-gray-500 mb-1 text-sm">Cuenta</p>
                            <p class="text-gray-900 mb-0"><i class="fas fa-wallet me-2"></i>${trans.cuenta?.nombre || 'N/A'}</p>
                        </div>
                        <div class="col-md-6">
                            <p class="text-gray-500 mb-1 text-sm">Creado por</p>
                            <p class="text-gray-900 mb-0"><i class="fas fa-user me-2"></i>${trans.creadoPor?.firstName || ''} ${trans.creadoPor?.lastName || ''}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Descripción
        if (trans.descripcion) {
            html += `
                <div class="bg-gray-100 rounded-lg p-4 mb-4">
                    <h6 class="text-gray-600 mb-2"><i class="fas fa-align-left me-2"></i>Descripción</h6>
                    <p class="text-gray-900 mb-0">${trans.descripcion}</p>
                </div>
            `;
        }

        // Notas internas
        if (trans.notas) {
            html += `
                <div class="bg-gray-100 rounded-lg p-4 mb-4">
                    <h6 class="text-gray-600 mb-2"><i class="fas fa-sticky-note me-2"></i>Notas Internas</h6>
                    <p class="text-gray-900 mb-0">${trans.notas}</p>
                </div>
            `;
        }

        // Información de aprobación
        if (trans.aprobada && trans.aprobadaPor) {
            const fechaAprobacion = new Date(trans.fechaAprobacion).toLocaleDateString('es-MX');
            html += `
                <div class="bg-gray-100 rounded-lg p-4 mb-4">
                    <h6 class="text-gray-600 mb-2"><i class="fas fa-check-circle me-2"></i>Información de Aprobación</h6>
                    <div class="row g-2">
                        <div class="col-md-6">
                            <p class="text-gray-500 mb-1 text-sm">Aprobada por</p>
                            <p class="text-gray-900 mb-0">${trans.aprobadaPor?.firstName || ''} ${trans.aprobadaPor?.lastName || ''}</p>
                        </div>
                        <div class="col-md-6">
                            <p class="text-gray-500 mb-1 text-sm">Fecha de aprobación</p>
                            <p class="text-gray-900 mb-0">${fechaAprobacion}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        // Etiquetas
        if (trans.etiquetas && trans.etiquetas.length > 0) {
            html += `
                <div class="bg-gray-100 rounded-lg p-4 mb-4">
                    <h6 class="text-gray-600 mb-2"><i class="fas fa-tags me-2"></i>Etiquetas</h6>
                    <div class="d-flex flex-wrap gap-2">
                        ${trans.etiquetas.map(tag => `<span class="badge bg-blue-600">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // Imágenes adjuntas (Comprobantes del participante)
        if (trans.imagenes && trans.imagenes.length > 0) {
            html += `
                <div class="bg-gray-100 rounded-lg p-4 mb-4">
                    <h6 class="text-gray-600 mb-3"><i class="fas fa-paperclip me-2"></i>Comprobantes del Participante (${trans.imagenes.length})</h6>
                    <div class="row g-3">
            `;
            
            trans.imagenes.forEach(imagen => {
                const imagenUrl = `https://navarro.integradev.site/navarro/splitwise/${imagen}`;
                html += `
                    <div class="col-md-4 col-6">
                        <div class="position-relative" style="cursor: pointer;" onclick="visualizarImagenCompleta('${imagenUrl}')">
                            <img src="${imagenUrl}" alt="Comprobante participante" class="img-fluid rounded" style="height: 120px; width: 100%; object-fit: cover;">
                            <div class="position-absolute top-0 end-0 m-2">
                                <span class="badge bg-secondary bg-opacity-75">
                                    <i class="fas fa-search-plus"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                    <button type="button" class="btn btn-sm btn-primary mt-3" onclick="$('#modalDetalleTransaccion').modal('hide'); setTimeout(() => gestionarImagenesTransaccion('${trans._id}'), 300);">
                        <i class="fas fa-edit me-1"></i> Gestionar Imágenes
                    </button>
                </div>
            `;
        } else {
            html += `
                <div class="bg-gray-100 rounded-lg p-4 mb-4">
                    <h6 class="text-gray-600 mb-2"><i class="fas fa-paperclip me-2"></i>Comprobantes del Participante</h6>
                    <p class="text-gray-500 mb-2">No hay comprobantes adjuntos</p>
                    <button type="button" class="btn btn-sm btn-primary" onclick="$('#modalDetalleTransaccion').modal('hide'); setTimeout(() => gestionarImagenesTransaccion('${trans._id}'), 300);">
                        <i class="fas fa-upload me-1"></i> Agregar Comprobantes
                    </button>
                </div>
            `;
        }

        // Comprobante de confirmación del propietario
        if (trans.comprobanteConfirmacion?.url) {
            html += `
                <div class="bg-gray-100 rounded-lg p-4 mb-4">
                    <h6 class="text-gray-600 mb-3"><i class="fas fa-check-circle me-2"></i>Comprobante de Confirmación del Propietario</h6>
                    <div class="row g-3">
                        <div class="col-md-4 col-6">
                            <div class="position-relative" style="cursor: pointer;" onclick="visualizarImagenCompleta('https://navarro.integradev.site/navarro/splitwise/${trans.comprobanteConfirmacion.url}')">
                                ${trans.comprobanteConfirmacion.tipo && trans.comprobanteConfirmacion.tipo.includes('pdf') ? `
                                    <div class="bg-danger bg-opacity-25 rounded d-flex align-items-center justify-content-center" style="height: 120px; width: 100%;">
                                        <i class="fas fa-file-pdf fa-4x text-danger"></i>
                                    </div>
                                    <p class="text-center text-gray-900 text-xs mt-2">${trans.comprobanteConfirmacion.nombre}</p>
                                ` : `
                                    <img src="https://navarro.integradev.site/navarro/splitwise/${trans.comprobanteConfirmacion.url}" alt="Comprobante confirmación" class="img-fluid rounded" style="height: 120px; width: 100%; object-fit: cover;">
                                    <div class="position-absolute top-0 end-0 m-2">
                                        <span class="badge bg-secondary bg-opacity-75">
                                            <i class="fas fa-search-plus"></i>
                                        </span>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                    <p class="text-gray-500 text-sm mt-3 mb-0">
                        <i class="far fa-clock me-2"></i>Subido el ${new Date(trans.comprobanteConfirmacion.fechaSubida).toLocaleDateString('es-MX')}
                    </p>
                </div>
            `;
        }

        // Mostrar el contenido
        $('#detalle-transaccion-content').html(html);
        $('#modalDetalleTransaccion').modal('show');

    } catch (error) {
        console.error('Error:', error);
        mostrarError(error.message || 'Error al cargar detalle de transacción');
    } finally {
        ocultarSpinner();
    }
}

// ===== GESTIÓN DE IMÁGENES DE SOLICITUDES =====

// Preview de imágenes al seleccionarlas en el formulario de crear solicitud
$(document).on('change', '#solicitud-imagenes', function(e) {
    const files = e.target.files;
    const previewContainer = $('#preview-solicitud-imagenes');
    previewContainer.empty();

    if (files.length > 3) {
        mostrarError('Solo puede seleccionar máximo 3 imágenes');
        e.target.value = '';
        return;
    }

    Array.from(files).forEach((file, index) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgContainer = $(`
                    <div class="preview-image-container">
                        <img src="${e.target.result}" class="preview-image" alt="Preview ${index + 1}">
                        <button type="button" class="preview-image-remove" onclick="removerImagenPreviewSolicitud(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `);
                previewContainer.append(imgContainer);
            };
            reader.readAsDataURL(file);
        }
    });
});

function removerImagenPreviewSolicitud(index) {
    const input = document.getElementById('solicitud-imagenes');
    const dt = new DataTransfer();
    
    Array.from(input.files).forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    input.files = dt.files;
    $('#solicitud-imagenes').trigger('change');
}

// Subir imágenes de una solicitud
async function subirImagenesSolicitud(solicitudId, files) {
    const formData = new FormData();
    
    Array.from(files).forEach(file => {
        formData.append('imagenes', file);
    });

    const response = await fetch(`/api/sw/solicitudes/${solicitudId}/imagenes`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al subir imágenes');
    }

    return await response.json();
}

// Eliminar una imagen de solicitud
async function eliminarImagenSolicitud(solicitudId, imagenNombre) {
    const result = await Swal.fire({
        title: '¿Eliminar imagen?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        background: '#ffffff',
        color: '#1f2937'
    });

    if (!result.isConfirmed) return;

    try {
        mostrarSpinner();
        const response = await fetch(`/api/sw/solicitudes/${solicitudId}/imagenes/${imagenNombre}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            mostrarExito('Imagen eliminada exitosamente');
            // Recargar solicitudes para actualizar la lista
            await cargarSolicitudes();
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al eliminar imagen');
    } finally {
        ocultarSpinner();
    }
}

// ===== DASHBOARD =====
let dashboardCharts = {
    personal: null,
    orgEvolucion: null,
    orgCategorias: null
};

// Cambio de vista del dashboard
$('#dashboard-selector').on('change', function() {
    const vista = $(this).val();
    
    if (vista === 'personal') {
        $('#dashboard-personal').removeClass('hidden');
        $('#dashboard-organizacion').addClass('hidden');
        $('#organizacion-selector').addClass('hidden');
        cargarDashboardPersonal();
    } else {
        $('#dashboard-personal').addClass('hidden');
        $('#dashboard-organizacion').removeClass('hidden');
        $('#organizacion-selector').removeClass('hidden');
        
        // Cargar organizaciones en el selector si no está cargado
        if ($('#organizacion-selector option').length === 1) {
            cargarOrganizacionesSelector();
        }
    }
});

// Cambio de organización seleccionada
$('#organizacion-selector').on('change', function() {
    const organizacionId = $(this).val();
    if (organizacionId) {
        cargarDashboardOrganizacion(organizacionId);
    }
});

async function cargarOrganizacionesSelector() {
    try {
        const response = await fetch('/api/sw/organizaciones');
        const data = await response.json();
        
        if (data.success) {
            const selector = $('#organizacion-selector');
            selector.find('option:not(:first)').remove();
            
            data.data.forEach(org => {
                selector.append(`<option value="${org._id}">${org.nombre}</option>`);
            });
            
            // Seleccionar la primera organización automáticamente
            if (data.data.length > 0) {
                selector.val(data.data[0]._id).trigger('change');
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Cargar dashboard personal
async function cargarDashboardPersonal() {
    try {
        mostrarSpinner();
        
        // Obtener fechas del filtro
        const fechaDesde = $('#fecha-desde').val();
        const fechaHasta = $('#fecha-hasta').val();
        
        // Construir URL con parámetros de fecha
        let url = '/api/sw/dashboard/personal';
        const params = new URLSearchParams();
        if (fechaDesde) params.append('fechaDesde', fechaDesde);
        if (fechaHasta) params.append('fechaHasta', fechaHasta);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        const stats = data.data;
        
        // Actualizar tarjetas
        $('#personal-saldo-total').text(formatearMoneda(stats.resumenGeneral.saldoTotal));
        $('#personal-ingresos').text(formatearMoneda(stats.resumenGeneral.totalIngresos));
        $('#personal-gastos').text(formatearMoneda(stats.resumenGeneral.totalGastos));
        $('#personal-num-cuentas').text(stats.resumenGeneral.numeroCuentas);
        
        // Gráfica de transacciones por cuenta
        renderizarGraficaCuentasPersonal(stats.transaccionesPorCuenta);
        
        // Transacciones recientes
        renderizarTransaccionesRecientes(stats.transaccionesRecientes);
        
        // Resumen de organizaciones
        renderizarResumenOrganizaciones(stats.resumenOrganizaciones || []);
        
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar dashboard personal');
    } finally {
        ocultarSpinner();
    }
}

function renderizarGraficaCuentasPersonal(transaccionesPorCuenta) {
    let ctx = document.getElementById('personal-chart-cuentas');
    
    // Si el canvas no existe (fue reemplazado por mensaje), recrearlo
    if (!ctx) {
        // Buscar el contenedor que tenía el canvas
        const containers = document.querySelectorAll('.bg-white.rounded-lg.p-6.shadow-xl');
        let container = null;
        
        for (let cont of containers) {
            const title = cont.querySelector('h3');
            if (title && title.textContent.includes('Transacciones por Cuenta')) {
                container = cont.querySelector('div[style*="height"]');
                break;
            }
        }
        
        if (container) {
            container.innerHTML = '<canvas id="personal-chart-cuentas"></canvas>';
            ctx = document.getElementById('personal-chart-cuentas');
        }
    }
    
    if (!ctx) return;
    
    // Destruir gráfica anterior si existe
    if (dashboardCharts.personal) {
        dashboardCharts.personal.destroy();
    }
    
    // Si no hay datos, mostrar mensaje
    if (!transaccionesPorCuenta || transaccionesPorCuenta.length === 0) {
        const container = ctx.parentElement;
        container.innerHTML = '<p class="text-gray-500 text-center py-10">No hay datos para mostrar</p>';
        return;
    }
    
    const labels = transaccionesPorCuenta.map(c => c.nombre);
    const ingresos = transaccionesPorCuenta.map(c => c.ingresos);
    const gastos = transaccionesPorCuenta.map(c => c.gastos);
    
    dashboardCharts.personal = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: ingresos,
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Gastos',
                    data: gastos,
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#374151'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#6b7280',
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(209, 213, 219, 0.5)'
                    }
                },
                x: {
                    ticks: {
                        color: '#6b7280'
                    },
                    grid: {
                        color: 'rgba(209, 213, 219, 0.5)'
                    }
                }
            }
        }
    });
}

function renderizarTransaccionesRecientes(transacciones) {
    const container = $('#personal-transacciones-recientes');
    container.empty();
    
    if (transacciones.length === 0) {
        container.html('<p class="text-gray-500 text-center">No hay transacciones recientes</p>');
        return;
    }
    
    transacciones.forEach(trans => {
        const tipoColor = trans.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-600';
        const tipoIcon = trans.tipo === 'Ingreso' ? 'fa-arrow-up' : 'fa-arrow-down';
        const fecha = new Date(trans.fecha).toLocaleDateString('es-MX');
        const monto = formatearMoneda(trans.monto);
        
        container.append(`
            <div class="flex items-center justify-between p-3 bg-gray-100 rounded-lg hover:bg-gray-600 transition-colors">
                <div class="flex items-center gap-3">
                    <div class="${tipoColor}">
                        <i class="fas ${tipoIcon}"></i>
                    </div>
                    <div>
                        <p class="text-gray-900 font-medium">${trans.concepto}</p>
                        <p class="text-gray-500 text-sm">${trans.cuenta} • ${fecha}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="${tipoColor} font-bold">${monto}</p>
                    <p class="text-gray-500 text-xs">${trans.categoria}</p>
                </div>
            </div>
        `);
    });
}

function renderizarResumenOrganizaciones(resumenOrganizaciones) {
    const container = $('#personal-resumen-organizaciones');
    container.empty();
    
    if (!resumenOrganizaciones || resumenOrganizaciones.length === 0) {
        container.html('<p class="text-gray-500 text-center">No hay actividad en organizaciones</p>');
        $('#org-balance-total').text('$0.00');
        $('#org-balance-ingresos').text('$0.00');
        $('#org-balance-gastos').text('$0.00');
        return;
    }
    
    // Calcular totales
    let totalIngresos = 0;
    let totalGastos = 0;
    
    resumenOrganizaciones.forEach(org => {
        totalIngresos += org.ingresos;
        totalGastos += org.gastos;
        
        const balanceColor = org.balance >= 0 ? 'text-green-600' : 'text-red-600';
        const balanceIcon = org.balance >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const ingresos = formatearMoneda(org.ingresos);
        const gastos = formatearMoneda(org.gastos);
        const balance = formatearMoneda(Math.abs(org.balance));
        
        container.append(`
            <div class="p-4 bg-gray-100 rounded-lg hover:bg-gray-600 transition-colors">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-building text-teal-600"></i>
                        <h4 class="text-gray-900 font-semibold">${org.organizacion}</h4>
                    </div>
                    <span class="text-gray-500 text-sm">${org.cantidad} transacciones</span>
                </div>
                <div class="grid grid-cols-3 gap-3 text-sm">
                    <div class="text-center p-2 bg-white rounded">
                        <p class="text-gray-500 text-xs mb-1">Ingresos</p>
                        <p class="text-green-600 font-semibold">${ingresos}</p>
                    </div>
                    <div class="text-center p-2 bg-white rounded">
                        <p class="text-gray-500 text-xs mb-1">Gastos</p>
                        <p class="text-red-600 font-semibold">${gastos}</p>
                    </div>
                    <div class="text-center p-2 bg-white rounded">
                        <p class="text-gray-500 text-xs mb-1">Balance</p>
                        <p class="${balanceColor} font-semibold">
                            <i class="fas ${balanceIcon} text-xs"></i> ${balance}
                        </p>
                    </div>
                </div>
            </div>
        `);
    });
    
    // Actualizar card de totales
    const balanceTotal = totalIngresos - totalGastos;
    $('#org-balance-total').text(formatearMoneda(balanceTotal));
    $('#org-balance-ingresos').text(formatearMoneda(totalIngresos));
    $('#org-balance-gastos').text(formatearMoneda(totalGastos));
}

// Cargar dashboard de organización
async function cargarDashboardOrganizacion(organizacionId) {
    try {
        mostrarSpinner();
        
        // Obtener fechas del filtro
        const fechaDesde = $('#fecha-desde').val();
        const fechaHasta = $('#fecha-hasta').val();
        
        // Construir URL con parámetros de fecha
        let url = `/api/sw/dashboard/organizacion/${organizacionId}`;
        const params = new URLSearchParams();
        if (fechaDesde) params.append('fechaDesde', fechaDesde);
        if (fechaHasta) params.append('fechaHasta', fechaHasta);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        const stats = data.data;
        
        // Tarjetas de resumen general
        $('#org-saldo-total').text(formatearMoneda(stats.resumenGeneral.saldoTotal));
        $('#org-ingresos').text(formatearMoneda(stats.resumenGeneral.totalIngresos));
        $('#org-gastos').text(formatearMoneda(stats.resumenGeneral.totalGastos));
        $('#org-num-cuentas').text(stats.resumenGeneral.numeroCuentas);
        $('#org-num-transacciones').text(stats.resumenGeneral.numeroTransacciones);
        
                // Participantes
                if (stats.participantes) {
                    $('#org-num-participantes-unicos').text(stats.participantes.unicos);
                }        // Resumen del mes
        $('#org-ingresos-mes').text(formatearMoneda(stats.resumenMes.ingresosMes));
        $('#org-gastos-mes').text(formatearMoneda(stats.resumenMes.gastosMes));
        $('#org-balance-mes').text(formatearMoneda(stats.resumenMes.netoMes));
        
        // Mi participación
        $('#org-mis-ingresos').text(formatearMoneda(stats.miParticipacion.ingresos));
        $('#org-mis-gastos').text(formatearMoneda(stats.miParticipacion.gastos));
        $('#org-mi-balance').text(formatearMoneda(stats.miParticipacion.neto));
        $('#org-mis-transacciones').text(stats.miParticipacion.numeroTransacciones);
        
        // Gráficas
        renderizarGraficaEvolucion(stats.transaccionesPorMes);
        renderizarGraficaCategorias(stats.transaccionesPorCategoria);
        
        // Top usuarios
        renderizarTopUsuarios(stats.topUsuarios);
        
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar dashboard de organización');
    } finally {
        ocultarSpinner();
    }
}

function renderizarGraficaEvolucion(transaccionesPorMes) {
    let ctx = document.getElementById('org-chart-evolucion');
    
    // Si el canvas no existe (fue reemplazado por mensaje), recrearlo
    if (!ctx) {
        const container = document.querySelector('#org-chart-evolucion')?.parentElement || 
                         document.querySelector('[id*="org-chart-evolucion"]')?.parentElement;
        if (container) {
            container.innerHTML = '<canvas id="org-chart-evolucion"></canvas>';
            ctx = document.getElementById('org-chart-evolucion');
        }
    }
    
    if (!ctx) return;
    
    if (dashboardCharts.orgEvolucion) {
        dashboardCharts.orgEvolucion.destroy();
    }
    
    // Si no hay datos, mostrar mensaje
    if (!transaccionesPorMes || transaccionesPorMes.length === 0) {
        const container = ctx.parentElement;
        container.innerHTML = '<p class="text-gray-500 text-center py-10">No hay datos para mostrar</p>';
        return;
    }
    
    const labels = transaccionesPorMes.map(t => t.mes);
    const ingresos = transaccionesPorMes.map(t => t.ingresos);
    const gastos = transaccionesPorMes.map(t => t.gastos);
    const neto = transaccionesPorMes.map(t => t.neto);
    
    dashboardCharts.orgEvolucion = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: ingresos,
                    borderColor: 'rgba(34, 197, 94, 1)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Gastos',
                    data: gastos,
                    borderColor: 'rgba(239, 68, 68, 1)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Balance',
                    data: neto,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#374151'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#6b7280',
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(209, 213, 219, 0.5)'
                    }
                },
                x: {
                    ticks: {
                        color: '#6b7280'
                    },
                    grid: {
                        color: 'rgba(209, 213, 219, 0.5)'
                    }
                }
            }
        }
    });
}

function renderizarGraficaCategorias(transaccionesPorCategoria) {
    let ctx = document.getElementById('org-chart-categorias');
    
    // Si el canvas no existe (fue reemplazado por mensaje), recrearlo
    if (!ctx) {
        const container = document.querySelector('#org-chart-categorias')?.parentElement || 
                         document.querySelector('[id*="org-chart-categorias"]')?.parentElement;
        if (container) {
            container.innerHTML = '<canvas id="org-chart-categorias"></canvas>';
            ctx = document.getElementById('org-chart-categorias');
        }
    }
    
    if (!ctx) return;
    
    if (dashboardCharts.orgCategorias) {
        dashboardCharts.orgCategorias.destroy();
    }
    
    // Si no hay datos, mostrar mensaje
    if (!transaccionesPorCategoria || transaccionesPorCategoria.length === 0) {
        const container = ctx.parentElement;
        container.innerHTML = '<p class="text-gray-500 text-center py-10">No hay datos para mostrar</p>';
        return;
    }
    
    // Filtrar solo gastos y tomar top 10
    const gastos = transaccionesPorCategoria
        .filter(t => t.tipo === 'Gasto')
        .slice(0, 10);
    
    // Si no hay gastos después del filtro, mostrar mensaje
    if (gastos.length === 0) {
        const container = ctx.parentElement;
        container.innerHTML = '<p class="text-gray-500 text-center py-10">No hay gastos para mostrar</p>';
        return;
    }
    
    const labels = gastos.map(t => t.categoria);
    const data = gastos.map(t => t.total);
    
    const colors = [
        'rgba(239, 68, 68, 0.7)',
        'rgba(249, 115, 22, 0.7)',
        'rgba(245, 158, 11, 0.7)',
        'rgba(234, 179, 8, 0.7)',
        'rgba(132, 204, 22, 0.7)',
        'rgba(34, 197, 94, 0.7)',
        'rgba(16, 185, 129, 0.7)',
        'rgba(20, 184, 166, 0.7)',
        'rgba(6, 182, 212, 0.7)',
        'rgba(14, 165, 233, 0.7)'
    ];
    
    dashboardCharts.orgCategorias = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.7', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#ffffff',
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    return {
                                        text: `${label}: $${value.toLocaleString()}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i,
                                        fontColor: '#ffffff'
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': $' + context.parsed.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function renderizarTopUsuarios(topUsuarios) {
    const container = $('#org-top-usuarios');
    container.empty();
    
    if (topUsuarios.length === 0) {
        container.html('<p class="text-gray-500 text-center">No hay datos de usuarios</p>');
        return;
    }
    
    topUsuarios.forEach((usuario, index) => {
        const badge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
        const balance = usuario.ingresos - usuario.gastos;
        const balanceColor = balance >= 0 ? 'text-green-600' : 'text-red-600';
        
        container.append(`
            <div class="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${badge}</span>
                    <div>
                        <p class="text-gray-900 font-medium">${usuario.nombre}</p>
                        <p class="text-gray-500 text-sm">${usuario.cantidad} transacciones</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-green-600 text-sm">+${formatearMoneda(usuario.ingresos)}</p>
                    <p class="text-red-600 text-sm">-${formatearMoneda(usuario.gastos)}</p>
                    <p class="${balanceColor} text-xs font-semibold mt-1">Balance: ${formatearMoneda(balance)}</p>
                </div>
            </div>
        `);
    });
}

// Cargar dashboard personal al iniciar
$(document).ready(function() {
    const tabActivo = $('.tab-button.active').data('tab');
    if (tabActivo === 'dashboard') {
        cargarDashboardPersonal();
    }
    
    // Event handlers para filtro de fechas
    $('#btn-aplicar-filtro-fechas').on('click', function() {
        const tipoVista = $('#dashboard-selector').val();
        if (tipoVista === 'personal') {
            cargarDashboardPersonal();
        } else {
            // Obtener el ID de la organización seleccionada
            const organizacionId = $('#organizacion-selector').val();
            if (organizacionId) {
                cargarDashboardOrganizacion(organizacionId);
            } else {
                mostrarError('Por favor seleccione una organización');
            }
        }
    });
    
    $('#btn-limpiar-filtro-fechas').on('click', function() {
        $('#fecha-desde').val('');
        $('#fecha-hasta').val('');
        const tipoVista = $('#dashboard-selector').val();
        if (tipoVista === 'personal') {
            cargarDashboardPersonal();
        } else {
            // Obtener el ID de la organización seleccionada
            const organizacionId = $('#organizacion-selector').val();
            if (organizacionId) {
                cargarDashboardOrganizacion(organizacionId);
            } else {
                mostrarError('Por favor seleccione una organización');
            }
        }
    });
});

