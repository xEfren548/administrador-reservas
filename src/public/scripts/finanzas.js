// Estado global
let organizaciones = [];
let cuentas = [];
let transacciones = [];
let solicitudes = [];
let cuentaSeleccionada = null;
let usuarios = []; // Lista de usuarios disponibles
let participantes = []; // Lista de participantes de la cuenta actual

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

    // Establecer fecha actual en el input de solicitud
    $('#solicitud-fecha').val(new Date().toISOString().split('T')[0]);
}

function cambiarTab(tabName) {
    // Actualizar botones
    $('.tab-button').removeClass('active border-blue-500 text-blue-400')
        .addClass('border-transparent text-gray-400');
    $(`.tab-button[data-tab="${tabName}"]`)
        .addClass('active border-blue-500 text-blue-400')
        .removeClass('border-transparent text-gray-400');

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
                <td colspan="5" class="px-6 py-4 text-center text-gray-400">
                    No hay organizaciones creadas
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

        // Botones de acción según permisos
        let botones = `
            <button onclick="verCuentasOrganizacion('${org._id}')" class="btn btn-sm btn-info me-1" title="Ver cuentas">
                <i class="fas fa-eye"></i>
            </button>
        `;
        
        // Solo MASTER ADMIN puede editar y activar/desactivar organizaciones
        if (window.isMasterAdmin) {
            botones += `
                <button onclick="editarOrganizacion('${org._id}')" class="btn btn-sm btn-warning me-1" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="toggleOrganizacion('${org._id}', ${org.activa})" class="btn btn-sm btn-${org.activa ? 'danger' : 'success'}" title="${org.activa ? 'Desactivar' : 'Activar'}">
                    <i class="fas fa-${org.activa ? 'ban' : 'check'}"></i>
                </button>
            `;
        }

        tbody.append(`
            <tr class="border-b border-gray-700 hover:bg-gray-700">
                <td class="px-6 py-4 font-medium text-white">${org.nombre}</td>
                <td class="px-6 py-4">${org.descripcion || '-'}</td>
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
            <div class="col-span-full text-center py-12 text-gray-400">
                <i class="fas fa-wallet text-6xl mb-4 opacity-50"></i>
                <p>No tienes cuentas creadas</p>
                <button class="btn btn-success btn-sm mt-3" data-bs-toggle="modal" data-bs-target="#modalCuenta">
                    <i class="fas fa-plus me-1"></i> Crear Primera Cuenta
                </button>
            </div>
        `);
        return;
    }

    cuentas.forEach(cuenta => {
        const saldo = cuenta.puedeVerSaldo !== false 
            ? formatearMoneda(cuenta.saldoActual || 0, cuenta.moneda)
            : '***';
        const icono = obtenerIconoCuenta(cuenta.tipoCuenta);
        const colorSaldo = cuenta.saldoActual >= 0 ? 'text-green-400' : 'text-red-400';
        
        // Obtener nombre de organización
        const nombreOrg = cuenta.organizacion?.nombre || 'Sin organización';

        grid.append(`
            <div class="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer" onclick="verDetalleCuenta('${cuenta._id}')">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center mr-3">
                            <i class="fas ${icono} text-blue-400"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-white">${cuenta.nombre}</h3>
                            <p class="text-xs text-gray-400">${cuenta.tipoCuenta}</p>
                            <p class="text-xs text-blue-400"><i class="fas fa-building me-1"></i>${nombreOrg}</p>
                        </div>
                    </div>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-${cuenta.activa ? 'green' : 'red'}-900 text-${cuenta.activa ? 'green' : 'red'}-300">
                        ${cuenta.activa ? 'Activa' : 'Inactiva'}
                    </span>
                </div>
                
                <div class="border-t border-gray-700 pt-4">
                    <p class="text-sm text-gray-400 mb-1">Saldo Actual</p>
                    ${cuenta.puedeVerSaldo !== false 
                        ? `<p class="text-2xl font-bold ${colorSaldo}">${saldo}</p>`
                        : `<p class="text-2xl font-bold text-gray-500"><i class="fas fa-lock me-2"></i>${saldo}</p>
                           <p class="text-xs text-gray-500 mt-1">No tienes permiso para ver el saldo</p>`
                    }
                </div>

                ${cuenta.descripcion ? `
                    <div class="mt-4 pt-4 border-gray-700">
                        <p class="text-sm text-gray-400">${cuenta.descripcion}</p>
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
        'background-color': '#374151',
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
    const colorSaldo = cuenta.saldoActual >= 0 ? 'text-green-400' : 'text-red-400';

    let html = `
        <div class="bg-gray-700 rounded-lg p-6 mb-4">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-2xl font-bold text-white">${cuenta.nombre}</h3>
                ${puedeVerSaldo 
                    ? `<span class="text-3xl font-bold ${colorSaldo}">${saldo}</span>`
                    : `<span class="text-3xl font-bold text-gray-500"><i class="fas fa-lock me-2"></i>${saldo}</span>`
                }
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                    <p class="text-gray-400">Tipo de Cuenta</p>
                    <p class="text-white font-semibold">${cuenta.tipoCuenta}</p>
                </div>
                <div>
                    <p class="text-gray-400">Moneda</p>
                    <p class="text-white font-semibold">${cuenta.moneda}</p>
                </div>
                ${puedeVerSaldo ? `
                    <div>
                        <p class="text-gray-400">Saldo Inicial</p>
                        <p class="text-white font-semibold">${formatearMoneda(cuenta.saldoInicial || 0, cuenta.moneda)}</p>
                    </div>
                ` : `
                    <div>
                        <p class="text-gray-400">Saldo Inicial</p>
                        <p class="text-gray-500"><i class="fas fa-lock me-2"></i>Oculto</p>
                    </div>
                `}
                <div>
                    <p class="text-gray-400">Estado</p>
                    <p class="text-white font-semibold">${cuenta.activa ? 'Activa' : 'Inactiva'}</p>
                </div>
            </div>
    `;

    // Datos bancarios si existen
    if (cuenta.datosBancarios && (cuenta.datosBancarios.beneficiario || cuenta.datosBancarios.banco)) {
        html += `
            <div class="mt-4 pt-4 border-t border-gray-600">
                <h4 class="text-lg font-semibold text-white mb-3">Datos Bancarios</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    ${cuenta.datosBancarios.beneficiario ? `
                        <div>
                            <p class="text-gray-400">Beneficiario</p>
                            <p class="text-white">${cuenta.datosBancarios.beneficiario}</p>
                        </div>
                    ` : ''}
                    ${cuenta.datosBancarios.banco ? `
                        <div>
                            <p class="text-gray-400">Banco</p>
                            <p class="text-white">${cuenta.datosBancarios.banco}</p>
                        </div>
                    ` : ''}
                    ${cuenta.datosBancarios.clabe ? `
                        <div>
                            <p class="text-gray-400">CLABE</p>
                            <p class="text-white font-mono">${cuenta.datosBancarios.clabe}</p>
                        </div>
                    ` : ''}
                    ${cuenta.datosBancarios.numeroCuenta ? `
                        <div>
                            <p class="text-gray-400">Número de Cuenta</p>
                            <p class="text-white font-mono">${cuenta.datosBancarios.numeroCuenta}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    html += `</div>`;

    // Sección de participantes
    html += `
        <div class="bg-gray-700 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
                <h4 class="text-lg font-semibold text-white">Participantes</h4>
                <button class="btn btn-sm btn-primary" onclick="abrirModalParticipantes('${cuenta._id}')">
                    <i class="fas fa-user-plus me-2"></i>Agregar Participante
                </button>
            </div>
            <div id="participantes-lista-${cuenta._id}">
                <p class="text-gray-400 text-sm">Cargando participantes...</p>
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
                <td colspan="8" class="px-6 py-4 text-center text-gray-400">
                    No hay solicitudes
                </td>
            </tr>
        `);
        return;
    }

    solicitudes.forEach(sol => {
        const fecha = new Date(sol.fecha).toLocaleDateString('es-MX');
        const monto = formatearMoneda(sol.monto, 'MXN');
        const tipoColor = sol.tipo === 'Ingreso' ? 'text-green-400' : 'text-red-400';
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
            <tr class="border-b border-gray-700 hover:bg-gray-700">
                <td class="px-6 py-4">${fecha}</td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-900 text-blue-300">
                        <i class="fas fa-wallet me-1"></i>${nombreCuenta}
                    </span>
                </td>
                <td class="px-6 py-4 ${tipoColor}">${sol.tipo}</td>
                <td class="px-6 py-4 font-medium text-white">${sol.concepto}</td>
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
        const response = await fetch('/api/sw/solicitudes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const data = await response.json();

        if (data.success) {
            mostrarExito('Solicitud creada exitosamente');
            $('#modalSolicitud').modal('hide');
            $('#formSolicitud')[0].reset();
            cargarSolicitudes();
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al crear solicitud');
    }
}

async function aprobarSolicitud(solicitudId) {
    const result = await Swal.fire({
        title: '¿Aprobar solicitud?',
        text: 'Esta acción creará una transacción en la cuenta',
        icon: 'question',
        input: 'textarea',
        inputLabel: 'Comentario (opcional)',
        inputPlaceholder: 'Agregar un comentario...',
        showCancelButton: true,
        confirmButtonText: 'Aprobar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        background: '#1f2937',
        color: '#f9fafb'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/sw/solicitudes/${solicitudId}/procesar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    accion: 'aprobar',
                    comentario: result.value || ''
                })
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
        background: '#1f2937',
        color: '#f9fafb'
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
        background: '#1f2937',
        color: '#f9fafb'
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
            mostrarExito('Transacción creada exitosamente');
            $('#modalTransaccion').modal('hide');
            $('#formTransaccion')[0].reset();
            cargarMisCuentas(); // Actualizar saldos
            
            // Si estamos en el tab de transacciones, recargarlas
            const tabActivo = $('.tab-button.active').data('tab');
            if (tabActivo === 'transacciones') {
                cargarTransacciones();
            }
        } else {
            mostrarError(data.message || 'Error al crear transacción');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError(error.message || 'Error al crear transacción');
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
    const tipoColor = solicitud.tipo === 'Ingreso' ? 'text-green-400' : 'text-red-400';
    
    let detalleHtml = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-gray-400 text-sm">Cuenta</p>
                    <p class="text-white font-semibold">${solicitud.cuenta?.nombre || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-400 text-sm">Estado</p>
                    <p class="text-white">${obtenerBadgeEstado(solicitud.estado)}</p>
                </div>
                <div>
                    <p class="text-gray-400 text-sm">Tipo</p>
                    <p class="${tipoColor} font-semibold">${solicitud.tipo}</p>
                </div>
                <div>
                    <p class="text-gray-400 text-sm">Monto</p>
                    <p class="${tipoColor} font-semibold text-lg">${monto}</p>
                </div>
                <div>
                    <p class="text-gray-400 text-sm">Fecha</p>
                    <p class="text-white">${fecha}</p>
                </div>
                <div>
                    <p class="text-gray-400 text-sm">Categoría</p>
                    <p class="text-white">${solicitud.categoria}</p>
                </div>
            </div>
            
            <div>
                <p class="text-gray-400 text-sm">Concepto</p>
                <p class="text-white font-semibold text-lg">${solicitud.concepto}</p>
            </div>
            
            ${solicitud.descripcion ? `
                <div>
                    <p class="text-gray-400 text-sm">Descripción</p>
                    <p class="text-white">${solicitud.descripcion}</p>
                </div>
            ` : ''}
            
            <div>
                <p class="text-gray-400 text-sm">Solicitado por</p>
                <p class="text-white">${solicitud.solicitadoPor?.firstName || 'N/A'} ${solicitud.solicitadoPor?.lastName || ''}</p>
            </div>
            
            ${solicitud.respuesta?.comentario ? `
                <div class="border-t border-gray-700 pt-4">
                    <p class="text-gray-400 text-sm">Respuesta del propietario</p>
                    <p class="text-white">${solicitud.respuesta.comentario}</p>
                    <p class="text-gray-400 text-xs mt-2">
                        ${solicitud.respuesta.procesadaPor?.firstName || ''} - 
                        ${new Date(solicitud.respuesta.fechaProcesada).toLocaleString('es-MX')}
                    </p>
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
        background: '#1f2937',
        color: '#f9fafb'
    });
}

// ===== TRANSACCIONES =====
async function cargarTransacciones() {
    const cuentaId = $('#filtro-cuenta-transacciones').val();
    
    // Si no hay cuenta seleccionada, mostrar mensaje
    if (!cuentaId && cuentas.length > 0) {
        $('#tabla-transacciones-body').html(`
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-400">
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
                <td colspan="7" class="px-6 py-4 text-center text-gray-400">
                    No hay transacciones en esta cuenta
                </td>
            </tr>
        `);
        return;
    }

    transacciones.forEach(trans => {
        const fecha = new Date(trans.fecha).toLocaleDateString('es-MX');
        const monto = formatearMoneda(trans.monto, 'MXN');
        const tipoColor = trans.tipo === 'Ingreso' ? 'text-green-400' : 'text-red-400';
        const estadoBadge = trans.aprobada ? 
            '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-300">Aprobada</span>' :
            '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-900 text-yellow-300">Pendiente</span>';

        tbody.append(`
            <tr class="border-b border-gray-700 hover:bg-gray-700">
                <td class="px-6 py-4">${fecha}</td>
                <td class="px-6 py-4 ${tipoColor}">${trans.tipo}</td>
                <td class="px-6 py-4 font-medium text-white">${trans.concepto}</td>
                <td class="px-6 py-4">${trans.categoria}</td>
                <td class="px-6 py-4 text-right font-semibold ${tipoColor}">${monto}</td>
                <td class="px-6 py-4">${estadoBadge}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="verDetalleTransaccion('${trans._id}')" class="btn btn-sm btn-info" title="Ver detalle">
                        <i class="fas fa-eye"></i>
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
        'Cancelada': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-600 text-gray-300">Cancelada</span>'
    };
    return badges[estado] || estado;
}

function mostrarExito(mensaje) {
    Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: mensaje,
        background: '#1f2937',
        color: '#f3f4f6',
        confirmButtonColor: '#3b82f6'
    });
}

function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        background: '#1f2937',
        color: '#f3f4f6',
        confirmButtonColor: '#ef4444'
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
            $(`#participantes-lista-${cuentaId}`).html(`<p class="text-red-400 text-sm">${data.message || 'Error al cargar participantes'}</p>`);
        }
    } catch (error) {
        console.error('Error al cargar participantes:', error);
        $(`#participantes-lista-${cuentaId}`).html('<p class="text-red-400 text-sm">Error al cargar participantes</p>');
    } finally {
        ocultarSpinner();
    }
}

function renderizarParticipantes(cuentaId) {
    const container = $(`#participantes-lista-${cuentaId}`);
    container.empty();

    if (participantes.length === 0) {
        container.html('<p class="text-gray-400 text-sm">No hay participantes agregados</p>');
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
            <div class="d-flex justify-content-between align-items-center p-3 mb-2 bg-gray-800 rounded border border-gray-600">
                <div>
                    <div class="fw-bold text-white">${nombre}</div>
                    <div class="text-sm text-gray-400">${rol}</div>
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
