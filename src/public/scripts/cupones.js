// Estado global
let cupones = [];
let referidos = [];
let habitaciones = [];
let cuponSeleccionado = null;
let paginaActual = 1;
let totalPaginas = 1;
let filtrosCupones = {};
let chartUsosMes = null;
let chartDescuentosMes = null;
let chartReferidosMes = null;

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

// Mostrar toast de notificación
function mostrarToast(mensaje, tipo = 'success') {
    // Crear elemento de toast si no existe
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-50';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `mb-3 p-4 rounded-lg shadow-lg ${
        tipo === 'success' ? 'bg-green-500' : tipo === 'error' ? 'bg-red-500' : 'bg-blue-500'
    } text-white transform transition-all duration-300`;
    toast.textContent = mensaje;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    inicializarEventos();
    cargarDashboard();
    cargarHabitaciones();
});

// ===== NAVEGACIÓN ENTRE TABS =====
function inicializarEventos() {
    // Navegación de tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.dataset.tab;
            cambiarTab(tab);
        });
    });

    // Botones principales
    document.getElementById('btn-nuevo-cupon')?.addEventListener('click', abrirModalNuevoCupon);
    document.getElementById('btn-exportar-cupones')?.addEventListener('click', exportarCupones);
    document.getElementById('btn-guardar-cupon')?.addEventListener('click', guardarCupon);
    document.getElementById('btn-exportar-referidos')?.addEventListener('click', exportarReferidos);

    // Filtros dashboard
    document.getElementById('btn-aplicar-filtro-dashboard')?.addEventListener('click', aplicarFiltroDashboard);
    document.getElementById('btn-limpiar-filtro-dashboard')?.addEventListener('click', limpiarFiltroDashboard);

    // Filtros cupones
    document.getElementById('buscar-cupon')?.addEventListener('input', debounce(filtrarCupones, 500));
    document.getElementById('filtro-tipo')?.addEventListener('change', filtrarCupones);
    document.getElementById('filtro-activo')?.addEventListener('change', filtrarCupones);
    document.getElementById('filtro-vigente')?.addEventListener('change', filtrarCupones);

    // Filtros referidos
    document.getElementById('filtro-tipo-cuenta')?.addEventListener('change', () => cargarReferidos());
    document.getElementById('filtro-activo-cuenta')?.addEventListener('change', () => cargarReferidos());

    // Botones referidos
    document.getElementById('btn-nueva-cuenta-referido')?.addEventListener('click', abrirModalNuevaCuentaReferido);
    document.getElementById('btn-guardar-cuenta-referido')?.addEventListener('click', guardarCuentaReferido);
    document.getElementById('btn-exportar-cuentas')?.addEventListener('click', exportarCuentasReferidos);

    // Modal cupón
    document.getElementById('cupon-tipo')?.addEventListener('change', actualizarHelpTextoValor);
    document.getElementById('cupon-todas-cabanas')?.addEventListener('change', toggleSelectorHabitaciones);
    document.getElementById('buscar-habitaciones-cupon')?.addEventListener('input', filtrarHabitacionesCupon);

    // Modal cupón referido
    document.getElementById('cupon-referido-tipo')?.addEventListener('change', actualizarHelpTextoValorReferido);
    document.getElementById('cupon-referido-todas-cabanas')?.addEventListener('change', toggleSelectorHabitacionesReferido);
    document.getElementById('buscar-habitaciones-referido')?.addEventListener('input', filtrarHabitacionesReferido);

    // Cambio de tipo de comisión
    document.getElementById('comision-tipo')?.addEventListener('change', function() {
        const hint = document.getElementById('comision-hint');
        if (this.value === 'percentage') {
            hint.textContent = 'Ejemplo: 10 para 10% del monto original de la reserva';
        } else {
            hint.textContent = 'Ejemplo: 100 para $100 por cada uso del cupón';
        }
    });

    // Limpiar backdrop al cerrar modales
    document.getElementById('modalCupon')?.addEventListener('hidden.bs.modal', function () {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    document.getElementById('modalCuentaReferido')?.addEventListener('hidden.bs.modal', function () {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    document.getElementById('modalEstadisticas')?.addEventListener('hidden.bs.modal', function () {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });
}

function cambiarTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.classList.add('hidden');
    });

    // Desactivar todos los botones
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active', 'border-purple-500', 'text-purple-600');
        button.classList.add('border-transparent', 'text-gray-500');
    });

    // Activar tab seleccionado
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabContent) {
        tabContent.classList.remove('hidden');
        tabContent.classList.add('active');
    }

    // Activar botón seleccionado
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active', 'border-purple-500', 'text-purple-600');
        activeButton.classList.remove('border-transparent', 'text-gray-500');
    }

    // Cargar datos según el tab
    switch (tabName) {
        case 'dashboard':
            cargarDashboard();
            break;
        case 'cupones':
            cargarCupones();
            break;
        case 'referidos':
            cargarReferidos();
            break;
    }
}

// ===== DASHBOARD =====
async function cargarDashboard() {
    try {
        mostrarSpinner();

        const fechaDesde = document.getElementById('dashboard-fecha-desde')?.value;
        const fechaHasta = document.getElementById('dashboard-fecha-hasta')?.value;

        let url = '/api/cupones/dashboard/datos';
        const params = new URLSearchParams();
        if (fechaDesde) params.append('fechaInicio', fechaDesde);
        if (fechaHasta) params.append('fechaFin', fechaHasta);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            actualizarTarjetasDashboard(result.data.resumen);
            actualizarGraficaUsosMes(result.data.usosPorMes);
            actualizarGraficaDescuentosMes(result.data.usosPorMes);
            actualizarTablaCuponesPopulares(result.data.cuponesPopulares);
        }
    } catch (error) {
        console.error('Error al cargar dashboard:', error);
        mostrarToast('Error al cargar dashboard', 'error');
    } finally {
        ocultarSpinner();
    }
}

function actualizarTarjetasDashboard(resumen) {
    document.getElementById('dashboard-total-cupones').textContent = resumen.totalCupones || 0;
    document.getElementById('dashboard-cupones-activos').textContent = resumen.cuponesActivos || 0;
    document.getElementById('dashboard-total-usos').textContent = resumen.totalUsos || 0;
    document.getElementById('dashboard-total-descuentos').textContent = 
        '$' + parseFloat(resumen.totalDescuentos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
}

function actualizarGraficaUsosMes(datos) {
    const ctx = document.getElementById('chart-usos-mes');
    if (!ctx) return;

    const labels = datos.map(d => d.mes);
    const valores = datos.map(d => d.usos);

    if (chartUsosMes) {
        chartUsosMes.destroy();
    }

    chartUsosMes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Usos',
                data: valores,
                backgroundColor: 'rgba(147, 51, 234, 0.5)',
                borderColor: 'rgba(147, 51, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function actualizarGraficaDescuentosMes(datos) {
    const ctx = document.getElementById('chart-descuentos-mes');
    if (!ctx) return;

    const labels = datos.map(d => d.mes);
    const valores = datos.map(d => d.descuentos);

    if (chartDescuentosMes) {
        chartDescuentosMes.destroy();
    }

    chartDescuentosMes = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Descuentos ($)',
                data: valores,
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                borderColor: 'rgba(249, 115, 22, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('es-MX');
                        }
                    }
                }
            }
        }
    });
}

function actualizarTablaCuponesPopulares(cupones) {
    const tbody = document.getElementById('tabla-cupones-populares');
    if (!tbody) return;

    tbody.innerHTML = cupones.map(cupon => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${cupon.codigo || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cupon.nombre || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cupon.usos || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$${parseFloat(cupon.totalDescuentos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        </tr>
    `).join('');

    if (cupones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">No hay datos disponibles</td></tr>';
    }
}

function aplicarFiltroDashboard() {
    cargarDashboard();
}

function limpiarFiltroDashboard() {
    document.getElementById('dashboard-fecha-desde').value = '';
    document.getElementById('dashboard-fecha-hasta').value = '';
    cargarDashboard();
}

// ===== GESTIÓN DE CUPONES =====
async function cargarCupones(pagina = 1) {
    try {
        mostrarSpinner();
        paginaActual = pagina;

        const params = new URLSearchParams({
            page: pagina,
            limit: 20,
            ...filtrosCupones
        });

        const response = await fetch(`/api/cupones?${params}`);
        const result = await response.json();

        if (result.success) {
            cupones = result.data;
            actualizarTablaCupones(result.data);
            actualizarPaginacion(result.pagination);
        }
    } catch (error) {
        console.error('Error al cargar cupones:', error);
        mostrarToast('Error al cargar cupones', 'error');
    } finally {
        ocultarSpinner();
    }
}

function actualizarTablaCupones(cupones) {
    const tbody = document.getElementById('tabla-cupones');
    if (!tbody) return;

    tbody.innerHTML = cupones.map(cupon => {
        const tipoTexto = cupon.tipo === 'percentage' ? 'Porcentaje' : 
                         cupon.tipo === 'fixed_amount' ? 'Monto Fijo' : 'Noches Gratis';
        const valorTexto = cupon.tipo === 'percentage' ? `${cupon.valor}%` : 
                          cupon.tipo === 'fixed_amount' ? `$${cupon.valor}` : cupon.valor;
        const usosTexto = cupon.usosLimitados ? `${cupon.usosActuales}/${cupon.usosLimitados}` : cupon.usosActuales;
        const vigenciaTexto = `${moment.utc(cupon.fechaInicio).format('D/M/YYYY')} - ${moment.utc(cupon.fechaFin).format('D/M/YYYY')}`;
        
        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${cupon.codigo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cupon.nombre}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tipoTexto}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${valorTexto}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${usosTexto}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vigenciaTexto}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="badge ${cupon.activo ? 'badge-success' : 'badge-danger'}">
                        ${cupon.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="verEstadisticas('${cupon._id}')" class="text-blue-600 hover:text-blue-900 me-3" title="Ver estadísticas">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                    <button onclick="editarCupon('${cupon._id}')" class="text-indigo-600 hover:text-indigo-900 me-3" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="toggleActivoCupon('${cupon._id}', ${cupon.activo})" class="text-${cupon.activo ? 'yellow' : 'green'}-600 hover:text-${cupon.activo ? 'yellow' : 'green'}-900 me-3" title="${cupon.activo ? 'Desactivar' : 'Activar'}">
                        <i class="fas fa-${cupon.activo ? 'pause' : 'play'}-circle"></i>
                    </button>
                    <button onclick="eliminarCupon('${cupon._id}')" class="text-red-600 hover:text-red-900" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (cupones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">No se encontraron cupones</td></tr>';
    }
}

function actualizarPaginacion(pagination) {
    totalPaginas = pagination.totalPages;
    
    document.getElementById('showing-from').textContent = ((pagination.page - 1) * pagination.limit) + 1;
    document.getElementById('showing-to').textContent = Math.min(pagination.page * pagination.limit, pagination.total);
    document.getElementById('total-cupones').textContent = pagination.total;

    const controls = document.getElementById('pagination-controls');
    if (!controls) return;

    let html = '';

    // Botón anterior
    html += `
        <button onclick="cargarCupones(${pagination.page - 1})" 
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${pagination.page === 1 ? 'cursor-not-allowed opacity-50' : ''}"
                ${pagination.page === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
            html += `
                <button onclick="cargarCupones(${i})" 
                        class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${i === pagination.page ? 'bg-purple-50 border-purple-500 text-purple-600' : 'text-gray-700 hover:bg-gray-50'}">
                    ${i}
                </button>
            `;
        } else if (i === pagination.page - 3 || i === pagination.page + 3) {
            html += `
                <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                    ...
                </span>
            `;
        }
    }

    // Botón siguiente
    html += `
        <button onclick="cargarCupones(${pagination.page + 1})" 
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${pagination.page === totalPaginas ? 'cursor-not-allowed opacity-50' : ''}"
                ${pagination.page === totalPaginas ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    controls.innerHTML = html;
}

function filtrarCupones() {
    const buscar = document.getElementById('buscar-cupon')?.value;
    const tipo = document.getElementById('filtro-tipo')?.value;
    const activo = document.getElementById('filtro-activo')?.value;
    const vigente = document.getElementById('filtro-vigente')?.value;

    filtrosCupones = {};
    if (buscar) filtrosCupones.buscar = buscar;
    if (tipo) filtrosCupones.tipo = tipo;
    if (activo) filtrosCupones.activo = activo;
    if (vigente) filtrosCupones.vigente = vigente;

    cargarCupones(1);
}

// ===== MODAL CUPÓN =====
function abrirModalNuevoCupon() {
    document.getElementById('form-cupon').reset();
    document.getElementById('cupon-id').value = '';
    document.getElementById('modalCuponLabel').textContent = 'Nuevo Cupón';
    document.getElementById('cupon-todas-cabanas').checked = true;
    document.getElementById('selector-habitaciones').style.display = 'none';
    
    // Limpiar checkboxes de habitaciones
    const checkboxes = document.querySelectorAll('.checkbox-habitacion-cupon');
    checkboxes.forEach(cb => cb.checked = false);
    actualizarContadorHabitaciones();
    
    const modal = new bootstrap.Modal(document.getElementById('modalCupon'));
    modal.show();
}

async function editarCupon(id) {
    try {
        mostrarSpinner();
        const response = await fetch(`/api/cupones/${id}`);
        const result = await response.json();

        if (result.success) {
            const cupon = result.data.cupon;
            
            document.getElementById('cupon-id').value = cupon._id;
            document.getElementById('cupon-nombre').value = cupon.nombre;
            document.getElementById('cupon-codigo').value = cupon.codigo;
            document.getElementById('cupon-tipo').value = cupon.tipo;
            document.getElementById('cupon-valor').value = cupon.valor;
            document.getElementById('cupon-aplicable-a').value = cupon.aplicableA;
            document.getElementById('cupon-fecha-inicio').value = cupon.fechaInicio.split('T')[0];
            document.getElementById('cupon-fecha-fin').value = cupon.fechaFin.split('T')[0];
            document.getElementById('cupon-usos-limitados').value = cupon.usosLimitados || '';
            document.getElementById('cupon-monto-minimo').value = cupon.montoMinimoCompra || 0;
            document.getElementById('cupon-descuento-maximo').value = cupon.descuentoMaximo || '';
            document.getElementById('cupon-todas-cabanas').checked = cupon.todasCabanas;
            document.getElementById('cupon-descripcion').value = cupon.descripcion || '';

            if (cupon.restricciones) {
                document.getElementById('cupon-noches-minimas').value = cupon.restricciones.nochesMinimas || '';
                document.getElementById('cupon-noches-maximas').value = cupon.restricciones.nochesMaximas || '';
            }

            if (!cupon.todasCabanas) {
                document.getElementById('selector-habitaciones').style.display = 'block';
                const checkboxes = document.querySelectorAll('.checkbox-habitacion-cupon');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = cupon.habitaciones.some(h => h._id === checkbox.value);
                });
                actualizarContadorHabitaciones();
            }

            document.getElementById('modalCuponLabel').textContent = 'Editar Cupón';
            const modal = new bootstrap.Modal(document.getElementById('modalCupon'));
            modal.show();
        }
    } catch (error) {
        console.error('Error al cargar cupón:', error);
        mostrarToast('Error al cargar cupón', 'error');
    } finally {
        ocultarSpinner();
    }
}

async function guardarCupon() {
    try {
        const id = document.getElementById('cupon-id').value;
        const todasCabanas = document.getElementById('cupon-todas-cabanas').checked;
        
        const data = {
            nombre: document.getElementById('cupon-nombre').value,
            codigo: document.getElementById('cupon-codigo').value.toUpperCase(),
            tipo: document.getElementById('cupon-tipo').value,
            valor: parseFloat(document.getElementById('cupon-valor').value),
            aplicableA: document.getElementById('cupon-aplicable-a').value,
            fechaInicio: document.getElementById('cupon-fecha-inicio').value,
            fechaFin: document.getElementById('cupon-fecha-fin').value,
            todasCabanas: todasCabanas,
            descripcion: document.getElementById('cupon-descripcion').value,
            montoMinimoCompra: parseFloat(document.getElementById('cupon-monto-minimo').value) || 0,
            restricciones: {
                nochesMinimas: parseInt(document.getElementById('cupon-noches-minimas').value) || null,
                nochesMaximas: parseInt(document.getElementById('cupon-noches-maximas').value) || null
            }
        };

        if (document.getElementById('cupon-usos-limitados').value) {
            data.usosLimitados = parseInt(document.getElementById('cupon-usos-limitados').value);
        }

        if (document.getElementById('cupon-descuento-maximo').value) {
            data.descuentoMaximo = parseFloat(document.getElementById('cupon-descuento-maximo').value);
        }

        if (!todasCabanas) {
            const checkboxes = document.querySelectorAll('.checkbox-habitacion-cupon:checked');
            data.habitaciones = Array.from(checkboxes).map(cb => cb.value);
        }

        if (id) {
            data.id = id;
        }

        mostrarSpinner();

        const url = id ? '/api/cupones' : '/api/cupones';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            mostrarToast(id ? 'Cupón actualizado exitosamente' : 'Cupón creado exitosamente', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalCupon')).hide();
            cargarCupones(paginaActual);
        } else {
            mostrarToast(result.message || 'Error al guardar cupón', 'error');
        }
    } catch (error) {
        console.error('Error al guardar cupón:', error);
        mostrarToast('Error al guardar cupón', 'error');
    } finally {
        ocultarSpinner();
    }
}

async function toggleActivoCupon(id, estadoActual) {
    try {
        const accion = estadoActual ? 'desactivar' : 'activar';
        if (!confirm(`¿Está seguro de ${accion} este cupón?`)) return;

        mostrarSpinner();
        const response = await fetch(`/api/cupones/${id}/toggle`, {
            method: 'PATCH'
        });

        const result = await response.json();

        if (result.success) {
            mostrarToast(`Cupón ${accion}do exitosamente`, 'success');
            cargarCupones(paginaActual);
        } else {
            mostrarToast(result.message || `Error al ${accion} cupón`, 'error');
        }
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        mostrarToast('Error al cambiar estado del cupón', 'error');
    } finally {
        ocultarSpinner();
    }
}

async function eliminarCupon(id) {
    try {
        if (!confirm('¿Está seguro de eliminar este cupón? Se desactivará permanentemente.')) return;

        mostrarSpinner();
        const response = await fetch('/api/cupones', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });

        const result = await response.json();

        if (result.success) {
            mostrarToast('Cupón eliminado exitosamente', 'success');
            cargarCupones(paginaActual);
        } else {
            mostrarToast(result.message || 'Error al eliminar cupón', 'error');
        }
    } catch (error) {
        console.error('Error al eliminar cupón:', error);
        mostrarToast('Error al eliminar cupón', 'error');
    } finally {
        ocultarSpinner();
    }
}

async function verEstadisticas(id) {
    try {
        mostrarSpinner();
        const response = await fetch(`/api/cupones/${id}/estadisticas`);
        const result = await response.json();

        if (result.success) {
            mostrarModalEstadisticas(result.data);
        }
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        mostrarToast('Error al cargar estadísticas', 'error');
    } finally {
        ocultarSpinner();
    }
}

function mostrarModalEstadisticas(data) {
    const contenido = document.getElementById('contenido-estadisticas');
    
    const html = `
        <div class="mb-4">
            <h6 class="font-semibold">Cupón: ${data.cupon.codigo} - ${data.cupon.nombre}</h6>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-gray-50 p-4 rounded">
                <p class="text-sm text-gray-600">Usos Actuales</p>
                <p class="text-2xl font-bold">${data.estadisticas.usosActuales}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded">
                <p class="text-sm text-gray-600">Usos Disponibles</p>
                <p class="text-2xl font-bold">${data.estadisticas.usosDisponibles}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded">
                <p class="text-sm text-gray-600">Total Descuentos</p>
                <p class="text-2xl font-bold">$${parseFloat(data.estadisticas.totalDescuentos).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
        </div>

        <h6 class="font-semibold mb-3">Últimos Usos</h6>
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">Cliente</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">Descuento</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${data.usos.map(uso => `
                        <tr>
                            <td class="px-4 py-2 text-sm">${uso.clienteWeb ? `${uso.clienteWeb.firstName} ${uso.clienteWeb.lastName}` : uso.cliente ? `${uso.cliente.firstName} ${uso.cliente.lastName}` : 'N/A'}</td>
                            <td class="px-4 py-2 text-sm">${new Date(uso.fechaUso).toLocaleDateString('es-MX')}</td>
                            <td class="px-4 py-2 text-sm">$${parseFloat(uso.montoDescuento).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    contenido.innerHTML = html;
    const modal = new bootstrap.Modal(document.getElementById('modalEstadisticas'));
    modal.show();
}

// ===== REFERIDOS - CUENTAS =====
async function cargarReferidos() {
    try {
        mostrarSpinner();
        
        // Cargar estadísticas
        const responseStats = await fetch('/api/referidos/estadisticas');
        const resultStats = await responseStats.json();

        if (resultStats.success) {
            actualizarTarjetasEstadisticasReferidos(resultStats.data);
        }

        // Cargar cuentas
        const filtroTipo = document.getElementById('filtro-tipo-cuenta')?.value;
        const filtroActivo = document.getElementById('filtro-activo-cuenta')?.value;

        const params = new URLSearchParams({ page: 1, limit: 100 });
        if (filtroTipo) params.append('tipo', filtroTipo);
        if (filtroActivo) params.append('activo', filtroActivo);

        const responseCuentas = await fetch(`/api/referidos/cuentas?${params}`);
        const resultCuentas = await responseCuentas.json();

        if (resultCuentas.success) {
            actualizarTablaCuentasReferidos(resultCuentas.data);
            await cargarHistorialReferidos();
        }
    } catch (error) {
        console.error('Error al cargar referidos:', error);
        mostrarToast('Error al cargar referidos', 'error');
    } finally {
        ocultarSpinner();
    }
}

function actualizarTarjetasEstadisticasReferidos(data) {
    document.getElementById('stats-total-cuentas').textContent = data.totalCuentas || 0;
    document.getElementById('stats-cuentas-activas').textContent = data.cuentasActivas || 0;
    document.getElementById('stats-usos-totales').textContent = data.usosTotales || 0;
    document.getElementById('stats-comision-total').textContent = 
        '$' + parseFloat(data.comisionTotalGeneral || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
}

function actualizarTablaCuentasReferidos(cuentas) {
    const tbody = document.getElementById('tabla-cuentas-referidos');
    if (!tbody) return;

    tbody.innerHTML = cuentas.map(cuenta => {
        const tipoTexto = {
            'influencer': 'Influencer',
            'marca': 'Marca',
            'afiliado': 'Afiliado',
            'otro': 'Otro'
        }[cuenta.tipo] || cuenta.tipo;

        const comisionTexto = cuenta.comisionReferidor.tipo === 'percentage' 
            ? `${cuenta.comisionReferidor.valor}%`
            : `$${cuenta.comisionReferidor.valor}`;

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${cuenta.nombre}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="badge badge-info">${tipoTexto}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cuenta.celular || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                    ${cuenta.cupon ? cuenta.cupon.codigo : 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${comisionTexto}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${cuenta.estadisticas?.totalUsos || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    $${parseFloat(cuenta.estadisticas?.comisionTotal || 0).toFixed(2)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="badge ${cuenta.activo ? 'badge-success' : 'badge-danger'}">
                        ${cuenta.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button onclick="toggleActivoCuentaReferido('${cuenta._id}')" 
                        class="btn btn-sm ${cuenta.activo ? 'btn-warning' : 'btn-success'} me-1" 
                        title="${cuenta.activo ? 'Desactivar' : 'Activar'}">
                        <i class="fas fa-${cuenta.activo ? 'ban' : 'check'}"></i>
                    </button>
                    <button onclick="verDetalleCuentaReferido('${cuenta._id}')" 
                        class="btn btn-sm btn-info" 
                        title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (cuentas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-sm text-gray-500">No se encontraron cuentas de referidos</td></tr>';
    }
}

async function cargarHistorialReferidos() {
    try {
        // Obtener todos los usos de cupones de referidos
        const response = await fetch('/api/cupones/usos?esReferido=true&limit=100');
        const result = await response.json();

        if (result.success) {
            actualizarTablaHistorialReferidos(result.data);
        }
    } catch (error) {
        console.error('Error al cargar historial:', error);
    }
}

function actualizarTablaHistorialReferidos(usos) {
    const tbody = document.getElementById('tabla-historial-referidos');
    if (!tbody) return;

    tbody.innerHTML = usos.map(uso => {
        const cliente = uso.cliente 
            ? `${uso.cliente.firstName} ${uso.cliente.lastName}`
            : uso.clienteWeb 
            ? `${uso.clienteWeb.firstName} ${uso.clienteWeb.lastName}`
            : 'N/A';

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(uso.fechaUso).toLocaleDateString('es-MX')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${uso.cupon?.cuentaReferido?.nombre || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                    ${uso.cupon?.codigo || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cliente}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${uso.habitacion?.propertyDetails?.name || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    $${parseFloat(uso.montoOriginal).toFixed(2)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                    -$${parseFloat(uso.montoDescuento).toFixed(2)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    $${parseFloat(uso.montoFinal).toFixed(2)}
                </td>
            </tr>
        `;
    }).join('');

    if (usos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">No hay usos de cupones de referido</td></tr>';
    }
}

function abrirModalNuevaCuentaReferido() {
    document.getElementById('form-cuenta-referido').reset();
    document.getElementById('cuenta-id').value = '';
    document.getElementById('modalCuentaReferidoLabel').textContent = 'Nueva Cuenta de Referido';
    
    // Establecer fecha de inicio como hoy
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('cupon-referido-fecha-inicio').value = hoy;
    
    // Resetear checkboxes
    document.getElementById('cupon-referido-todas-cabanas').checked = true;
    document.getElementById('selector-habitaciones-referido').style.display = 'none';
    
    // Cargar habitaciones
    cargarHabitacionesReferido();
    
    const modal = new bootstrap.Modal(document.getElementById('modalCuentaReferido'));
    modal.show();
}

async function guardarCuentaReferido() {
    try {
        const form = document.getElementById('form-cuenta-referido');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Obtener habitaciones seleccionadas si no son todas
        const todasCabanas = document.getElementById('cupon-referido-todas-cabanas').checked;
        let habitaciones = [];
        if (!todasCabanas) {
            const checkboxes = document.querySelectorAll('.checkbox-habitacion-referido:checked');
            habitaciones = Array.from(checkboxes).map(cb => cb.value);
            
            if (habitaciones.length === 0) {
                mostrarToast('Debe seleccionar al menos una habitación si no aplica a todas las cabañas', 'error');
                return;
            }
        }

        const data = {
            // Datos de cuenta
            nombre: document.getElementById('cuenta-nombre').value,
            celular: document.getElementById('cuenta-celular').value,
            tipo: document.getElementById('cuenta-tipo').value,
            notas: document.getElementById('cuenta-notas').value,
            comisionReferidor: {
                tipo: document.getElementById('comision-tipo').value,
                valor: parseFloat(document.getElementById('comision-valor').value)
            },
            // Datos de cupón
            nombreCupon: document.getElementById('cupon-referido-nombre').value,
            codigoCupon: document.getElementById('cupon-referido-codigo').value,
            tipoCupon: document.getElementById('cupon-referido-tipo').value,
            valorCupon: parseFloat(document.getElementById('cupon-referido-valor').value),
            aplicableA: document.getElementById('cupon-referido-aplicable').value,
            fechaInicio: document.getElementById('cupon-referido-fecha-inicio').value,
            fechaFin: document.getElementById('cupon-referido-fecha-fin').value,
            usosLimitados: parseInt(document.getElementById('cupon-referido-usos').value) || null,
            montoMinimoCompra: parseFloat(document.getElementById('cupon-referido-monto-min').value) || 0,
            descuentoMaximo: parseFloat(document.getElementById('cupon-referido-descuento-max').value) || null,
            todasCabanas: todasCabanas,
            habitaciones: habitaciones,
            restricciones: {
                nochesMinimas: parseInt(document.getElementById('cupon-referido-noches-minimas').value) || null,
                nochesMaximas: parseInt(document.getElementById('cupon-referido-noches-maximas').value) || null
            },
            descripcionCupon: document.getElementById('cupon-referido-descripcion').value
        };

        mostrarSpinner();
        const response = await fetch('/api/referidos/cuentas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            mostrarToast('Cuenta de referido creada exitosamente', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalCuentaReferido')).hide();
            cargarReferidos();
        } else {
            mostrarToast(result.message || 'Error al crear cuenta', 'error');
        }
    } catch (error) {
        console.error('Error al guardar cuenta:', error);
        mostrarToast('Error al guardar cuenta de referido', 'error');
    } finally {
        ocultarSpinner();
    }
}

async function toggleActivoCuentaReferido(id) {
    if (!confirm('¿Está seguro de cambiar el estado de esta cuenta?')) return;

    try {
        mostrarSpinner();
        const response = await fetch(`/api/referidos/cuentas/${id}/toggle`, {
            method: 'PATCH'
        });

        const result = await response.json();

        if (result.success) {
            mostrarToast('Estado actualizado exitosamente', 'success');
            cargarReferidos();
        } else {
            mostrarToast(result.message || 'Error al actualizar estado', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al actualizar estado', 'error');
    } finally {
        ocultarSpinner();
    }
}

async function verDetalleCuentaReferido(id) {
    try {
        mostrarSpinner();
        const response = await fetch(`/api/referidos/cuentas/${id}`);
        const result = await response.json();

        if (result.success) {
            const { cuenta, usos, estadisticas } = result.data;
            
            // Mostrar modal o alert con la información
            alert(`
Cuenta: ${cuenta.nombre}
Tipo: ${cuenta.tipo}
Código Cupón: ${cuenta.cupon?.codigo || 'N/A'}
Total Usos: ${estadisticas.totalUsos}
Total Descuentos: $${estadisticas.totalDescuentos.toFixed(2)}
Comisión Total: $${estadisticas.comisionTotal.toFixed(2)}
            `);
        } else {
            mostrarToast(result.message || 'Error al obtener detalle', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al obtener detalle', 'error');
    } finally {
        ocultarSpinner();
    }
}

async function exportarCuentasReferidos() {
    try {
        const filtroTipo = document.getElementById('filtro-tipo-cuenta')?.value;
        const filtroActivo = document.getElementById('filtro-activo-cuenta')?.value;

        const params = new URLSearchParams();
        if (filtroTipo) params.append('tipo', filtroTipo);
        if (filtroActivo) params.append('activo', filtroActivo);

        window.location.href = `/api/referidos/exportar-csv?${params}`;
        mostrarToast('Exportando cuentas...', 'success');
    } catch (error) {
        console.error('Error al exportar:', error);
        mostrarToast('Error al exportar cuentas', 'error');
    }
}

// ===== EXPORTAR =====
async function exportarCupones() {
    try {
        const params = new URLSearchParams(filtrosCupones);
        window.location.href = `/api/cupones/exportar-csv?${params}`;
        mostrarToast('Exportando cupones...', 'success');
    } catch (error) {
        console.error('Error al exportar:', error);
        mostrarToast('Error al exportar cupones', 'error');
    }
}

// ===== HELPERS =====
async function cargarHabitaciones() {
    try {
        const response = await fetch('/api/habitaciones');
        const result = await response.json();

        if (result.success || Array.isArray(result)) {
            habitaciones = Array.isArray(result) ? result : result.data;
            const container = document.getElementById('cupon-habitaciones-list');
            if (container) {
                container.innerHTML = habitaciones.map(hab => `
                    <div class="form-check habitacion-item-cupon" data-name="${hab.propertyDetails?.name || hab.name || 'Sin nombre'}" style="margin-bottom: 0.5rem;">
                        <input class="form-check-input checkbox-habitacion-cupon" type="checkbox" id="hab-${hab._id}" value="${hab._id}" />
                        <label class="form-check-label" for="hab-${hab._id}">${hab.propertyDetails?.name || hab.name || 'Sin nombre'}</label>
                    </div>
                `).join('');
                
                // Event listeners para actualizar contador
                const checkboxes = container.querySelectorAll('.checkbox-habitacion-cupon');
                checkboxes.forEach(cb => {
                    cb.addEventListener('change', actualizarContadorHabitaciones);
                });
            }
        }
    } catch (error) {
        console.error('Error al cargar habitaciones:', error);
    }
}

async function cargarHabitacionesReferido() {
    try {
        const response = await fetch('/api/habitaciones');
        const result = await response.json();

        if (result.success || Array.isArray(result)) {
            const habitacionesData = Array.isArray(result) ? result : result.data;
            const container = document.getElementById('cupon-referido-habitaciones-list');
            if (container) {
                container.innerHTML = habitacionesData.map(hab => `
                    <div class="form-check habitacion-item-referido" data-name="${hab.propertyDetails?.name || hab.name || 'Sin nombre'}" style="margin-bottom: 0.5rem;">
                        <input class="form-check-input checkbox-habitacion-referido" type="checkbox" id="hab-ref-${hab._id}" value="${hab._id}" />
                        <label class="form-check-label" for="hab-ref-${hab._id}">${hab.propertyDetails?.name || hab.name || 'Sin nombre'}</label>
                    </div>
                `).join('');
                
                // Event listeners para actualizar contador
                const checkboxes = container.querySelectorAll('.checkbox-habitacion-referido');
                checkboxes.forEach(cb => {
                    cb.addEventListener('change', actualizarContadorHabitacionesReferido);
                });
            }
        }
    } catch (error) {
        console.error('Error al cargar habitaciones:', error);
    }
}

function actualizarContadorHabitaciones() {
    const checkboxes = document.querySelectorAll('.checkbox-habitacion-cupon:checked');
    const contador = document.getElementById('habitaciones-selected-count-cupon');
    if (contador) {
        contador.textContent = `${checkboxes.length} habitaciones seleccionadas`;
    }
}

function actualizarContadorHabitacionesReferido() {
    const checkboxes = document.querySelectorAll('.checkbox-habitacion-referido:checked');
    const contador = document.getElementById('habitaciones-selected-count-referido');
    if (contador) {
        contador.textContent = `${checkboxes.length} habitaciones seleccionadas`;
    }
}

function filtrarHabitacionesCupon() {
    const searchTerm = document.getElementById('buscar-habitaciones-cupon').value.toLowerCase();
    const items = document.querySelectorAll('.habitacion-item-cupon');
    
    items.forEach(item => {
        const name = item.getAttribute('data-name').toLowerCase();
        if (name.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function filtrarHabitacionesReferido() {
    const searchTerm = document.getElementById('buscar-habitaciones-referido').value.toLowerCase();
    const items = document.querySelectorAll('.habitacion-item-referido');
    
    items.forEach(item => {
        const name = item.getAttribute('data-name').toLowerCase();
        if (name.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function toggleSelectorHabitaciones() {
    const todasCabanas = document.getElementById('cupon-todas-cabanas').checked;
    const selector = document.getElementById('selector-habitaciones');
    if (selector) {
        selector.style.display = todasCabanas ? 'none' : 'block';
    }
}

function toggleSelectorHabitacionesReferido() {
    const todasCabanas = document.getElementById('cupon-referido-todas-cabanas').checked;
    const selector = document.getElementById('selector-habitaciones-referido');
    if (selector) {
        selector.style.display = todasCabanas ? 'none' : 'block';
    }
}

function actualizarHelpTextoValor() {
    const tipo = document.getElementById('cupon-tipo').value;
    const help = document.getElementById('valor-help');
    
    if (tipo === 'percentage') {
        help.textContent = 'Porcentaje: 1-100';
    } else if (tipo === 'fixed_amount') {
        help.textContent = 'Monto en pesos';
    } else if (tipo === 'nights_free') {
        help.textContent = 'Noches gratis (ej: 1 para 3x2)';
    }
}

function actualizarHelpTextoValorReferido() {
    const tipo = document.getElementById('cupon-referido-tipo').value;
    const help = document.getElementById('valor-help-referido');
    
    if (tipo === 'percentage') {
        help.textContent = 'Porcentaje: 1-100';
    } else if (tipo === 'fixed_amount') {
        help.textContent = 'Monto en pesos';
    } else if (tipo === 'nights_free') {
        help.textContent = 'Noches gratis (ej: 1 para 3x2)';
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
