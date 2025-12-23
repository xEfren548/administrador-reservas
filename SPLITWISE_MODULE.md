# Módulo de Finanzas (Splitwise) - Backend

## Descripción
Módulo de gestión financiera tipo Splitwise integrado al PMS. Permite crear organizaciones, cuentas, gestionar transacciones y solicitudes de aprobación.

## Estructura de Archivos Creados

### Modelos (`models/`)
- **SWOrganizacion.js** - Organizaciones ficticias
- **SWCuenta.js** - Cuentas bancarias/carteras
- **SWParticipante.js** - Relación usuarios-cuentas
- **SWTransaccion.js** - Transacciones aprobadas
- **SWSolicitudTransaccion.js** - Solicitudes pendientes

### Controllers (`controllers/`)
- **swOrganizacionController.js** - CRUD de organizaciones
- **swCuentaController.js** - CRUD de cuentas y participantes
- **swTransaccionController.js** - CRUD transacciones + reportes
- **swSolicitudController.js** - Motor de aprobaciones

### Routes (`routes/`)
- **swOrganizacionRoutes.js** - Endpoints organizaciones
- **swCuentaRoutes.js** - Endpoints cuentas
- **swTransaccionRoutes.js** - Endpoints transacciones
- **swSolicitudRoutes.js** - Endpoints solicitudes

### Middleware (`common/middlewares/authPrivileges/`)
- **authSW.js** - Middleware de autorización para el módulo

## Instalación

### 1. Instalar dependencia faltante
```bash
npm install json2csv
```

### 2. Las rutas ya están registradas en `routes/indexRoutes.js`

## Jerarquía del Sistema

```
Organización
  └── Cuenta A (Propietario: Usuario X)
      ├── Participante 1
      ├── Participante 2
      └── Transacciones
  └── Cuenta B (Propietario: Usuario Y)
      ├── Participante 3
      └── Transacciones
```

## Roles y Permisos

### MASTER ADMIN (Administrador)
- ✅ Crear organizaciones
- ✅ Ver/editar/desactivar organizaciones
- ✅ Crear cuentas para cualquier usuario
- ✅ Ver todas las organizaciones y cuentas

### Propietario de Cuenta
- ✅ Agregar/remover participantes
- ✅ Configurar permisos de participantes
- ✅ Crear transacciones directamente (aprobadas automáticamente)
- ✅ Aprobar/rechazar solicitudes de transacciones
- ✅ Ver todas las transacciones y solicitudes
- ✅ Exportar reportes
- ✅ Editar notas/etiquetas de transacciones

### Participante
- ✅ Ver transacciones (si tiene permiso)
- ✅ Ver saldo (si tiene permiso)
- ✅ Crear solicitudes de transacciones (si tiene permiso)
- ✅ Cancelar sus propias solicitudes pendientes
- ✅ Editar sus propias solicitudes pendientes

## API Endpoints

### Organizaciones
```
POST   /api/sw/organizaciones                    - Crear organización (MASTER ADMIN)
GET    /api/sw/organizaciones                    - Listar organizaciones (MASTER ADMIN)
GET    /api/sw/organizaciones/:id                - Ver organización (MASTER ADMIN)
PUT    /api/sw/organizaciones/:id                - Actualizar organización (MASTER ADMIN)
DELETE /api/sw/organizaciones/:id                - Desactivar organización (MASTER ADMIN)
GET    /api/sw/organizaciones/:id/cuentas        - Ver cuentas de organización (MASTER ADMIN)
```

### Cuentas
```
POST   /api/sw/cuentas                           - Crear cuenta (MASTER ADMIN)
GET    /api/sw/cuentas/mis-cuentas               - Ver mis cuentas (Autenticado)
GET    /api/sw/cuentas/:id                       - Ver cuenta (Participante)
PUT    /api/sw/cuentas/:id                       - Actualizar cuenta (Propietario)
POST   /api/sw/cuentas/:id/participantes         - Agregar participante (Propietario)
GET    /api/sw/cuentas/:id/participantes         - Listar participantes (Participante)
DELETE /api/sw/cuentas/:id/participantes/:participanteId  - Remover participante (Propietario)
PUT    /api/sw/cuentas/:id/participantes/:participanteId/permisos - Actualizar permisos (Propietario)
POST   /api/sw/cuentas/:id/recalcular-saldo      - Recalcular saldo (Propietario)
```

### Transacciones
```
POST   /api/sw/transacciones                     - Crear transacción directa (Propietario)
GET    /api/sw/transacciones/cuenta/:cuentaId    - Listar transacciones (Participante)
GET    /api/sw/transacciones/:id                 - Ver transacción (Participante)
PUT    /api/sw/transacciones/:id/notas           - Actualizar notas (Propietario)
DELETE /api/sw/transacciones/:id                 - Eliminar transacción no aprobada
GET    /api/sw/transacciones/cuenta/:cuentaId/resumen - Ver resumen (Participante)
GET    /api/sw/transacciones/cuenta/:cuentaId/por-categoria - Análisis por categoría
GET    /api/sw/transacciones/cuenta/:cuentaId/exportar-csv - Exportar CSV
```

### Solicitudes
```
POST   /api/sw/solicitudes                       - Crear solicitud (Participante)
GET    /api/sw/solicitudes/mis-solicitudes       - Ver mis solicitudes (Autenticado)
GET    /api/sw/solicitudes/cuenta/:cuentaId/pendientes - Ver pendientes (Propietario)
GET    /api/sw/solicitudes/cuenta/:cuentaId      - Listar solicitudes (Participante)
GET    /api/sw/solicitudes/:id                   - Ver solicitud (Participante)
POST   /api/sw/solicitudes/:id/procesar          - Aprobar/rechazar (Propietario)
POST   /api/sw/solicitudes/:id/cancelar          - Cancelar solicitud (Solicitante)
PUT    /api/sw/solicitudes/:id                   - Actualizar solicitud (Solicitante)
GET    /api/sw/solicitudes/cuenta/:cuentaId/estadisticas - Ver estadísticas (Propietario)
```

## Ejemplos de Uso

### Crear Organización
```javascript
POST /api/sw/organizaciones
Headers: {
  Authorization: "Bearer <token>"
}
Body: {
  "nombre": "Finanzas Empresa",
  "descripcion": "Organización para gestionar finanzas"
}
```

### Crear Cuenta
```javascript
POST /api/sw/cuentas
Headers: {
  Authorization: "Bearer <token>"
}
Body: {
  "nombre": "Cuenta Principal",
  "organizacion": "673abc123def456789",
  "propietario": "673user123456789",
  "tipoCuenta": "Bancaria",
  "moneda": "MXN",
  "saldoInicial": 10000
}
```

### Agregar Participante
```javascript
POST /api/sw/cuentas/673cuenta123/participantes
Headers: {
  Authorization: "Bearer <token>"
}
Body: {
  "usuarioId": "673user456",
  "permisos": {
    "puedeVerTransacciones": true,
    "puedeCrearSolicitudes": true,
    "puedeVerSaldo": true
  }
}
```

### Crear Solicitud de Transacción
```javascript
POST /api/sw/solicitudes
Headers: {
  Authorization: "Bearer <token>"
}
Body: {
  "cuentaId": "673cuenta123",
  "tipo": "Gasto",
  "monto": 500,
  "concepto": "Compra de suministros",
  "categoria": "Compras",
  "descripcion": "Suministros de oficina"
}
```

### Aprobar Solicitud
```javascript
POST /api/sw/solicitudes/673solicitud123/procesar
Headers: {
  Authorization: "Bearer <token>"
}
Body: {
  "accion": "aprobar",
  "comentario": "Aprobado"
}
```

### Exportar Transacciones
```javascript
GET /api/sw/transacciones/cuenta/673cuenta123/exportar-csv?fechaInicio=2025-01-01&fechaFin=2025-12-31
Headers: {
  Authorization: "Bearer <token>"
}
```

## Características Implementadas

### ✅ Fase 1: Modelos
- Organizaciones con creador y timestamps
- Cuentas con propietario único y saldo calculado
- Participantes con permisos configurables
- Transacciones no editables una vez aprobadas
- Solicitudes con estados y motor de aprobación

### ✅ Fase 2: CRUD y Motor de Aprobaciones
- Controllers con validaciones completas
- Middleware de autorización por roles
- Sistema de permisos granular
- Motor de aprobaciones automático
- Recalculo automático de saldos
- Exportación a CSV
- Reportes y estadísticas

### 🔄 Fase 3: UI + Gráficas (Pendiente)
- Interfaz de usuario
- Dashboard con gráficas
- Visualización de estadísticas
- Formularios de creación/edición

## Reglas de Negocio

1. **Solo MASTER ADMIN puede crear organizaciones y cuentas**
2. **Una cuenta tiene un solo propietario**
3. **Una cuenta puede tener n participantes**
4. **Los participantes se seleccionan del modelo Usuario del PMS**
5. **Solo participantes con permisos pueden crear solicitudes**
6. **Solo el propietario puede aprobar/rechazar solicitudes**
7. **Las transacciones aprobadas son inmutables** (excepto notas/etiquetas)
8. **Los saldos se calculan automáticamente** basados en transacciones aprobadas
9. **Las solicitudes aprobadas crean transacciones automáticamente**
10. **Los participantes pueden cancelar sus propias solicitudes pendientes**

## Categorías de Transacciones

### Gastos
- Alimentación
- Transporte
- Servicios
- Mantenimiento
- Compras
- Salud
- Entretenimiento
- Educación
- Hogar
- Otro

### Ingresos
- Salario
- Venta
- Inversión
- Préstamo
- Reembolso
- Otro

## Tipos de Cuenta
- Bancaria
- Efectivo
- Tarjeta
- Billetera Digital
- Otra

## Monedas Soportadas
- MXN (Pesos Mexicanos)
- USD (Dólares)
- EUR (Euros)

## Próximos Pasos (Fase 3)

1. Crear vistas Handlebars para el frontend
2. Implementar dashboard con gráficas (Chart.js)
3. Formularios de creación/edición
4. Sistema de notificaciones
5. Filtros avanzados y búsqueda
6. Integración con reservas del PMS
7. Reportes en PDF
8. Auditoría de cambios

## Notas Técnicas

- Todos los modelos usan Mongoose con validaciones
- Los controllers usan express-validator
- Autenticación mediante JWT (existente en PMS)
- Los middlewares verifican roles y permisos
- Las rutas están protegidas con autenticación
- Los saldos se recalculan automáticamente al aprobar
- Las transacciones tienen timestamps automáticos
- Soporte para archivos adjuntos (comprobantes)
- Conexión opcional con reservas del PMS
