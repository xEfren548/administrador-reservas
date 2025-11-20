// Estado global
let organizaciones = [];
let cuentas = [];
let transacciones = [];
let solicitudes = [];
let cuentaSeleccionada = null;

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
        const response = await fetch('/api/sw/cuentas/mis-cuentas');
        const data = await response.json();
        
        if (data.success) {
            cuentas = data.data;
            renderizarCuentas();
            actualizarSelectCuentas();
        }
    } catch (error) {
        console.error('Error al cargar cuentas:', error);
        mostrarError('Error al cargar cuentas');
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
        const saldo = formatearMoneda(cuenta.saldoActual, cuenta.moneda);
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
                    <p class="text-2xl font-bold ${colorSaldo}">${saldo}</p>
                </div>

                ${cuenta.descripcion ? `
                    <div class="mt-4 pt-4 border-t border-gray-700">
                        <p class="text-sm text-gray-400">${cuenta.descripcion}</p>
                    </div>
                ` : ''}

                <div class="mt-4 flex gap-2">
                    <button onclick="event.stopPropagation(); agregarTransaccion('${cuenta._id}')" class="btn btn-sm btn-primary flex-1" ${!cuenta.activa ? 'disabled' : ''}>
                        <i class="fas fa-plus me-1"></i> Transacción
                    </button>
                    <button onclick="event.stopPropagation(); editarCuenta('${cuenta._id}')" class="btn btn-sm btn-warning">
                        <i class="fas fa-edit"></i>
                    </button>
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
        const response = await fetch(`/api/sw/cuentas/${id}`);
        const data = await response.json();
        
        if (data.success) {
            mostrarDetalleCuenta(data.data);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar detalle de cuenta');
    }
}

function mostrarDetalleCuenta(cuenta) {
    const saldo = formatearMoneda(cuenta.saldoActual, cuenta.moneda);
    const colorSaldo = cuenta.saldoActual >= 0 ? 'text-green-400' : 'text-red-400';

    let html = `
        <div class="bg-gray-700 rounded-lg p-6 mb-4">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-2xl font-bold text-white">${cuenta.nombre}</h3>
                <span class="text-3xl font-bold ${colorSaldo}">${saldo}</span>
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
                <div>
                    <p class="text-gray-400">Saldo Inicial</p>
                    <p class="text-white font-semibold">${formatearMoneda(cuenta.saldoInicial, cuenta.moneda)}</p>
                </div>
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

    // Participantes (se cargarían de una API adicional)
    html += `
        <div class="bg-gray-700 rounded-lg p-6">
            <h4 class="text-lg font-semibold text-white mb-3">Participantes</h4>
            <p class="text-gray-400 text-sm">Funcionalidad de participantes próximamente...</p>
        </div>
    `;

    $('#detalleCuentaNombre').text(cuenta.nombre);
    $('#detalleCuentaContent').html(html);
    $('#modalDetalleCuenta').modal('show');
}

// ===== SOLICITUDES =====
async function cargarSolicitudes() {
    try {
        const response = await fetch('/api/sw/solicitudes/mis-solicitudes');
        const data = await response.json();
        
        if (data.success) {
            solicitudes = data.data;
            renderizarSolicitudes();
        }
    } catch (error) {
        console.error('Error al cargar solicitudes:', error);
        mostrarError('Error al cargar solicitudes');
    }
}

function renderizarSolicitudes() {
    const tbody = $('#tabla-solicitudes-body');
    tbody.empty();

    if (solicitudes.length === 0) {
        tbody.html(`
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-400">
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

        tbody.append(`
            <tr class="border-b border-gray-700 hover:bg-gray-700">
                <td class="px-6 py-4">${fecha}</td>
                <td class="px-6 py-4 ${tipoColor}">${sol.tipo}</td>
                <td class="px-6 py-4 font-medium text-white">${sol.concepto}</td>
                <td class="px-6 py-4">${sol.solicitadoPor?.firstName || 'N/A'} ${sol.solicitadoPor?.lastName || ''}</td>
                <td class="px-6 py-4 text-right font-semibold ${tipoColor}">${monto}</td>
                <td class="px-6 py-4">${estadoBadge}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="verDetalleSolicitud('${sol._id}')" class="btn btn-sm btn-info" title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${sol.estado === 'Pendiente' ? `
                        <button onclick="cancelarSolicitud('${sol._id}')" class="btn btn-sm btn-danger ms-1" title="Cancelar">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
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
        const response = await fetch(`/api/sw/transacciones/cuenta/${cuentaId}`);
        const data = await response.json();
        
        if (data.success) {
            transacciones = data.data;
            renderizarTransacciones();
        }
    } catch (error) {
        console.error('Error al cargar transacciones:', error);
        mostrarError('Error al cargar transacciones');
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
$('#modalOrganizacion, #modalCuenta, #modalSolicitud').on('hidden.bs.modal', function() {
    $(this).find('form')[0].reset();
    $(this).find('input[type="hidden"]').val('');
    $(this).find('.modal-title').text($(this).find('.modal-title').text().replace('Editar', 'Nueva'));
});
