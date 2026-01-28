# Módulo de Cupones y Referidos - Guía de Implementación

## ✅ PARTE 1 COMPLETADA

Se han creado exitosamente:

### Modelos (models/)
- ✅ **Cupon.js** - Modelo principal de cupones con validaciones, tipos (percentage, fixed_amount, nights_free), restricciones y métodos helper
- ✅ **CuponUsage.js** - Registro de uso de cupones vinculado a reservas y clientes
- ✅ **Referido.js** - Sistema de referidos con tracking de recompensas
- ✅ **ConfiguracionReferidos.js** - Configuración global del sistema de referidos (singleton)
- ✅ **ClienteWeb.js** - Actualizado con campo `codigoReferido` (unique, sparse)

### Permisos (models/permissions.js)
- ✅ CREATE_CUPONES
- ✅ VIEW_CUPONES
- ✅ EDIT_CUPONES (incluye activar/desactivar)
- ✅ DELETE_CUPONES
- ✅ EXPORT_CUPONES
- ✅ VIEW_REFERIDOS
- ✅ MANAGE_REFERIDOS_CONFIG

### Controladores (controllers/)
- ✅ **cuponesController.js** - CRUD completo con 14 funciones:
  - crearCupon
  - listarCupones (con paginación y filtros)
  - obtenerCupon
  - editarCupon
  - toggleActivoCupon
  - eliminarCupon (soft delete)
  - validarCupon (para aplicar en reserva)
  - obtenerEstadisticasCupon
  - exportarCuponesCSV
  - exportarUsosCuponesCSV
  - mostrarDashboardCupones
  - obtenerDatosDashboard

- ✅ **referidosController.js** - Gestión completa con 8 funciones:
  - obtenerMisReferidos (clientes web)
  - listarTodosReferidos (admin)
  - obtenerEstadisticasReferidos
  - obtenerConfiguracion
  - actualizarConfiguracion
  - exportarReferidosCSV
  - generarCodigoReferido
  - mostrarDashboardReferidos

### Rutas (routes/)
- ✅ **cuponesRoutes.js** - 12 endpoints REST + 1 vista
- ✅ **referidosRoutes.js** - 7 endpoints REST + 1 vista
- ✅ **indexRoutes.js** - Rutas registradas correctamente

---

## 📋 PARTE 2: Frontend Handlebars ✅ COMPLETADA

### Vista unificada creada en views/

#### ✅ vistaCupones.handlebars
**Ruta**: GET /cupones/dashboard

**Características implementadas**:
- **Vista unificada** con 4 tabs navegables (Dashboard, Cupones, Referidos, Configuración)
- **Tab Dashboard**:
  - 4 tarjetas de resumen (total cupones, cupones activos, total usos, total descuentos)
  - 2 gráficas Chart.js (usos por mes, descuentos por mes)
  - Tabla de cupones más populares
  - Filtros por rango de fechas
  
- **Tab Cupones**:
  - Tabla completa con columnas: Código, Nombre, Tipo, Valor, Usos, Vigencia, Estado, Acciones
  - Buscador en tiempo real (código/nombre)
  - Filtros: tipo, activo, vigente
  - Paginación completa
  - Modal CRUD con todos los campos del modelo
  - Acciones: Ver estadísticas, Editar, Activar/Desactivar, Eliminar
  - Botón exportar CSV
  
- **Tab Referidos**:
  - 4 tarjetas de resumen (total referidos, pendientes, completados, total recompensas)
  - Gráfica de referidos por mes
  - Tabla de top referidores
  - Tabla completa de todos los referidos
  - Filtros por estado y fechas
  - Botón exportar CSV
  
- **Tab Configuración**:
  - Formulario completo para ConfiguracionReferidos
  - Toggle sistema activo/inactivo
  - Configuración de recompensas (referidor y referido)
  - Requisitos (monto mínimo, noches mínimas, validar pago)
  - Límites de recompensas
  - Vigencia de cupones generados

**Archivo JavaScript**: src/public/scripts/cupones.js
- Estado global con arrays (cupones, referidos, habitaciones)
- Navegación entre tabs
- Funciones fetch para todos los endpoints API
- Renderizado de gráficas Chart.js
- Manejo de modales CRUD
- Paginación con controles
- Filtrado y búsqueda
- Exportación CSV
- Sistema de notificaciones toast
- Debounce para búsqueda en tiempo real

**Modificaciones en controlador**:
- cuponesController.js `mostrarDashboardCupones` ahora renderiza 'vistaCupones'

---

### Notas de implementación Parte 2

**Patrón seguido**: Igual que vistaFinanzas.handlebars (vista unificada con tabs)

**Fetch de datos utilizados**:
- Dashboard: GET /api/cupones/dashboard/datos
- Lista cupones: GET /api/cupones?page=1&limit=20
- Detalle cupón: GET /api/cupones/:id
- Estadísticas cupón: GET /api/cupones/:id/estadisticas
- Crear/Editar: POST/PUT /api/cupones
- Toggle activo: PATCH /api/cupones/:id/toggle
- Eliminar: DELETE /api/cupones
- Referidos: GET /api/referidos/estadisticas
- Lista referidos: GET /api/referidos
- Configuración: GET/PUT /api/referidos/configuracion
- Exportar: GET /api/cupones/exportar-csv, GET /api/referidos/exportar-csv

**Archivos eliminados** (no necesarios por vista unificada):
- ~~dashboardCupones.handlebars~~ (integrado en vistaCupones)
- ~~gestionCupones.handlebars~~ (integrado en vistaCupones)
- ~~detalleCupon.handlebars~~ (modal en vistaCupones)
- ~~dashboardReferidos.handlebars~~ (integrado en vistaCupones)
- ~~configuracionReferidos.handlebars~~ (integrado en vistaCupones)

---

## 📋 PARTE 3: Integración Manual Validación Cupón (Pendiente)

Esta parte debe ser hecha **manualmente** por el desarrollador en el formulario de reservas existente.

### Modificaciones necesarias en el formulario web de reservas

**Ubicación**: views/reservaWeb.handlebars (o similar)

Crear archivos en `src/public/js/`:
- `cuponesManager.js` - CRUD de cupones con fetch API
- `referidosManager.js` - Gestión de referidos
- `dashboardCupones.js` - Gráficas y estadísticas (Chart.js)

**Importante**: Solo Handlebars para renderizar el HTML base, todo lo demás vía API con fetch.

---

## 📋 PARTE 3: Validación de Cupones en Reserva (Manual)

### Objetivo
Permitir ingresar código de cupón al crear/editar reserva y ver descuento aplicado en tiempo real.

### Archivo a modificar
`controllers/eventController.js` (tu archivo actual)

### Pasos para integración:

#### 1. Agregar campo de cupón en el formulario de reserva
En la vista donde se crea/edita reserva, agregar:
```html
<input type="text" id="codigoCupon" placeholder="Código de cupón (opcional)">
<button type="button" id="aplicarCupon">Aplicar</button>
<div id="resultadoCupon"></div>
```

#### 2. Validar cupón al hacer clic en "Aplicar"
```javascript
// En el frontend (JavaScript)
document.getElementById('aplicarCupon').addEventListener('click', async () => {
    const codigo = document.getElementById('codigoCupon').value;
    const montoReserva = calcularMontoReserva(); // Tu función existente
    const habitacionId = document.getElementById('habitacion').value;
    const noches = calcularNoches(); // Tu función existente
    
    const response = await fetch('/api/cupones/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            codigo,
            montoReserva,
            habitacionId,
            noches
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        // Mostrar descuento
        document.getElementById('resultadoCupon').innerHTML = `
            ✅ Cupón válido: ${result.data.cupon.nombre}
            <br>Descuento: $${result.data.descuento}
            <br>Total: $${result.data.montoFinal}
        `;
        
        // Guardar datos del cupón para enviar al crear reserva
        window.cuponAplicado = {
            cuponId: result.data.cupon.id,
            codigo: result.data.cupon.codigo,
            descuento: result.data.descuento
        };
    } else {
        document.getElementById('resultadoCupon').innerHTML = `
            ❌ ${result.message}
        `;
    }
});
```

#### 3. Datos que debes capturar
Cuando el cupón es válido, la API `/api/cupones/validar` retorna:
```javascript
{
    success: true,
    data: {
        cupon: {
            id: "...",
            codigo: "VERANO2026",
            nombre: "Descuento Verano",
            tipo: "percentage",
            valor: 20,
            aplicableA: "all"
        },
        descuento: 500,      // Monto calculado del descuento
        montoFinal: 2000     // Monto original - descuento
    }
}
```

#### 4. Qué guardar en la variable global (para usar en Parte 4)
```javascript
window.cuponAplicado = {
    cuponId: result.data.cupon.id,           // ID del cupón
    codigo: result.data.cupon.codigo,        // Código del cupón
    tipo: result.data.cupon.tipo,            // tipo del cupón
    valor: result.data.cupon.valor,          // valor del cupón
    aplicableA: result.data.cupon.aplicableA, // a quién aplica
    descuentoCalculado: result.data.descuento // Monto del descuento calculado
};
```

---

## 📋 PARTE 4: Integración con Campos de Reserva (Manual)

### Objetivo
Aplicar el cupón validado al crear la reserva y registrar su uso.

### Archivo a modificar
`controllers/eventController.js` - función `createReservation` (línea ~3377)

### Pasos:

#### 1. Recibir datos del cupón desde el frontend
En el `req.body` de la reserva, debes recibir:
```javascript
{
    // ... campos existentes de reserva ...
    cupon: {
        cuponId: "...",
        codigo: "VERANO2026",
        tipo: "percentage",
        valor: 20,
        aplicableA: "all",
        descuentoCalculado: 500
    }
}
```

#### 2. En la función createReservation, ANTES de guardar la reserva
```javascript
// DESPUÉS de calcular precioTotal (línea ~3377)
let precioOriginal = precioTotal; // Guardar precio original
let descuentoCupon = 0;
let cuponAplicado = null;

// Si viene cupón en el body
if (req.body.cupon && req.body.cupon.cuponId) {
    const Cupon = require('../models/Cupon');
    const CuponUsage = require('../models/CuponUsage');
    
    // Buscar cupón
    const cupon = await Cupon.findById(req.body.cupon.cuponId);
    
    if (cupon && cupon.estaVigente()) {
        // Usar descuento calculado del frontend
        descuentoCupon = req.body.cupon.descuentoCalculado;
        
        // Aplicar descuento al precioTotal
        precioTotal = precioTotal - descuentoCupon;
        
        // Guardar referencia para crear CuponUsage después
        cuponAplicado = {
            cupon: cupon._id,
            codigo: cupon.codigo,
            tipo: cupon.tipo,
            valor: cupon.valor,
            aplicableA: cupon.aplicableA,
            descuento: descuentoCupon
        };
    }
}
```

#### 3. Actualizar el campo descuento en la reserva
```javascript
// En la creación del documento de reserva
const newEvent = new Documento({
    // ... campos existentes ...
    precioTotal: precioTotal,  // Ya con descuento aplicado
    descuento: descuentoCupon, // Guardar monto del descuento
    // ... resto de campos ...
});

await newEvent.save();
```

#### 4. DESPUÉS de guardar la reserva exitosamente
```javascript
// Si se aplicó cupón, registrar uso
if (cuponAplicado) {
    const Cupon = require('../models/Cupon');
    const CuponUsage = require('../models/CuponUsage');
    
    // Incrementar contador de usos
    await Cupon.findByIdAndUpdate(cuponAplicado.cupon, {
        $inc: { usosActuales: 1 }
    });
    
    // Crear registro de uso
    await CuponUsage.create({
        cupon: cuponAplicado.cupon,
        reserva: newEvent._id,
        cliente: req.body.clienteId || null,
        clienteWeb: req.body.clienteWebId || null,
        montoDescuento: cuponAplicado.descuento,
        montoOriginal: precioOriginal,
        montoFinal: precioTotal,
        tipoCupon: cuponAplicado.tipo,
        valorAplicado: cuponAplicado.valor,
        habitacion: req.body.chalet,
        noches: nNights || null,
        fechaUso: new Date()
    });
}
```

#### 5. Manejo del campo `aplicableA`
El campo `aplicableA` define a quién afecta el descuento:
- **"all"**: El descuento se aplica al precioTotal completo
- **"owner_only"**: El descuento solo afecta el costo base del dueño
- **"except_owner"**: El descuento afecta todo excepto el costo del dueño

**Nota**: En esta Parte 1 NO implementamos la lógica de descuentos diferenciados. Solo guardamos el valor para uso futuro. Por ahora, todos los cupones afectan el `precioTotal` completo.

#### 6. Ejemplo completo de integración
```javascript
async function createReservation(req, res) {
    try {
        // ... código existente de validaciones ...
        
        // ... cálculo de precioTotal ...
        let precioOriginal = precioTotal;
        let descuentoCupon = 0;
        let cuponAplicado = null;
        
        // Aplicar cupón si existe
        if (req.body.cupon && req.body.cupon.cuponId) {
            const Cupon = require('../models/Cupon');
            const cupon = await Cupon.findById(req.body.cupon.cuponId);
            
            if (cupon && cupon.estaVigente()) {
                descuentoCupon = req.body.cupon.descuentoCalculado;
                precioTotal = precioTotal - descuentoCupon;
                
                cuponAplicado = {
                    cupon: cupon._id,
                    descuento: descuentoCupon,
                    tipo: cupon.tipo,
                    valor: cupon.valor
                };
            }
        }
        
        // Crear reserva
        const newEvent = new Documento({
            // ... campos existentes ...
            precioTotal: precioTotal,
            descuento: descuentoCupon,
            // ...
        });
        
        await newEvent.save();
        
        // Registrar uso de cupón
        if (cuponAplicado) {
            const Cupon = require('../models/Cupon');
            const CuponUsage = require('../models/CuponUsage');
            
            await Cupon.findByIdAndUpdate(cuponAplicado.cupon, {
                $inc: { usosActuales: 1 }
            });
            
            await CuponUsage.create({
                cupon: cuponAplicado.cupon,
                reserva: newEvent._id,
                cliente: req.body.clienteId || null,
                clienteWeb: req.body.clienteWebId || null,
                montoDescuento: cuponAplicado.descuento,
                montoOriginal: precioOriginal,
                montoFinal: precioTotal,
                tipoCupon: cuponAplicado.tipo,
                valorAplicado: cuponAplicado.valor,
                habitacion: req.body.chalet,
                noches: nNights || null
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Reserva creada exitosamente',
            data: newEvent
        });
        
    } catch (error) {
        // ... manejo de errores ...
    }
}
```

---

## 🔧 Testing Sugerido

### Probar Parte 1 (Backend)

#### 1. Crear un cupón de prueba
```bash
POST http://localhost:3005/api/cupones
Content-Type: application/json

{
    "nombre": "Descuento Verano 2026",
    "codigo": "VERANO2026",
    "tipo": "percentage",
    "valor": 20,
    "aplicableA": "all",
    "fechaInicio": "2026-01-01",
    "fechaFin": "2026-12-31",
    "todasCabanas": true,
    "activo": true
}
```

#### 2. Listar cupones
```bash
GET http://localhost:3005/api/cupones
```

#### 3. Validar cupón
```bash
POST http://localhost:3005/api/cupones/validar
Content-Type: application/json

{
    "codigo": "VERANO2026",
    "montoReserva": 2500,
    "noches": 3
}
```

#### 4. Exportar cupones
```bash
GET http://localhost:3005/api/cupones/exportar-csv
```

---

## 📝 Notas Importantes

1. **Campo descuento en reserva**: Ya existe en el modelo `Documento` pero no se usa automáticamente. Ahora lo usaremos para almacenar el monto del descuento del cupón.

2. **Soft delete**: Los cupones con usos solo se desactivan (activo: false), nunca se eliminan de la BD.

3. **Códigos únicos**: Los códigos de cupón se convierten automáticamente a mayúsculas y tienen validación de unicidad.

4. **Permisos**: Recordar asignar los nuevos permisos a los roles correspondientes en la BD.

5. **Sistema de referidos**: En Parte 3 y 4, cuando un cliente web se registre con código de referido, deberás:
   - Validar el código
   - Crear registro en Referido
   - Al completar primera reserva, marcar como completed
   - Emitir recompensas según configuración

6. **Menú lateral**: Se agregó la opción "Cupones y Referidos" al menú del Administrador en `sideMenuController.js` con ruta `/cupones/dashboard` e ícono `fas fa-ticket-alt`.

7. **Chart.js**: Se utiliza versión 4.4.0 desde CDN (igual que vistaFinanzas.handlebars).

---

## 🚀 Siguientes Pasos

1. ✅ **Parte 1**: Backend completo (modelos, controladores, rutas, permisos)
2. ✅ **Parte 2**: Vista unificada con tabs, JavaScript completo, exportación CSV
3. ⏳ **Parte 3**: Implementar validación en tiempo real en formulario de reserva (Manual)
4. ⏳ **Parte 4**: Integrar guardado y uso de cupones en createReservation (Manual)
5. **Futuro**: Lógica de aplicableA (all/owner_only/except_owner) para descuentos diferenciados

---

## 📦 Resumen de Archivos Creados/Modificados en Parte 2

### Archivos creados:
- `views/vistaCupones.handlebars` (1089 líneas) - Vista unificada con 4 tabs
- `src/public/scripts/cupones.js` (1019 líneas) - JavaScript frontend completo

### Archivos modificados:
- `controllers/cuponesController.js` - `mostrarDashboardCupones` ahora renderiza 'vistaCupones'
- `controllers/sideMenuController.js` - Agregado item "Cupones y Referidos" al menú Administrador

### Funcionalidades implementadas:
- ✅ Navegación entre tabs (Dashboard, Cupones, Referidos, Configuración)
- ✅ CRUD completo de cupones con modales
- ✅ Gráficas Chart.js para dashboard
- ✅ Filtros y búsqueda en tiempo real
- ✅ Paginación de resultados
- ✅ Exportación CSV de cupones y referidos
- ✅ Gestión de configuración de sistema de referidos
- ✅ Visualización de estadísticas por cupón
- ✅ Sistema de notificaciones toast
- ✅ Spinner de carga global
