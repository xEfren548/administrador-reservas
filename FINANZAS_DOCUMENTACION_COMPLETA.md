# Documentacion Completa del Modulo de Finanzas

## 1. Objetivo

Este documento describe el modulo de finanzas tal como opera hoy en la aplicacion web.

Incluye:

- Las pantallas, tabs, modales, botones y flujos funcionales visibles para el usuario.
- Las reglas de negocio que cambian el comportamiento de cada accion.
- El catalogo completo de endpoints relacionados con finanzas.
- Los tipos de respuesta que devuelve cada recurso.
- Las consideraciones necesarias para replicar el modulo dentro de una app cliente.

No incluye implementacion de codigo.

## 2. Alcance

La documentacion cubre:

- La vista `GET /finanzas`.
- Los endpoints bajo `GET|POST|PUT|DELETE /api/sw/*`.
- Los endpoints bajo `GET /api/sw/dashboard/*`.
- El endpoint de apoyo `GET /api/usuarios/all`, usado por finanzas para participantes.

## 3. Reglas globales del modulo

### 3.1 Acceso general

- La vista `/finanzas` requiere sesion autenticada.
- Casi todos los endpoints del modulo requieren sesion autenticada.
- La unica ruta publica del conjunto principal es `GET /api/sw/cuentas/:id/stripe-config`.

### 3.2 Roles funcionales que existen en la interfaz

#### MASTER ADMIN

- Ve el boton `Nueva Organizacion`.
- Puede activar o desactivar organizaciones desde la tabla.
- Puede editar organizaciones desde la tabla.

#### Usuario con `privilege = Administrador`

- Ve el boton `Categorias`.
- Puede modificar categorias financieras por API y por modal.

#### Administrador de organizacion

- Puede agregar y remover participantes de una organizacion.
- Puede promover o degradar roles dentro de la organizacion.
- Puede aprobar o rechazar solicitudes organizacionales.

#### Miembro de organizacion

- Puede ver la organizacion donde participa.
- Puede crear solicitudes organizacionales.
- No puede procesar solicitudes organizacionales.

#### Propietario de cuenta

- Puede crear transacciones directas.
- Puede crear transferencias directas.
- Puede editar datos de su cuenta.
- Puede agregar y remover participantes de su cuenta.
- Puede ver siempre el saldo de su cuenta.
- Puede aprobar o rechazar solicitudes de cuenta.
- Puede confirmar solicitudes organizacionales cuando la cuenta requiere confirmacion del dueño.

#### Participante de cuenta

- Puede existir con rol `Participante`.
- Tiene tres permisos configurables:
  - `puedeVerTransacciones`
  - `puedeCrearSolicitudes`
  - `puedeVerSaldo`
- No puede crear transacciones directas.
- Puede crear solicitudes si el backend y el flujo se lo permiten.

### 3.3 Roles de organizacion

Los participantes de organizacion manejan dos roles:

- `Administrador`
- `Miembro`

### 3.4 Roles de cuenta

Los participantes de cuenta manejan dos roles:

- `Propietario`
- `Participante`

### 3.5 Reglas transversales de negocio

- Zona horaria operativa: `America/Mexico_City`.
- Las fechas de filtros y formularios se normalizan para evitar desfases de dia.
- Monedas soportadas en cuentas: `MXN`, `USD`, `EUR`.
- Tipos de cuenta soportados: `Bancaria`, `Efectivo`, `Tarjeta`, `Billetera Digital`, `Otra`.
- Tipos de transaccion y solicitud: `Ingreso`, `Gasto`, `Transferencia`.
- Las transferencias solo se permiten entre cuentas con la misma moneda.
- No se permite transferir a la misma cuenta.
- Imagenes permitidas por transaccion o solicitud: maximo 3 archivos.
- Las categorias fijas del modulo son `Otro` y `Transferencia`.
- Los botones `Descargar XLSX` y `Descargar PDF` no llaman endpoints distintos para cada formato.
  - Ambos consumen `GET /api/sw/transacciones/estado-cuenta`.
  - El archivo se arma del lado cliente.

### 3.6 Particularidad importante de recurrentes y diferidos

Las rutas de recurrentes y pagos diferidos dicen aceptar propietario o participante con permisos, pero el modelo de participante de cuenta solo expone:

- `puedeVerTransacciones`
- `puedeCrearSolicitudes`
- `puedeVerSaldo`

No existe un permiso persistido llamado `puedeCrearTransacciones` ni `puedeEditarTransacciones` en el modelo actual. En la practica, estas operaciones quedan alineadas al propietario, salvo que se extienda el modelo o existan datos legacy.

## 4. Mapa funcional de la interfaz

### 4.1 Header principal

| Control | Visible para | Funcion | Endpoint principal |
| --- | --- | --- | --- |
| `Nueva Organizacion` | Solo `isMasterAdmin` | Abre modal para crear organizacion | `POST /api/sw/organizaciones` |
| `Categorias` | Usuarios con `privilege = Administrador` | Abre modal para administrar categorias | `GET /api/sw/categorias`, `PUT /api/sw/categorias` |
| `Proveedores` | Todos los usuarios que entran al modulo | Abre modal para administrar proveedores externos por organizacion | `GET|POST|PUT|DELETE /api/sw/proveedores-externos*` |
| `Nueva Cuenta` | Todos los usuarios que entran al modulo | Abre modal para crear una cuenta | `POST /api/sw/cuentas` |

### 4.2 Tabs principales

La vista trabaja con 6 tabs:

1. `Dashboard`
2. `Organizaciones`
3. `Mis Cuentas`
4. `Transacciones`
5. `Solicitudes`
6. `Recurrentes y Diferidos`

Cada tab carga datos al activarse.

### 4.3 Dashboard

#### Controles superiores

- Selector de vista:
  - `Vista Personal`
  - `Vista de Organizacion`
- Selector de organizacion:
  - Solo aparece si la vista elegida es `Organizacion`.
- Filtros de fecha:
  - `Desde`
  - `Hasta`
  - Boton `Aplicar`
  - Boton `Limpiar`

#### Vista personal

Muestra 4 tarjetas:

- `Saldo Total`
- `Total Ingresos`
- `Total Gastos`
- `Mis Cuentas`

Muestra 2 componentes de detalle:

- Grafica `Transacciones por Cuenta`
- Listado `Transacciones Recientes`

Muestra un bloque adicional:

- `Mi Resumen de Organizaciones`
- Card de balance total en organizaciones
- Lista de balances por organizacion donde el usuario participa

#### Vista de organizacion

Muestra 6 tarjetas:

- `Saldo Total`
- `Ingresos`
- `Gastos`
- `Cuentas`
- `Transacciones`
- `Participantes`

Muestra un resumen del mes actual:

- `Ingresos del Mes`
- `Gastos del Mes`
- `Balance del Mes`

Muestra 2 graficas:

- `Evolucion (Ultimos 6 Meses)`
- `Gastos por Categoria`

Muestra 2 listados:

- `Usuarios por Actividad`
- `Mi Participacion`

#### Endpoints que consume

- `GET /api/sw/organizaciones`
- `GET /api/sw/dashboard/personal`
- `GET /api/sw/dashboard/organizacion/:organizacionId`

#### Reglas de replica

- La vista personal solo usa cuentas donde el usuario es propietario.
- La vista de organizacion valida acceso por membresia a la organizacion o participacion en una cuenta de esa organizacion.
- Si no hay datos, la UI reemplaza la grafica por mensajes vacios.

### 4.4 Tab Organizaciones

#### Contenido principal

Tabla con columnas:

- `Nombre`
- `Descripcion`
- `Participantes`
- `Estado`
- `Fecha Creacion`
- `Acciones`

#### Acciones por fila

- `Ver cuentas`
  - Disponible para cualquier usuario que vea la organizacion.
  - Abre un modal SweetAlert con estadisticas y lista de participantes.
- `Ver participantes`
  - Abre modal de gestion de participantes.
- `Editar`
  - Disponible si el usuario es `MASTER ADMIN` o administrador de esa organizacion.
- `Activar/Desactivar`
  - Visible solo para `MASTER ADMIN`.
  - En la vista actual se hace con `PUT /api/sw/organizaciones/:id` enviando `activa`.

#### Modal Nueva/Editar Organizacion

Campos:

- `Nombre` obligatorio
- `Descripcion` opcional

Solo al crear:

- Selector de usuario para agregar participante
- Selector de rol del participante: `Miembro` o `Administrador`
- Boton `Agregar`
- Lista de participantes agregados antes de guardar

Reglas:

- El creador se agrega automaticamente como `Administrador`.
- El modal de edicion oculta la seccion de participantes temporales.

#### Modal Gestionar Participantes de Organizacion

Acciones disponibles:

- Agregar nuevo participante
- Cambiar rol de `Miembro` a `Administrador`
- Cambiar rol de `Administrador` a `Miembro`
- Eliminar participante

Restricciones:

- Solo administradores de la organizacion pueden modificar participantes.
- No se puede eliminar al creador de la organizacion.
- Debe quedar al menos un administrador.

#### Endpoints que consume

- `GET /api/sw/organizaciones`
- `GET /api/sw/organizaciones/:id`
- `POST /api/sw/organizaciones`
- `PUT /api/sw/organizaciones/:id`
- `POST /api/sw/organizaciones/:id/participantes`
- `DELETE /api/sw/organizaciones/:id/participantes/:participanteId`
- `PUT /api/sw/organizaciones/:id/participantes/:participanteId/rol`
- `GET /api/usuarios/all`

### 4.5 Tab Mis Cuentas

#### Contenido principal

Las cuentas se muestran como cards agrupadas por organizacion.

Cada card muestra:

- Nombre de la cuenta
- Tipo de cuenta
- Estado `Activa` o `Inactiva`
- Saldo actual si el usuario tiene permiso
- Descripcion si existe

#### Acciones por card

Si el usuario es propietario:

- `Transaccion`
- `Editar`

Si el usuario no es propietario:

- `Ver Detalle`

#### Modal Nueva/Editar Cuenta

Campos principales:

- `Nombre de la Cuenta`
- `Organizacion`
- `Tipo de Cuenta`
- `Moneda`
- `Saldo Inicial`
- `Descripcion`

Datos bancarios opcionales:

- `Beneficiario`
- `Banco`
- `CLABE`
- `Numero de Cuenta`
- `Referencia`

Integracion Stripe:

- `Ninguna`
- `ISRA`
- `FERNANDO`
- `CARLOS`

Reglas:

- `Saldo Inicial` solo se puede definir al crear.
- En edicion el campo se bloquea.
- El propietario real de la cuenta siempre es el usuario autenticado que la crea.

#### Modal Detalle de Cuenta

Muestra:

- Informacion general de la cuenta
- Datos bancarios si existen
- Participantes de la cuenta
- Boton `Agregar Participante`

Si el usuario no puede ver saldo:

- Se ocultan `saldoActual` y `saldoInicial`.

#### Modal Agregar Participante

Campos:

- Selector de usuario
- Checkbox `Puede ver transacciones`
- Checkbox `Puede crear solicitudes de transaccion`
- Checkbox `Puede ver saldo de la cuenta`

#### Endpoints que consume

- `GET /api/sw/cuentas/mis-cuentas`
- `POST /api/sw/cuentas`
- `PUT /api/sw/cuentas/:id`
- `GET /api/sw/cuentas/:id`
- `GET /api/sw/cuentas/:id/participantes`
- `POST /api/sw/cuentas/:id/participantes`
- `DELETE /api/sw/cuentas/:id/participantes/:usuarioId`
- `GET /api/usuarios/all`

### 4.6 Tab Transacciones

#### Contenido principal

Tabla con columnas:

- `Fecha`
- `Tipo`
- `Concepto`
- `Categoria`
- `Monto`
- `Estado`
- `Acciones`

#### Filtros

- Filtro por cuenta
- Fecha `Desde`
- Fecha `Hasta`
- Boton `Filtrar`
- Boton `Limpiar`

#### Exportes

- `Descargar XLSX`
- `Descargar PDF`

Reglas del export:

- Requiere seleccionar ambas fechas.
- Si no hay movimientos, no se genera archivo.
- El cliente pide `GET /api/sw/transacciones/estado-cuenta` y luego genera el archivo localmente.

#### Acciones por fila

La vista actual muestra dos acciones por transaccion:

- `Ver detalle`
- `Ver/Gestionar comprobantes`

No hay boton visible de editar ni de eliminar en la tabla actual.

#### Modal Nueva Transaccion

Campos:

- `Tipo`
- `Monto`
- `Categoria`
- `Concepto`
- `Descripcion`
- `Fecha`
- `Notas adicionales`
- `Comprobantes/Tickets`

Comportamiento especial por tipo:

- Si `Tipo = Transferencia`:
  - Se muestra `Cuenta Destino`.
  - Se ocultan categoria e imagenes.
  - El endpoint usado es `POST /api/sw/transferencias`.
- Si `Tipo = Gasto` o `Ingreso`:
  - Se usa `POST /api/sw/transacciones`.
  - Despues, si hay imagenes, se llama `POST /api/sw/transacciones/:id/imagenes`.

#### Modal Gestionar Imagenes de Transaccion

Funciones:

- Ver imagenes actuales
- Abrir imagen completa
- Eliminar imagen individual
- Subir nuevas imagenes si no se rebasa el limite de 3

#### Modal Detalle de Transaccion

Muestra:

- Datos generales
- Relacion con transferencia si existe
- Imagenes del movimiento
- Comprobante de confirmacion si existe

#### Endpoints que consume

- `GET /api/sw/transacciones/cuenta/:cuentaId`
- `GET /api/sw/transacciones/:id`
- `POST /api/sw/transacciones`
- `POST /api/sw/transferencias`
- `GET /api/sw/transacciones/estado-cuenta`
- `POST /api/sw/transacciones/:id/imagenes`
- `DELETE /api/sw/transacciones/:id/imagenes/:imagenNombre`

### 4.7 Tab Solicitudes

#### Subvistas disponibles

- `Solicitudes por Cuenta`
- `Solicitudes por Organizacion`
- `Confirmacion Dueño`

#### Vista Solicitudes por Cuenta

Columnas:

- `Fecha`
- `Cuenta`
- `Tipo`
- `Concepto`
- `Solicitante`
- `Monto`
- `Estado`
- `Acciones`

Acciones por estado:

- Siempre: `Ver detalle`
- Si `estado = Pendiente` y el usuario es propietario de la cuenta:
  - `Aprobar`
  - `Rechazar`
- Si `estado = Pendiente` y el usuario es solicitante pero no propietario:
  - `Cancelar`

#### Vista Solicitudes por Organizacion

Columnas:

- `Fecha`
- `Organizacion`
- `Cuenta`
- `Tipo`
- `Concepto`
- `Solicitante`
- `Monto`
- `Estado`
- `Acciones`

Acciones segun rol y estado:

- Siempre: `Ver detalle`
- Si `estado = Pendiente` y el usuario es administrador de la organizacion:
  - `Aprobar administrativamente`
  - `Rechazar administrativamente`
- Si `estado = PendienteConfirmacionDueno` y el usuario es propietario de la cuenta:
  - `Confirmar como dueño de la cuenta`
  - `Rechazar como dueño de la cuenta`
- Si `estado = Pendiente` y el usuario es solicitante:
  - `Cancelar`

Bloqueo especial:

- Si quien solicita es administrador y la organizacion tiene 2 o mas administradores, ese mismo administrador no puede autoaprobar su propia solicitud.

#### Vista Confirmacion Dueño

Muestra solo solicitudes organizacionales con estado `PendienteConfirmacionDueno` donde el usuario actual es `propietarioCuenta`.

#### Modal Nueva Solicitud

Campos base:

- `Modo de Solicitud`: `cuenta` u `organizacion`
- `Organizacion` cuando el modo es organizacional
- `Cuenta`
- `Tipo`
- `Monto`
- `Concepto`
- `Categoria`
- `Descripcion`
- `Fecha`
- `Comprobantes/Tickets`

#### Flujo de solicitud por cuenta

- Para `Ingreso` o `Gasto`:
  - `cuentaId` es la cuenta seleccionada.
- Para `Transferencia`:
  - La cuenta seleccionada en `Cuenta` actua como destino.
  - El selector auxiliar `Cuenta Origen (mi cuenta)` se manda como `cuentaDestinoId`.
  - Esta inversion de nombres existe en el flujo actual del front y se debe respetar si se replica la experiencia exacta.

#### Flujo de solicitud por organizacion

- Para `Ingreso` o `Gasto`:
  - `organizacionId` y `cuentaId` corresponden a la organizacion y cuenta seleccionadas.
- Para `Transferencia`:
  - `cuentaId` es la cuenta principal.
  - El selector auxiliar cambia etiqueta a `Cuenta Destino` y se manda como `cuentaDestinoId`.

#### Proveedor externo en solicitudes

El modal tiene un checkbox `Pago a proveedor externo`.

Si se activa:

- Se muestran campos de proveedor.
- En modo organizacional aparece ademas un selector de `Proveedor guardado`.
- Puede guardarse el proveedor para uso futuro en esa organizacion.

Reglas de confirmacion por dueño para proveedor externo:

- Si la solicitud organizacional es de proveedor externo, el dueño debe marcar validacion de compra.
- Si la solicitud organizacional es de proveedor externo, el dueño debe subir comprobante al confirmar.

#### Regla especial de solicitud organizacional con administrador unico

Si el solicitante es administrador, la organizacion tiene un solo administrador y ademas el mismo usuario es quien debe confirmar la cuenta:

- No se crea una solicitud.
- El backend responde `mode = directa`.
- Se crea directamente una transaccion aprobada.

Si el solicitante es administrador unico pero el dueño de la cuenta es otra persona:

- Se crea la solicitud.
- El backend puede autoaprobar la etapa administrativa.
- La solicitud queda pendiente de confirmacion del dueño.

#### Endpoints que consume

- `GET /api/sw/solicitudes/mis-solicitudes`
- `GET /api/sw/solicitudes-organizacion/organizacion/:organizacionId`
- `GET /api/sw/solicitudes-organizacion/pendientes-confirmacion-dueno`
- `POST /api/sw/solicitudes`
- `POST /api/sw/solicitudes-organizacion`
- `POST /api/sw/solicitudes/:id/procesar`
- `POST /api/sw/solicitudes/:id/cancelar`
- `POST /api/sw/solicitudes-organizacion/:id/procesar`
- `POST /api/sw/solicitudes-organizacion/:id/confirmar-dueno`
- `POST /api/sw/solicitudes-organizacion/:id/rechazar-dueno`
- `POST /api/sw/solicitudes-organizacion/:id/cancelar`
- `POST /api/sw/solicitudes/:id/imagenes`
- `DELETE /api/sw/solicitudes/:id/imagenes/:imagenNombre`
- `POST /api/sw/solicitudes-organizacion/:id/imagenes`
- `DELETE /api/sw/solicitudes-organizacion/:id/imagenes/:imagenNombre`
- `GET /api/sw/cuentas/para-solicitudes`
- `GET /api/sw/organizaciones/:id/cuentas`
- `GET /api/sw/proveedores-externos/organizacion/:organizacionId`

### 4.8 Tab Recurrentes y Diferidos

#### Subtab Transacciones Recurrentes

Tabla con columnas:

- `Concepto`
- `Cuenta`
- `Tipo`
- `Monto`
- `Frecuencia`
- `Proxima Ejecucion`
- `Estado`
- `Acciones`

Acciones por fila:

- `Ejecutar ahora`
- `Pausar/Reanudar`
- `Ver detalle`
- `Eliminar`

Modal de alta:

- `Cuenta`
- `Tipo`
- `Monto`
- `Concepto`
- `Categoria`
- `Descripcion`
- `Frecuencia`
- `Dia de ejecucion`
- `Fecha de inicio`
- `Fecha de fin`
- `Ejecutar automaticamente`
- `Notificar con anticipacion`

#### Subtab Pagos Diferidos

Tabla con columnas:

- `Concepto`
- `Cuenta`
- `Monto Total`
- `Cuotas`
- `Pagadas`
- `Progreso`
- `Estado`
- `Acciones`

Acciones por fila:

- `Ver detalle`
- `Cancelar` si el pago sigue `Activo`

Modal de alta:

- `Cuenta`
- `Monto Total`
- `Numero de Pagos`
- `Interes Mensual`
- `Fecha del Primer Pago`
- `Concepto`
- `Categoria`
- `Descripcion`
- Boton `Calcular` para vista previa de cuotas

Detalle de pago diferido:

- Muestra cuotas programadas.
- Cada cuota pendiente puede pagarse con un boton `Pagar`.

#### Endpoints que consume

- `GET /api/sw/recurrentes`
- `POST /api/sw/recurrentes`
- `GET /api/sw/recurrentes/:id`
- `PUT /api/sw/recurrentes/:id`
- `DELETE /api/sw/recurrentes/:id`
- `POST /api/sw/recurrentes/:id/ejecutar`
- `GET /api/sw/pagos-diferidos`
- `POST /api/sw/pagos-diferidos`
- `GET /api/sw/pagos-diferidos/:id`
- `POST /api/sw/pagos-diferidos/:id/cuotas/:cuotaNumero/pagar`
- `POST /api/sw/pagos-diferidos/:id/cancelar`

### 4.9 Modal de Categorias Financieras

Funciones:

- Cargar categorias actuales
- Agregar nueva categoria
- Eliminar categoria no fija
- Guardar el orden/lista final

Reglas:

- `Otro` y `Transferencia` no se pueden eliminar.
- La lista visible en los formularios se vuelve a poblar dinamicamente despues de guardar.

### 4.10 Modal de Proveedores Externos

Funciones:

- Seleccionar organizacion
- Listar proveedores activos de la organizacion
- Crear proveedor
- Editar proveedor
- Eliminar proveedor

Campos del proveedor:

- `Nombre proveedor`
- `Beneficiario`
- `Banco`
- `Cuenta bancaria / CLABE`

Regla especial:

- Si se intenta crear un proveedor ya existente para la misma organizacion con el mismo `beneficiario + cuentaClabe`, el backend responde exito con `reused = true`.

### 4.11 Comprobantes e imagenes

Actualmente el modulo maneja comprobantes en 3 puntos:

- Imagenes de transaccion
- Imagenes de solicitud
- Comprobante de confirmacion al aprobar o confirmar ciertos flujos

Reglas:

- Maximo 3 imagenes por transaccion o solicitud.
- Las imagenes se suben por separado despues de crear la transaccion o solicitud, salvo el comprobante unico del flujo de aprobacion/confirmacion.
- Las rutas se guardan como nombre de archivo remoto.

## 5. Tipos de respuesta y entidades

### 5.1 Envoltorios de API

#### `ApiSuccess<T>`

- `success`: `true`
- `message`: texto opcional
- `data`: payload principal de tipo `T`
- `pagination`: objeto opcional con `total`, `page`, `limit`, `pages`
- Flags opcionales segun endpoint:
  - `mode`
  - `reused`
  - `requiereConfirmacionDueno`
  - `aprobacionAdministrativaAutomatica`

#### `ApiError`

- `success`: `false`
- `message`: mensaje principal de negocio o sistema
- `error`: texto tecnico opcional
- `errors`: arreglo opcional de errores de validacion
- `requiredAction`: bandera opcional en algunos `403`, por ejemplo `CREAR_SOLICITUD_ORGANIZACION`

### 5.2 Tipos base del modulo

#### `Organizacion`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | string | Mongo ID |
| `nombre` | string | Obligatorio |
| `descripcion` | string | Opcional |
| `participantes` | `ParticipanteOrganizacion[]` | Puede venir poblado |
| `activa` | boolean | Soft delete |
| `createdBy` | `UsuarioResumen` | Creador |
| `createdAt` | string/date | Fecha de alta |
| `updatedAt` | string/date | Fecha de actualizacion |
| `stats` | objeto opcional | Solo en detalle de organizacion |

#### `ParticipanteOrganizacion`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `usuario` | `UsuarioResumen` o string | Usuario participante |
| `rol` | `Administrador` \| `Miembro` | Rol dentro de la organizacion |
| `fechaIngreso` | string/date | Fecha de alta |
| `agregadoPor` | `UsuarioResumen` o string | Quien agrego |

#### `Cuenta`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | string | Mongo ID |
| `nombre` | string | Obligatorio |
| `descripcion` | string | Opcional |
| `tipoCuenta` | enum | `Bancaria`, `Efectivo`, `Tarjeta`, `Billetera Digital`, `Otra` |
| `moneda` | enum | `MXN`, `USD`, `EUR` |
| `saldoInicial` | number | Puede omitirse si el usuario no puede verlo |
| `saldoActual` | number | Puede omitirse si el usuario no puede verlo |
| `organizacion` | `OrganizacionResumen` o string | Organizacion dueña |
| `propietario` | `UsuarioResumen` o string | Propietario real |
| `datosBancarios` | objeto | Beneficiario, banco, clabe, numeroCuenta, referencia |
| `activa` | boolean | Estado de cuenta |
| `stripeAccountRef` | enum | `Ninguna`, `ISRA`, `FERNANDO`, `CARLOS` |
| `miRol` | string opcional | `Propietario`, `Participante`, `ParticipanteOrganizacion` |
| `puedeVerSaldo` | boolean opcional | Control de ocultamiento |

#### `ParticipanteCuenta`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | string | Mongo ID |
| `cuenta` | string o `CuentaResumen` | Cuenta asociada |
| `usuario` | `UsuarioResumen` | Participante |
| `rol` | `Propietario` \| `Participante` | Rol dentro de la cuenta |
| `permisos` | objeto | `puedeVerTransacciones`, `puedeCrearSolicitudes`, `puedeVerSaldo` |
| `activo` | boolean | Estado del participante |
| `fechaIngreso` | string/date | Alta |
| `agregadoPor` | `UsuarioResumen` o string | Quien lo agrego |

#### `Transaccion`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | string | Mongo ID |
| `cuenta` | `CuentaResumen` o string | Cuenta de cargo o abono |
| `tipo` | `Ingreso` \| `Gasto` \| `Transferencia` | Tipo de movimiento |
| `monto` | number | Monto |
| `concepto` | string | Descripcion corta |
| `descripcion` | string | Descripcion larga opcional |
| `categoria` | string | Categoria financiera |
| `esProveedorExterno` | boolean | Si aplica |
| `proveedor` | objeto | Snapshot del proveedor cuando aplica |
| `proveedorExternoCatalogado` | string opcional | Referencia al catalogo |
| `fecha` | string/date | Fecha operativa |
| `creadoPor` | `UsuarioResumen` | Autor |
| `aprobada` | boolean | Estado interno |
| `aprobadaPor` | `UsuarioResumen` | Quien aprobo |
| `fechaAprobacion` | string/date | Fecha de aprobacion |
| `solicitudOriginal` | string o objeto | Solicitud origen |
| `comprobanteConfirmacion` | objeto opcional | Archivo subido en aprobacion/confirmacion |
| `archivosAdjuntos` | arreglo | Adjuntos estructurados |
| `imagenes` | string[] | Nombres de archivos remotos |
| `reservaAsociada` | objeto opcional | Relacion con reserva |
| `transferenciaVinculada` | `TransaccionResumen` o string | Contraparte de transferencia |
| `cuentaDestino` | `CuentaResumen` o string | Cuenta destino en transferencia saliente |
| `etiquetas` | string[] | Opcional |
| `notas` | string | Opcional |

#### `SolicitudCuenta`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | string | Mongo ID |
| `cuenta` | `CuentaResumen` o string | Cuenta destino o cuenta solicitada |
| `tipo` | enum | `Ingreso`, `Gasto`, `Transferencia` |
| `monto` | number | Monto |
| `concepto` | string | Concepto |
| `descripcion` | string | Opcional |
| `categoria` | string | Categoria |
| `esProveedorExterno` | boolean | Si aplica |
| `proveedorNombre` | string | Snapshot proveedor |
| `proveedorBeneficiario` | string | Snapshot proveedor |
| `proveedorBanco` | string | Snapshot proveedor |
| `proveedorCuentaClabe` | string | Snapshot proveedor |
| `proveedorExternoCatalogado` | string opcional | Referencia |
| `cuentaDestino` | `CuentaResumen` o string | Solo transferencias |
| `fecha` | string/date | Fecha solicitada |
| `solicitadoPor` | `UsuarioResumen` | Autor |
| `estado` | `Pendiente` \| `Aprobada` \| `Rechazada` \| `Cancelada` | Estado final |
| `propietarioCuenta` | `UsuarioResumen` | Dueño de la cuenta |
| `imagenes` | string[] | Comprobantes |
| `respuesta` | objeto | Procesamiento del propietario |
| `transaccionCreada` | `Transaccion` o string | Si fue aprobada |

#### `SolicitudOrganizacion`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | string | Mongo ID |
| `organizacion` | `OrganizacionResumen` o string | Organizacion |
| `cuenta` | `CuentaResumen` o string | Cuenta afectada |
| `tipo` | enum | `Ingreso`, `Gasto`, `Transferencia` |
| `monto` | number | Monto |
| `concepto` | string | Concepto |
| `descripcion` | string | Opcional |
| `categoria` | string | Categoria |
| `esProveedorExterno` | boolean | Si aplica |
| `proveedorNombre` | string | Snapshot proveedor |
| `proveedorBeneficiario` | string | Snapshot proveedor |
| `proveedorBanco` | string | Snapshot proveedor |
| `proveedorCuentaClabe` | string | Snapshot proveedor |
| `proveedorExternoCatalogado` | string opcional | Referencia a catalogo |
| `cuentaDestino` | `CuentaResumen` o string | Solo transferencias |
| `fecha` | string/date | Fecha operativa |
| `solicitadoPor` | `UsuarioResumen` | Solicitante |
| `propietarioCuenta` | `UsuarioResumen` | Dueño que puede confirmar |
| `rolSolicitante` | `Administrador` \| `Miembro` | Rol en la organizacion |
| `workflowVersion` | number | Flujo actual de confirmacion |
| `estado` | `Pendiente` \| `PendienteConfirmacionDueno` \| `Aprobada` \| `Rechazada` \| `RechazadaPorDueno` \| `Cancelada` | Estado del workflow |
| `aprobacionAdministrativa` | objeto | Registro de paso administrativo |
| `confirmacionDueno` | objeto | Registro de confirmacion del dueño |
| `respuesta` | objeto | Metadatos de rechazo o proceso |
| `imagenes` | string[] | Imagenes adjuntas |
| `transaccionCreada` | `Transaccion` o string | Si ya se aplico el movimiento |

#### `TransaccionRecurrente`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | string | Mongo ID |
| `cuenta` | `CuentaResumen` o string | Cuenta objetivo |
| `tipo` | `Ingreso` \| `Gasto` | Tipo |
| `monto` | number | Monto |
| `concepto` | string | Concepto |
| `descripcion` | string | Opcional |
| `categoria` | string | Categoria |
| `frecuencia` | enum | `Diaria`, `Semanal`, `Quincenal`, `Mensual`, `Bimestral`, `Trimestral`, `Anual` |
| `diaEjecucion` | number opcional | Solo aplica cuando se use |
| `fechaInicio` | string/date | Inicio |
| `fechaFin` | string/date | Fin opcional |
| `activa` | boolean | Activa o pausada |
| `ultimaEjecucion` | string/date | Ultima corrida |
| `proximaEjecucion` | string/date | Siguiente corrida |
| `creadoPor` | `UsuarioResumen` | Autor |
| `notificarAntes` | number | Dias de aviso |
| `ejecutarAutomaticamente` | boolean | Si no requiere confirmacion manual |
| `transaccionesGeneradas` | arreglo | Historial de ejecuciones |

#### `PagoDiferido`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | string | Mongo ID |
| `cuenta` | `CuentaResumen` o string | Cuenta afectada |
| `montoTotal` | number | Total financiado |
| `numeroPagos` | number | Total de cuotas |
| `montoPorPago` | number | Cuota calculada |
| `concepto` | string | Concepto |
| `descripcion` | string | Opcional |
| `categoria` | string | Categoria |
| `fechaInicio` | string/date | Primer pago |
| `interes` | number | Porcentaje mensual |
| `cuotas` | `CuotaDiferido[]` | Plan de pagos |
| `estado` | `Activo` \| `Completado` \| `Cancelado` | Estado global |
| `creadoPor` | `UsuarioResumen` | Autor |
| `progreso` | objeto opcional | `pagadas`, `total`, `porcentaje`, `montoPagado`, `montoRestante` |

#### `CuotaDiferido`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `numero` | number | Numero secuencial |
| `monto` | number | Monto de la cuota |
| `fechaProgramada` | string/date | Fecha programada |
| `fechaPago` | string/date | Si fue pagada |
| `transaccion` | `Transaccion` o string | Movimiento generado |
| `estado` | `Pendiente` \| `Pagada` \| `Vencida` | Estado |

#### `ProveedorExterno`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | string | Mongo ID |
| `organizacion` | string | Organizacion dueña |
| `nombre` | string | Nombre comercial |
| `beneficiario` | string | Nombre de beneficiario |
| `banco` | string | Banco |
| `cuentaClabe` | string | Cuenta o CLABE |
| `activa` | boolean | Soft delete |
| `createdBy` | string | Quien lo creo |
| `createdAt` | string/date | Alta |
| `updatedAt` | string/date | Actualizacion |

#### `DashboardPersonalPayload`

- `resumenGeneral`
  - `totalSaldosIniciales`
  - `totalIngresos`
  - `totalGastos`
  - `saldoTotal`
  - `neto`
  - `numeroCuentas`
  - `numeroTransacciones`
- `transaccionesPorCuenta`: arreglo con `nombre`, `ingresos`, `gastos`, `cantidad`
- `transaccionesRecientes`: arreglo con `_id`, `concepto`, `monto`, `tipo`, `fecha`, `cuenta`, `categoria`
- `resumenOrganizaciones`: arreglo con `organizacion`, `ingresos`, `gastos`, `cantidad`, `balance`

#### `DashboardOrganizacionPayload`

- `resumenGeneral`
  - `totalSaldosIniciales`
  - `totalIngresos`
  - `totalGastos`
  - `saldoTotal`
  - `numeroCuentas`
  - `numeroTransacciones`
- `resumenMes`
  - `ingresosMes`
  - `gastosMes`
  - `netoMes`
  - `numeroTransacciones`
- `participantes`
  - `unicos`
  - `porRol`
- `transaccionesPorCategoria`: arreglo con `categoria`, `total`, `cantidad`, `tipo`
- `topUsuarios`: arreglo con `nombre`, `ingresos`, `gastos`, `cantidad`
- `transaccionesPorMes`: arreglo con `mes`, `ingresos`, `gastos`, `neto`
- `miParticipacion`
  - `ingresos`
  - `gastos`
  - `neto`
  - `numeroCuentas`
  - `numeroTransacciones`

#### `EstadoCuentaPayload`

- `movimientos`: arreglo de objetos con:
  - `fecha`
  - `cuentaId`
  - `cuentaNombre`
  - `moneda`
  - `tipo`
  - `categoria`
  - `concepto`
  - `estado`
  - `movimiento`
  - `saldoPrevio`
  - `saldoActual`
  - `creadoPor`
  - `transaccionId`
- `resumen`
  - `totalMovimientos`
  - `totalCuentas`
- `rango`
  - `fechaInicio`
  - `fechaFin`

## 6. Catalogo completo de endpoints

### 6.1 Vista del modulo

#### `GET /finanzas`

- Uso: renderiza la vista principal del modulo.
- Acceso: usuario autenticado.
- Body: ninguno.
- Query: ninguna.
- Respuesta: HTML renderizado con variables de vista `user`, `userId`, `isMasterAdmin`, `canEditCategorias`.
- Uso en la app actual: si.

### 6.2 Endpoint de apoyo externo al modulo

#### `GET /api/usuarios/all`

- Uso: poblar selectores de usuarios para participantes de organizacion y de cuenta.
- Acceso: depende de la ruta general de usuarios; la vista actual lo consume sin body.
- Body: ninguno.
- Query: ninguna.
- Respuesta exitosa: `ApiSuccess<Usuario[]>`.
- Campo `data`: arreglo completo de usuarios del sistema.
- Uso en la app actual: si.

### 6.3 Dashboard

#### `GET /api/sw/dashboard/personal`

- Uso: carga el dashboard personal.
- Acceso: usuario autenticado.
- Query:
  - `fechaDesde` opcional en formato `YYYY-MM-DD`
  - `fechaHasta` opcional en formato `YYYY-MM-DD`
- Body: ninguno.
- Respuesta exitosa: `ApiSuccess<DashboardPersonalPayload>`.
- Errores frecuentes:
  - `401` no autenticado
  - `500` error al obtener estadisticas personales
- Uso en la app actual: si.

#### `GET /api/sw/dashboard/organizacion/:organizacionId`

- Uso: carga el dashboard de una organizacion.
- Acceso: participante de la organizacion, creador de la organizacion o usuario que participe en una cuenta de esa organizacion.
- Path:
  - `organizacionId`
- Query:
  - `fechaDesde` opcional
  - `fechaHasta` opcional
- Body: ninguno.
- Respuesta exitosa: `ApiSuccess<DashboardOrganizacionPayload>`.
- Errores frecuentes:
  - `404` organizacion no encontrada
  - `403` no tiene acceso a esta organizacion
  - `500` error al obtener estadisticas
- Uso en la app actual: si.

### 6.4 Organizaciones

#### `POST /api/sw/organizaciones`

- Uso: crear organizacion.
- Acceso: ruta protegida por `requireManageOrganizations`; en la vista actual solo se expone a `MASTER ADMIN`.
- Content-Type: `application/json`.
- Body:
  - `nombre`: string requerido, 3 a 100 caracteres
  - `descripcion`: string opcional, maximo 500
  - `participantes`: arreglo opcional de objetos con `usuario` y `rol`
- Respuesta exitosa: `ApiSuccess<Organizacion>` con `message = "Organizacion creada exitosamente"`.
- Errores frecuentes:
  - `400` validacion
  - `500` error al crear la organizacion
- Uso en la app actual: si.

#### `GET /api/sw/organizaciones`

- Uso: listar organizaciones visibles para el usuario.
- Acceso: ruta protegida por `requireViewOrganizations`.
- Query:
  - `activa`: `true` o `false` opcional
  - `page`: default `1`
  - `limit`: default `10`
- Body: ninguno.
- Respuesta exitosa: `ApiSuccess<Organizacion[]>` con `pagination`.
- Reglas:
  - Trae organizaciones donde el usuario es participante.
  - Tambien trae organizaciones legacy donde el usuario es creador.
- Uso en la app actual: si.

#### `GET /api/sw/organizaciones/:id`

- Uso: obtener detalle de una organizacion.
- Acceso: participante o creador de la organizacion.
- Path:
  - `id`
- Respuesta exitosa: `ApiSuccess<Organizacion>` con `stats.totalCuentas` y `stats.cuentasActivas`.
- Errores frecuentes:
  - `404` organizacion no encontrada
  - `403` no tienes acceso a esta organizacion
- Uso en la app actual: si.

#### `PUT /api/sw/organizaciones/:id`

- Uso: actualizar nombre, descripcion o estado activo.
- Acceso: ruta protegida por `requireManageOrganizations`; en la app actual lo usan `MASTER ADMIN` y administradores segun boton.
- Content-Type: `application/json`.
- Body posible:
  - `nombre`
  - `descripcion`
  - `activa`
- Respuesta exitosa: `ApiSuccess<Organizacion>` con `message = "Organizacion actualizada exitosamente"`.
- Errores frecuentes:
  - `400` validacion
  - `404` organizacion no encontrada
- Uso en la app actual: si.

#### `DELETE /api/sw/organizaciones/:id`

- Uso: desactivar organizacion por endpoint dedicado.
- Acceso: ruta protegida por `requireManageOrganizations`.
- Body: ninguno.
- Respuesta exitosa: `ApiSuccess<Organizacion>` con `message = "Organizacion desactivada exitosamente"`.
- Errores frecuentes:
  - `404` organizacion no encontrada
  - `400` si todavia tiene cuentas activas
- Uso en la app actual: no. La vista actual usa `PUT` para el toggle.

#### `GET /api/sw/organizaciones/:id/cuentas`

- Uso: listar cuentas de una organizacion.
- Acceso: participante de la organizacion.
- Query:
  - `activa` opcional
- Respuesta exitosa: `ApiSuccess<Cuenta[]>`.
- Errores frecuentes:
  - `404` organizacion no encontrada
  - `403` no tienes acceso a esta organizacion
- Uso en la app actual: si.

#### `POST /api/sw/organizaciones/:id/participantes`

- Uso: agregar participante a una organizacion existente.
- Acceso: administrador de la organizacion.
- Content-Type: `application/json`.
- Body:
  - `usuarioId`: string requerido
  - `rol`: `Administrador` o `Miembro`, opcional, default `Miembro`
- Respuesta exitosa: `ApiSuccess<Organizacion>` con `message = "Participante agregado exitosamente"`.
- Errores frecuentes:
  - `400` falta `usuarioId` o el usuario ya participa
  - `403` solo los administradores pueden agregar participantes
  - `404` organizacion no encontrada
- Uso en la app actual: si.

#### `DELETE /api/sw/organizaciones/:id/participantes/:participanteId`

- Uso: eliminar participante de organizacion.
- Acceso: administrador de la organizacion.
- Path:
  - `id`
  - `participanteId`
- Respuesta exitosa: `ApiSuccess<Organizacion>` con `message = "Participante eliminado exitosamente"`.
- Errores frecuentes:
  - `400` no se puede eliminar al creador o dejar a la organizacion sin administradores
  - `403` solo los administradores pueden eliminar participantes
  - `404` organizacion no encontrada
- Uso en la app actual: si.

#### `PUT /api/sw/organizaciones/:id/participantes/:participanteId/rol`

- Uso: actualizar rol en una organizacion.
- Acceso: administrador de la organizacion.
- Content-Type: `application/json`.
- Body:
  - `rol`: `Administrador` o `Miembro`
- Respuesta exitosa: `ApiSuccess<Organizacion>` con `message = "Rol actualizado exitosamente"`.
- Errores frecuentes:
  - `400` rol invalido, intento de bajar al ultimo administrador o intento de cambiar rol del creador
  - `403` solo administradores pueden cambiar roles
  - `404` organizacion o participante no encontrado
- Uso en la app actual: si.

### 6.5 Cuentas

#### `GET /api/sw/cuentas/:id/stripe-config`

- Uso: obtener referencia Stripe de una cuenta.
- Acceso: publico.
- Respuesta exitosa:
  - `stripeAccountRef`
  - `hasStripe`
- Errores frecuentes:
  - `404` cuenta no encontrada
  - `500` error del servidor
- Uso en la app actual: no en la vista `finanzas`, pero si forma parte del modulo.

#### `POST /api/sw/cuentas`

- Uso: crear cuenta.
- Acceso: ruta protegida por `requireCreateAccounts`; en la vista actual se expone con el modal `Nueva Cuenta`.
- Content-Type: `application/json`.
- Body:
  - `nombre`: requerido
  - `organizacion`: requerido
  - `tipoCuenta`: opcional
  - `moneda`: opcional
  - `saldoInicial`: opcional
  - `descripcion`: opcional
  - `datosBancarios`: objeto opcional
  - `stripeAccountRef`: opcional
- Respuesta exitosa: `ApiSuccess<Cuenta>` con `message = "Cuenta creada exitosamente"`.
- Errores frecuentes:
  - `400` organizacion invalida, nombre duplicado en la misma organizacion, validacion
  - `401` usuario no autenticado
  - `500` error al crear la cuenta
- Uso en la app actual: si.

#### `GET /api/sw/cuentas/mis-cuentas`

- Uso: obtener las cuentas visibles para el usuario.
- Acceso: ruta protegida por `requireViewAccounts`.
- Query opcional:
  - `organizacion`
  - `activa`
- Respuesta exitosa: `ApiSuccess<Cuenta[]>`.
- Reglas especiales:
  - Puede incluir cuentas donde el usuario es participante directo.
  - Puede incluir cuentas de organizaciones donde participa, aun si no es participante directo de la cuenta.
  - En esos casos puede venir `miRol = ParticipanteOrganizacion`.
  - Si no puede ver saldo, `saldoActual` y `saldoInicial` se omiten.
- Uso en la app actual: si.

#### `GET /api/sw/cuentas/para-solicitudes`

- Uso: cargar cuentas disponibles para crear solicitudes desde la UI.
- Acceso: autenticado.
- Respuesta exitosa: `ApiSuccess<CuentaResumen[]>`.
- Regla especial:
  - Devuelve cuentas activas del sistema excepto las que pertenecen al propio usuario.
  - El payload omite `saldoActual`, `saldoInicial` y `datosBancarios`.
- Uso en la app actual: si.

#### `GET /api/sw/cuentas/validas-habitacion`

- Uso: obtener cuentas con datos bancarios completos para otros modulos.
- Acceso: autenticado.
- Respuesta exitosa: `ApiSuccess<CuentaResumen[]>`.
- Uso en la app actual: no en la vista `finanzas`.

#### `GET /api/sw/cuentas/:id`

- Uso: detalle de cuenta.
- Acceso: participante activo de la cuenta.
- Respuesta exitosa: `ApiSuccess<Cuenta>` extendido con:
  - `participantes`
  - `miRol`
  - `puedeVerSaldo`
- Errores frecuentes:
  - `404` cuenta no encontrada
  - `403` no tiene acceso a esta cuenta
- Uso en la app actual: si.

#### `PUT /api/sw/cuentas/:id`

- Uso: actualizar cuenta.
- Acceso: ruta protegida por `requireEditAccounts` + `requireCuentaPropietario`.
- Content-Type: `application/json`.
- Body posible:
  - `nombre`
  - `descripcion`
  - `activa`
  - `stripeAccountRef`
  - `datosBancarios`
- Respuesta exitosa: `ApiSuccess<Cuenta>` con `message = "Cuenta actualizada exitosamente"`.
- Regla especial:
  - `saldoInicial` no se actualiza despues de crear la cuenta.
- Uso en la app actual: si.

#### `POST /api/sw/cuentas/:id/participantes`

- Uso: agregar participante a una cuenta.
- Acceso: propietario de la cuenta.
- Content-Type: `application/json`.
- Body:
  - `usuarioId`: requerido
  - `rol`: opcional, normalmente `Participante`
  - `permisos`: objeto opcional
- Respuesta exitosa:
  - `201 ApiSuccess<ParticipanteCuenta>` cuando se crea nuevo
  - `200 ApiSuccess<ParticipanteCuenta>` cuando se reactiva uno existente
- Errores frecuentes:
  - `400` usuario inexistente, intento de agregarse a si mismo, ya participa, validacion
  - `403` solo el propietario puede agregar participantes
  - `404` cuenta no encontrada
- Uso en la app actual: si.

#### `GET /api/sw/cuentas/:id/participantes`

- Uso: listar participantes de una cuenta.
- Acceso: ruta protegida por `requireViewAccounts` + `requireCuentaAcceso`.
- Query opcional:
  - `activo`
- Respuesta exitosa: `ApiSuccess<ParticipanteCuenta[]>`.
- Uso en la app actual: si.

#### `DELETE /api/sw/cuentas/:id/participantes/:usuarioId`

- Uso: remover participante de una cuenta.
- Acceso: propietario de la cuenta.
- Respuesta exitosa: `ApiSuccess<void>` con `message = "Participante removido exitosamente"`.
- Errores frecuentes:
  - `403` solo el propietario puede remover participantes
  - `404` cuenta o participante no encontrado
- Uso en la app actual: si.

#### `PUT /api/sw/cuentas/:id/participantes/:participanteId/permisos`

- Uso: actualizar permisos de un participante de cuenta.
- Acceso: propietario de la cuenta.
- Content-Type: `application/json`.
- Body:
  - `permisos`: objeto requerido
- Respuesta exitosa: `ApiSuccess<ParticipanteCuenta>` con `message = "Permisos actualizados exitosamente"`.
- Errores frecuentes:
  - `400` permisos invalidos o intento de cambiar al propietario
  - `404` participante no encontrado
- Uso en la app actual: no hay boton visible en la vista actual.

#### `POST /api/sw/cuentas/:id/recalcular-saldo`

- Uso: recalcular saldo manualmente.
- Acceso: propietario de la cuenta.
- Respuesta exitosa: `ApiSuccess<{ saldoAnterior: number, saldoNuevo: number }>`.
- Uso en la app actual: no.

### 6.6 Transacciones

#### `POST /api/sw/transacciones`

- Uso: crear transaccion directa aprobada.
- Acceso: propietario de la cuenta.
- Content-Type: `application/json`.
- Body:
  - `cuentaId`: requerido
  - `tipo`: requerido
  - `monto`: requerido
  - `concepto`: requerido
  - `descripcion`: opcional
  - `categoria`: opcional, validada
  - `fecha`: opcional
  - `etiquetas`: opcional
  - `notas`: opcional
  - `imagenes`: opcional
  - `reservaAsociada`: opcional
- Respuesta exitosa: `ApiSuccess<Transaccion>` con `message = "Transaccion creada exitosamente"`.
- Errores frecuentes:
  - `404` cuenta no encontrada
  - `403` solo el propietario puede crear transacciones directamente
  - `403` con `requiredAction = CREAR_SOLICITUD_ORGANIZACION` si la gobernanza obliga a crear solicitud organizacional
- Uso en la app actual: si.

#### `POST /api/sw/transferencias`

- Uso: crear transferencia entre cuentas.
- Acceso: usuario con permiso de acuerdo al metodo interno y a la gobernanza de la organizacion; la UI lo usa como flujo del propietario.
- Content-Type: `application/json`.
- Body:
  - `cuentaId`: cuenta origen
  - `cuentaDestinoId`: cuenta destino
  - `monto`
  - `concepto`
  - `descripcion`
- Respuesta exitosa: `ApiSuccess<{ transaccionOrigen: Transaccion, transaccionDestino: Transaccion }>`.
- Errores frecuentes:
  - `404` cuenta origen no encontrada
  - `403` con `requiredAction = CREAR_SOLICITUD_ORGANIZACION`
  - `500` cuando el metodo estatico de transferencia rechaza por reglas de negocio
- Uso en la app actual: si.

#### `GET /api/sw/transacciones/cuenta/:cuentaId`

- Uso: listar transacciones de una cuenta.
- Acceso: usuario con acceso real a transacciones de esa cuenta.
- Query:
  - `tipo`
  - `categoria`
  - `fechaInicio`
  - `fechaFin`
  - `page`, default `1`
  - `limit`, default `20`
  - `aprobada`, default `true`
- Respuesta exitosa: `ApiSuccess<Transaccion[]>` con `pagination`.
- Errores frecuentes:
  - `403` no tiene acceso a esta cuenta
- Uso en la app actual: si.

#### `GET /api/sw/transacciones/:id`

- Uso: obtener detalle de una transaccion.
- Acceso: usuario con acceso a esa cuenta.
- Respuesta exitosa: `ApiSuccess<Transaccion>` poblada con `cuenta`, `creadoPor`, `aprobadaPor`, `solicitudOriginal`, `transferenciaVinculada`, `cuentaDestino`, `reservaAsociada`.
- Errores frecuentes:
  - `404` transaccion no encontrada
  - `403` no tiene acceso a esta transaccion
- Uso en la app actual: si.

#### `PUT /api/sw/transacciones/:id/notas`

- Uso: actualizar notas o etiquetas de una transaccion aprobada.
- Acceso: propietario de la cuenta.
- Content-Type: `application/json`.
- Body posible:
  - `notas`
  - `etiquetas`
- Respuesta exitosa: `ApiSuccess<Transaccion>` con `message = "Transaccion actualizada exitosamente"`.
- Uso en la app actual: no.

#### `DELETE /api/sw/transacciones/:id`

- Uso: eliminar transaccion no aprobada.
- Acceso: creador de la transaccion o propietario de la cuenta.
- Respuesta exitosa: `ApiSuccess<void>` con `message = "Transaccion eliminada exitosamente"`.
- Errores frecuentes:
  - `400` no se pueden eliminar transacciones aprobadas
  - `403` no tiene permisos para eliminar esta transaccion
  - `404` transaccion no encontrada
- Uso en la app actual: no visible.

#### `GET /api/sw/transacciones/cuenta/:cuentaId/resumen`

- Uso: obtener resumen de cuenta.
- Acceso: usuario con acceso a la cuenta.
- Query:
  - `fechaInicio`
  - `fechaFin`
- Respuesta exitosa: `ApiSuccess<{ cuenta: CuentaResumenSaldo, resumen: objeto }>`.
- Uso en la app actual: no.

#### `GET /api/sw/transacciones/cuenta/:cuentaId/por-categoria`

- Uso: agrupar transacciones por categoria.
- Acceso: participante activo de la cuenta.
- Query:
  - `fechaInicio`
  - `fechaFin`
- Respuesta exitosa: `ApiSuccess<any[]>` con agregados por categoria.
- Uso en la app actual: no.

#### `GET /api/sw/transacciones/cuenta/:cuentaId/exportar-csv`

- Uso: exportar transacciones a CSV desde backend.
- Acceso: ruta protegida por `requireExportTransactions`.
- Query opcional:
  - `tipo`
  - `categoria`
  - `fechaInicio`
  - `fechaFin`
- Respuesta exitosa: archivo `text/csv; charset=utf-8`.
- Uso en la app actual: no. La vista actual usa `estado-cuenta` y arma XLSX/PDF en cliente.

#### `GET /api/sw/transacciones/estado-cuenta`

- Uso: obtener movimientos con saldo previo y saldo actual para exportes y estado de cuenta.
- Acceso: usuario con acceso a las cuentas consultadas.
- Query:
  - `cuentaId` opcional. Si no se manda, el backend recorre todas las cuentas a las que el usuario tiene acceso.
  - `fechaInicio` opcional, pero la UI la exige para exportar.
  - `fechaFin` opcional, pero la UI la exige para exportar.
- Respuesta exitosa: `ApiSuccess<EstadoCuentaPayload>`.
- Errores frecuentes:
  - `400` fechas invalidas o rango invalido
  - `403` no tiene acceso a la cuenta seleccionada
- Uso en la app actual: si.

#### `POST /api/sw/transacciones/:id/imagenes`

- Uso: subir imagenes a una transaccion existente.
- Acceso: propietario de la cuenta.
- Content-Type: `multipart/form-data`.
- Field:
  - `imagenes`: hasta 3 archivos por request y hasta 3 acumuladas por transaccion
- Respuesta exitosa: `ApiSuccess<{ imagenesSubidas: number, rutas: string[] }>`.
- Errores frecuentes:
  - `400` no se proporcionaron archivos o se rebasa el limite
  - `404` transaccion no encontrada
  - `403` no tiene permiso para agregar imagenes
- Uso en la app actual: si.

#### `DELETE /api/sw/transacciones/:id/imagenes/:imagenNombre`

- Uso: eliminar una imagen de una transaccion.
- Acceso: propietario de la cuenta.
- Respuesta exitosa: `ApiSuccess<void>` con `message = "Imagen eliminada con exito"`.
- Errores frecuentes:
  - `404` transaccion no encontrada o la imagen no existe
  - `403` no tiene permiso para eliminar imagenes
- Uso en la app actual: si.

### 6.7 Solicitudes de cuenta

#### `POST /api/sw/solicitudes`

- Uso: crear solicitud de cuenta.
- Acceso: usuario autenticado.
- Content-Type:
  - La UI actual usa `application/json`.
  - La ruta tambien admite `multipart/form-data` con un unico archivo `comprobante`.
- Body posible:
  - `cuentaId`
  - `tipo`
  - `monto`
  - `concepto`
  - `descripcion`
  - `categoria`
  - `fecha`
  - `etiquetas`
  - `notas`
  - `imagenes`
  - `reservaAsociada`
  - `cuentaDestinoId` en transferencias
  - `esProveedorExterno`
  - `proveedorNombre`
  - `proveedorBeneficiario`
  - `proveedorBanco`
  - `proveedorCuentaClabe`
  - `bypassValidacion` para usos internos
- Respuesta exitosa: `ApiSuccess<SolicitudCuenta>` con `message = "Solicitud creada exitosamente"`.
- Reglas importantes:
  - Si la cuenta esta inactiva, falla.
  - Si el solicitante es propietario de la cuenta para `Ingreso` o `Gasto`, falla porque debe crear transaccion directa.
  - En transferencias del flujo de solicitud por cuenta, el usuario debe ser propietario de la cuenta origen enviada como `cuentaDestinoId`.
- Errores frecuentes:
  - `400` propietario no debe solicitar, cuenta destino faltante o reglas de transferencia
  - `403` solo puedes crear solicitudes de transferencia desde tus cuentas propias
  - `404` cuenta o cuenta destino no encontrada
- Uso en la app actual: si.

#### `GET /api/sw/solicitudes/mis-solicitudes`

- Uso: listar solicitudes creadas por el usuario.
- Acceso: autenticado.
- Query opcional:
  - `estado`
  - `cuentaId`
- Respuesta exitosa: `ApiSuccess<SolicitudCuenta[]>`.
- Uso en la app actual: si.

#### `GET /api/sw/solicitudes/cuenta/:cuentaId/pendientes`

- Uso: listar solicitudes pendientes de una cuenta.
- Acceso: propietario de la cuenta.
- Respuesta exitosa: `ApiSuccess<SolicitudCuenta[]>`.
- Uso en la app actual: no.

#### `GET /api/sw/solicitudes/cuenta/:cuentaId`

- Uso: listar solicitudes de una cuenta especifica.
- Acceso: participante activo de la cuenta.
- Query:
  - `estado`
  - `page`
  - `limit`
- Respuesta exitosa: `ApiSuccess<SolicitudCuenta[]>` con `pagination`.
- Uso en la app actual: no. La vista principal usa `mis-solicitudes`.

#### `GET /api/sw/solicitudes/:id`

- Uso: obtener detalle de una solicitud de cuenta.
- Acceso: participante activo de la cuenta.
- Respuesta exitosa: `ApiSuccess<SolicitudCuenta>` poblada con `cuenta`, `solicitadoPor`, `propietarioCuenta`, `respuesta.procesadaPor`, `transaccionCreada`, `reservaAsociada`.
- Errores frecuentes:
  - `404` solicitud no encontrada
  - `403` no tiene acceso a esta solicitud
- Uso en la app actual: si.

#### `POST /api/sw/solicitudes/:id/procesar`

- Uso: aprobar o rechazar solicitud de cuenta.
- Acceso: propietario de la cuenta.
- Content-Type:
  - `application/json` para rechazo simple
  - `multipart/form-data` cuando se adjunta `comprobanteConfirmacion` al aprobar
- Body:
  - `accion`: `aprobar` o `rechazar`
  - `comentario`: opcional
  - `motivoRechazo`: opcional en rechazo
  - `comprobanteConfirmacion`: archivo opcional en aprobacion
- Respuesta exitosa:
  - Aprobacion: `ApiSuccess<{ solicitud: SolicitudCuenta, transaccion: Transaccion }>` o estructura equivalente devuelta por el metodo interno de aprobacion
  - Rechazo: `ApiSuccess<SolicitudCuenta>` o resultado del metodo interno de rechazo
- Errores frecuentes:
  - `400` solicitud ya procesada
  - `403` solo el propietario puede procesar solicitudes
  - `404` solicitud no encontrada
- Uso en la app actual: si.

#### `POST /api/sw/solicitudes/:id/cancelar`

- Uso: cancelar solicitud pendiente.
- Acceso: solicitante.
- Respuesta exitosa: `ApiSuccess<SolicitudCuenta>` o `ApiSuccess<void>` segun el metodo del modelo, con mensaje de cancelacion.
- Errores frecuentes:
  - `403` solo el solicitante puede cancelar
  - `400` si ya no esta pendiente
  - `404` solicitud no encontrada
- Uso en la app actual: si.

#### `PUT /api/sw/solicitudes/:id`

- Uso: actualizar solicitud pendiente.
- Acceso: solicitante.
- Content-Type: `application/json`.
- Body: mismo esquema funcional de una solicitud de cuenta editable.
- Respuesta exitosa: `ApiSuccess<SolicitudCuenta>`.
- Uso en la app actual: no hay boton visible.

#### `GET /api/sw/solicitudes/cuenta/:cuentaId/estadisticas`

- Uso: obtener estadisticas de solicitudes de cuenta.
- Acceso: propietario de la cuenta.
- Respuesta exitosa: `ApiSuccess<object>`.
- Uso en la app actual: no.

#### `POST /api/sw/solicitudes/:id/imagenes`

- Uso: subir imagenes a una solicitud de cuenta.
- Acceso: solicitante.
- Content-Type: `multipart/form-data`.
- Field:
  - `imagenes`
- Respuesta exitosa: `ApiSuccess<{ imagenesSubidas: number, rutas: string[] }>`.
- Errores frecuentes:
  - `400` sin archivos o exceso de limite
  - `403` no tiene permiso para agregar imagenes
  - `404` solicitud no encontrada
- Uso en la app actual: si.

#### `DELETE /api/sw/solicitudes/:id/imagenes/:imagenNombre`

- Uso: eliminar imagen de solicitud de cuenta.
- Acceso: solicitante.
- Respuesta exitosa: `ApiSuccess<void>` con `message = "Imagen eliminada con exito"`.
- Errores frecuentes:
  - `404` solicitud no encontrada o imagen inexistente
  - `403` no tiene permiso
- Uso en la app actual: si.

### 6.8 Solicitudes organizacionales

#### `POST /api/sw/solicitudes-organizacion`

- Uso: crear una solicitud organizacional o, en ciertos casos, una transaccion directa.
- Acceso: miembro o administrador de la organizacion que tenga acceso a la cuenta seleccionada por el flujo.
- Content-Type: `application/json`.
- Body:
  - `organizacionId`: requerido
  - `cuentaId`: requerido
  - `tipo`: requerido
  - `monto`: requerido
  - `concepto`: requerido
  - `descripcion`: opcional
  - `categoria`: opcional
  - `fecha`: opcional
  - `etiquetas`: opcional
  - `notas`: opcional
  - `imagenes`: opcional
  - `cuentaDestinoId`: requerido si la solicitud es transferencia
  - `esProveedorExterno`: opcional
  - `proveedorExternoId`: opcional
  - `guardarProveedorExterno`: opcional
  - `proveedorNombre`
  - `proveedorBeneficiario`
  - `proveedorBanco`
  - `proveedorCuentaClabe`
- Respuesta exitosa posible 1:
  - `ApiSuccess<Transaccion>` o `ApiSuccess<{ transaccionOrigen, transaccionDestino }>`
  - `mode = directa`
  - Se usa cuando la operacion se resuelve sin crear solicitud.
- Respuesta exitosa posible 2:
  - `ApiSuccess<SolicitudOrganizacion>`
  - `mode = solicitud`
- Respuesta exitosa posible 3:
  - `ApiSuccess<{ solicitud: SolicitudOrganizacion, requiereConfirmacionDueno: true, aprobacionAdministrativaAutomatica: true }>`
  - `mode = solicitud`
  - Ocurre cuando se aprueba administrativamente en automatico pero aun falta el dueño.
- Errores frecuentes:
  - `404` cuenta no encontrada o inactiva
  - `400` la cuenta no pertenece a la organizacion seleccionada
  - `400` no se puede transferir a la misma cuenta o entre monedas distintas
  - `403` solo puede transferir hacia organizaciones donde participa
- Uso en la app actual: si.

#### `GET /api/sw/solicitudes-organizacion/mis-solicitudes`

- Uso: listar solicitudes organizacionales creadas por el usuario.
- Acceso: autenticado.
- Query opcional:
  - `estado`
  - `organizacionId`
- Respuesta exitosa: `ApiSuccess<SolicitudOrganizacion[]>`.
- Uso en la app actual: no como listado principal.

#### `GET /api/sw/solicitudes-organizacion/pendientes-confirmacion-dueno`

- Uso: listar solicitudes pendientes de confirmacion del dueño.
- Acceso: usuario autenticado; devuelve las que tienen `propietarioCuenta = userId`.
- Respuesta exitosa: `ApiSuccess<SolicitudOrganizacion[]>`.
- Uso en la app actual: si.

#### `GET /api/sw/solicitudes-organizacion/organizacion/:organizacionId/pendientes`

- Uso: listar solicitudes pendientes por organizacion.
- Acceso: administrador de la organizacion.
- Respuesta exitosa: `ApiSuccess<SolicitudOrganizacion[]>`.
- Uso en la app actual: no.

#### `GET /api/sw/solicitudes-organizacion/organizacion/:organizacionId/estadisticas`

- Uso: estadisticas de solicitudes organizacionales.
- Acceso: administrador de la organizacion.
- Respuesta exitosa: `ApiSuccess<{ estadisticas: any[], pendientes: number }>`.
- Uso en la app actual: no.

#### `GET /api/sw/solicitudes-organizacion/organizacion/:organizacionId`

- Uso: listar solicitudes organizacionales de una organizacion.
- Acceso: participante de la organizacion; para procesarlas se requieren reglas de rol adicionales en la UI y backend.
- Query:
  - `estado`
  - `page`
  - `limit`
- Respuesta exitosa: `ApiSuccess<SolicitudOrganizacion[]>` con `pagination`.
- Uso en la app actual: si.

#### `GET /api/sw/solicitudes-organizacion/:id`

- Uso: detalle de una solicitud organizacional.
- Acceso: participante de la organizacion o dueño de la cuenta cuando aplica el workflow de confirmacion.
- Respuesta exitosa: `ApiSuccess<SolicitudOrganizacion>`.
- Errores frecuentes:
  - `404` solicitud organizacional no encontrada
  - `403` sin acceso
- Uso en la app actual: si.

#### `POST /api/sw/solicitudes-organizacion/:id/procesar`

- Uso: aprobar o rechazar la etapa administrativa.
- Acceso: administrador de la organizacion.
- Content-Type: `application/json`.
- Body:
  - `accion`: `aprobar` o `rechazar`
  - `comentario`: opcional
  - `motivoRechazo`: opcional en rechazo
- Respuestas de aprobacion:
  - Si el administrador tambien es el dueño y el workflow lo permite:
    - `ApiSuccess<{ solicitud: SolicitudOrganizacion, transaccion: Transaccion }>`
    - mensaje: aprobada y confirmada por el dueño
  - Si aun falta el dueño:
    - `ApiSuccess<{ solicitud: SolicitudOrganizacion, requiereConfirmacionDueno: true }>`
    - mensaje: aprobada administrativamente y pendiente del dueño
  - Si no aplica confirmacion del dueño:
    - `ApiSuccess<{ solicitud: SolicitudOrganizacion, transaccion: Transaccion }>`
- Respuesta de rechazo:
  - `ApiSuccess<SolicitudOrganizacion>` o resultado del metodo interno de rechazo con mensaje `Solicitud organizacional rechazada`
- Errores frecuentes:
  - `400` solicitud ya procesada
  - `403` solo administradores pueden procesar, o un administrador no puede autoaprobar su propia solicitud cuando hay varios administradores
  - `404` solicitud no encontrada
- Uso en la app actual: si.

#### `POST /api/sw/solicitudes-organizacion/:id/confirmar-dueno`

- Uso: confirmar una solicitud organizacional como dueño de la cuenta.
- Acceso: `propietarioCuenta` del workflow.
- Content-Type: `multipart/form-data`.
- Body:
  - `comentario`: opcional
  - `validacionCompra`: boolean. La UI lo manda cuando la solicitud es a proveedor externo.
  - `comprobanteConfirmacion`: archivo opcional, pero la UI lo vuelve obligatorio si la solicitud es a proveedor externo.
- Respuesta exitosa: `ApiSuccess<{ solicitud: SolicitudOrganizacion, transaccion: Transaccion }>`.
- Errores frecuentes:
  - `403` solo el dueño de la cuenta puede confirmar
  - `404` solicitud organizacional no encontrada
  - `400` cuando faltan reglas de validacion definidas por el modelo del workflow
- Uso en la app actual: si.

#### `POST /api/sw/solicitudes-organizacion/:id/rechazar-dueno`

- Uso: rechazar una solicitud organizacional como dueño de la cuenta.
- Acceso: `propietarioCuenta`.
- Content-Type: `application/json`.
- Body:
  - `motivoRechazo`: requerido funcionalmente por la UI
- Respuesta exitosa: `ApiSuccess<SolicitudOrganizacion>` con `message = "Solicitud rechazada por el dueño de la cuenta"`.
- Errores frecuentes:
  - `403` solo el dueño puede rechazar
  - `404` solicitud organizacional no encontrada
- Uso en la app actual: si.

#### `POST /api/sw/solicitudes-organizacion/:id/cancelar`

- Uso: cancelar solicitud organizacional por parte del solicitante.
- Acceso: solicitante.
- Respuesta exitosa: `ApiSuccess<SolicitudOrganizacion>` con `message = "Solicitud organizacional cancelada exitosamente"`.
- Errores frecuentes:
  - `403` solo el solicitante puede cancelar la solicitud
  - `404` solicitud organizacional no encontrada
- Uso en la app actual: si.

#### `POST /api/sw/solicitudes-organizacion/:id/imagenes`

- Uso: subir imagenes a una solicitud organizacional.
- Acceso: solicitante.
- Content-Type: `multipart/form-data`.
- Field:
  - `imagenes`
- Respuesta exitosa: `ApiSuccess<{ imagenesSubidas: number, rutas: string[] }>`.
- Errores frecuentes:
  - `400` sin archivos o exceso de limite
  - `403` solo el solicitante puede agregar imagenes
  - `404` solicitud organizacional no encontrada
- Uso en la app actual: si.

#### `DELETE /api/sw/solicitudes-organizacion/:id/imagenes/:imagenNombre`

- Uso: eliminar imagen de solicitud organizacional.
- Acceso: solicitante.
- Respuesta exitosa: `ApiSuccess<void>` con `message = "Imagen eliminada con exito"`.
- Errores frecuentes:
  - `403` solo el solicitante puede eliminar imagenes
  - `404` solicitud organizacional no encontrada o imagen inexistente
- Uso en la app actual: si.

### 6.9 Transacciones recurrentes

#### `POST /api/sw/recurrentes`

- Uso: crear transaccion recurrente.
- Acceso: propietario de la cuenta en el comportamiento real actual.
- Content-Type: `application/json`.
- Body:
  - `cuentaId`
  - `tipo`
  - `monto`
  - `concepto`
  - `descripcion`
  - `categoria`
  - `frecuencia`
  - `diaEjecucion`
  - `fechaInicio`
  - `fechaFin`
  - `notificarAntes`
  - `ejecutarAutomaticamente`
- Respuesta exitosa: `ApiSuccess<TransaccionRecurrente>` con `message = "Transaccion recurrente creada exitosamente"`.
- Errores frecuentes:
  - `400` validacion
  - `403` no tiene permisos para crear transacciones recurrentes en esta cuenta
  - `404` cuenta no encontrada
- Uso en la app actual: si.

#### `GET /api/sw/recurrentes`

- Uso: listar transacciones recurrentes.
- Acceso: autenticado.
- Query opcional:
  - `cuentaId`
  - `activa`
- Respuesta exitosa: `ApiSuccess<TransaccionRecurrente[]>`.
- Uso en la app actual: si.

#### `GET /api/sw/recurrentes/:id`

- Uso: detalle de una transaccion recurrente.
- Acceso: propietario o participante de la cuenta.
- Respuesta exitosa: `ApiSuccess<TransaccionRecurrente>` poblada con `transaccionesGeneradas.transaccion`.
- Errores frecuentes:
  - `404` transaccion recurrente no encontrada
  - `403` no tiene permisos para ver esta transaccion recurrente
- Uso en la app actual: si.

#### `PUT /api/sw/recurrentes/:id`

- Uso: actualizar o pausar/reanudar una transaccion recurrente.
- Acceso: comportamiento real sujeto a permiso de propietario o a un permiso no persistido en el modelo.
- Content-Type: `application/json`.
- Body posible:
  - `monto`
  - `concepto`
  - `descripcion`
  - `categoria`
  - `frecuencia`
  - `diaEjecucion`
  - `fechaFin`
  - `notificarAntes`
  - `ejecutarAutomaticamente`
  - `activa`
- Respuesta exitosa: `ApiSuccess<TransaccionRecurrente>` con `message = "Transaccion recurrente actualizada exitosamente"`.
- Uso en la app actual: si.

#### `DELETE /api/sw/recurrentes/:id`

- Uso: eliminar transaccion recurrente.
- Acceso: propietario de la cuenta o creador del registro.
- Respuesta exitosa: `ApiSuccess<void>` con `message = "Transaccion recurrente eliminada exitosamente"`.
- Uso en la app actual: si.

#### `POST /api/sw/recurrentes/:id/ejecutar`

- Uso: ejecutar manualmente una recurrencia.
- Acceso: comportamiento real alineado al propietario en el estado actual del modelo.
- Respuesta exitosa: `ApiSuccess<{ transaccion: Transaccion, proximaEjecucion: string/date }>` con `message = "Transaccion ejecutada exitosamente"`.
- Uso en la app actual: si.

### 6.10 Pagos diferidos

#### `POST /api/sw/pagos-diferidos`

- Uso: crear un pago diferido con cuotas.
- Acceso: comportamiento real alineado al propietario en el estado actual del modelo.
- Content-Type: `application/json`.
- Body:
  - `cuentaId`
  - `montoTotal`
  - `numeroPagos`
  - `concepto`
  - `descripcion`
  - `categoria`
  - `fechaInicio`
  - `interes`
- Respuesta exitosa: `ApiSuccess<PagoDiferido>` con `message = "Pago diferido creado exitosamente"`.
- Errores frecuentes:
  - `400` validacion
  - `403` no tiene permisos para crear pagos diferidos en esta cuenta
  - `404` cuenta no encontrada
- Uso en la app actual: si.

#### `GET /api/sw/pagos-diferidos`

- Uso: listar pagos diferidos.
- Acceso: autenticado.
- Query opcional:
  - `cuentaId`
  - `estado`
- Respuesta exitosa: `ApiSuccess<PagoDiferido[]>`.
- Cada item agrega `progreso` calculado.
- Uso en la app actual: si.

#### `GET /api/sw/pagos-diferidos/:id`

- Uso: detalle de pago diferido.
- Acceso: propietario o participante de la cuenta.
- Respuesta exitosa: `ApiSuccess<PagoDiferido>`.
- Incluye `progreso` calculado y `cuotas.transaccion` pobladas.
- Uso en la app actual: si.

#### `POST /api/sw/pagos-diferidos/:id/cuotas/:cuotaNumero/pagar`

- Uso: pagar una cuota puntual.
- Acceso: comportamiento real alineado al propietario en el estado actual del modelo.
- Path:
  - `id`
  - `cuotaNumero`
- Body: ninguno requerido por la UI actual.
- Respuesta exitosa: `ApiSuccess<PagoDiferido>` con `message = "Cuota pagada exitosamente"`.
- Errores frecuentes:
  - `404` pago diferido o cuota no encontrada
  - `400` cuota ya pagada o diferido no activo
  - `403` no tiene permisos para pagar cuotas
- Uso en la app actual: si.

#### `POST /api/sw/pagos-diferidos/:id/cancelar`

- Uso: cancelar un pago diferido.
- Acceso: propietario de la cuenta o creador del registro.
- Respuesta exitosa: `ApiSuccess<PagoDiferido>` con `message = "Pago diferido cancelado exitosamente"`.
- Errores frecuentes:
  - `400` no se puede cancelar un pago diferido completado
  - `403` no tiene permisos
  - `404` pago diferido no encontrado
- Uso en la app actual: si.

### 6.11 Categorias financieras

#### `GET /api/sw/categorias`

- Uso: cargar categorias disponibles para formularios y modal de categorias.
- Acceso: autenticado.
- Respuesta exitosa: `ApiSuccess<{ categorias: string[], categoriasFijas: string[] }>`.
- Uso en la app actual: si.

#### `PUT /api/sw/categorias`

- Uso: reemplazar lista de categorias financieras.
- Acceso: cualquier usuario con `privilege = Administrador`.
- Content-Type: `application/json`.
- Body:
  - `categorias`: arreglo requerido
- Respuesta exitosa: `ApiSuccess<{ categorias: string[], categoriasFijas: string[] }>` con `message = "Categorias actualizadas exitosamente"`.
- Errores frecuentes:
  - `403` solo usuarios con privilegio administrador pueden modificar categorias
  - `400` el campo `categorias` no es un arreglo
- Uso en la app actual: si.

### 6.12 Proveedores externos

#### `GET /api/sw/proveedores-externos/organizacion/:organizacionId`

- Uso: listar proveedores externos activos de una organizacion.
- Acceso: participante de la organizacion.
- Respuesta exitosa: `ApiSuccess<ProveedorExterno[]>`.
- Errores frecuentes:
  - `404` organizacion no encontrada
  - `403` no pertenece a esta organizacion
- Uso en la app actual: si.

#### `POST /api/sw/proveedores-externos`

- Uso: crear proveedor externo.
- Acceso: participante de la organizacion.
- Content-Type: `application/json`.
- Body:
  - `organizacionId`
  - `nombre`
  - `beneficiario`
  - `banco`
  - `cuentaClabe`
- Respuesta exitosa normal: `201 ApiSuccess<ProveedorExterno>` con `message = "Proveedor externo guardado exitosamente"`.
- Respuesta exitosa por duplicado reutilizado: `200 ApiSuccess<ProveedorExterno>` con `reused = true` y `message = "Proveedor externo ya existente"`.
- Errores frecuentes:
  - `400` validacion
  - `403` no pertenece a esta organizacion
- Uso en la app actual: si.

#### `PUT /api/sw/proveedores-externos/:id`

- Uso: actualizar proveedor externo.
- Acceso: participante de la organizacion.
- Content-Type: `application/json`.
- Body:
  - `organizacionId`
  - `nombre`
  - `beneficiario`
  - `banco`
  - `cuentaClabe`
- Respuesta exitosa: `ApiSuccess<ProveedorExterno>` con `message = "Proveedor externo actualizado exitosamente"`.
- Errores frecuentes:
  - `409` ya existe otro proveedor con el mismo beneficiario y cuenta/CLABE en la organizacion
  - `403` no pertenece a esta organizacion
  - `404` proveedor no encontrado
- Uso en la app actual: si.

#### `DELETE /api/sw/proveedores-externos/:id`

- Uso: eliminar logicamente un proveedor externo.
- Acceso: participante de la organizacion segun validacion actual de backend.
- Content-Type: `application/json`.
- Body:
  - `organizacionId` requerido
- Respuesta exitosa: `ApiSuccess<void>` con `message = "Proveedor externo eliminado exitosamente"`.
- Errores frecuentes:
  - `400` falta `organizacionId`
  - `403` no pertenece a esta organizacion
  - `404` proveedor no encontrado
- Uso en la app actual: si.

## 7. Flujos para replicar la app

### 7.1 Crear organizacion

1. Entrar a `/finanzas` con un usuario que vea `Nueva Organizacion`.
2. Abrir modal `Nueva Organizacion`.
3. Capturar `Nombre` y `Descripcion`.
4. Agregar participantes opcionales y definir su rol.
5. Guardar con `POST /api/sw/organizaciones`.
6. Refrescar tabla de organizaciones.

### 7.2 Gestionar participantes de organizacion

1. En la tabla de organizaciones, abrir `Ver participantes`.
2. Cargar usuarios disponibles desde `GET /api/usuarios/all`.
3. Permitir agregar participante con `POST /api/sw/organizaciones/:id/participantes`.
4. Permitir cambiar rol con `PUT /api/sw/organizaciones/:id/participantes/:participanteId/rol`.
5. Permitir eliminar con `DELETE /api/sw/organizaciones/:id/participantes/:participanteId`.

### 7.3 Crear cuenta

1. Abrir `Nueva Cuenta`.
2. Elegir organizacion y datos principales.
3. Capturar opcionalmente datos bancarios y referencia Stripe.
4. Guardar con `POST /api/sw/cuentas`.
5. Recargar `Mis Cuentas`.

### 7.4 Agregar participante a cuenta

1. Entrar al detalle de una cuenta.
2. Abrir `Agregar Participante`.
3. Seleccionar usuario.
4. Marcar permisos.
5. Guardar con `POST /api/sw/cuentas/:id/participantes`.
6. Refrescar lista de participantes.

### 7.5 Crear transaccion directa

1. Desde una card de cuenta propia, abrir `Transaccion`.
2. Elegir `Ingreso`, `Gasto` o `Transferencia`.
3. Completar datos requeridos.
4. Si es `Transferencia`, elegir `Cuenta Destino` y usar `POST /api/sw/transferencias`.
5. Si es `Ingreso` o `Gasto`, usar `POST /api/sw/transacciones`.
6. Si hay imagenes, subirlas despues con `POST /api/sw/transacciones/:id/imagenes`.
7. Recargar cuentas y tabla de transacciones.

### 7.6 Crear solicitud por cuenta

1. Ir al tab `Solicitudes`.
2. Abrir `Nueva Solicitud`.
3. Seleccionar modo `Por cuenta`.
4. Elegir cuenta, tipo, monto y concepto.
5. Si es transferencia, seleccionar `Cuenta Origen (mi cuenta)`.
6. Si aplica proveedor externo, capturar snapshot del proveedor.
7. Guardar con `POST /api/sw/solicitudes`.
8. Si hay imagenes, subirlas con `POST /api/sw/solicitudes/:id/imagenes`.

### 7.7 Procesar solicitud por cuenta

1. En `Solicitudes por Cuenta`, ubicar una solicitud `Pendiente`.
2. Si el usuario actual es el propietario de la cuenta:
   - Aprobar con `POST /api/sw/solicitudes/:id/procesar` y opcion de `comprobanteConfirmacion`.
   - Rechazar con `POST /api/sw/solicitudes/:id/procesar` enviando `accion = rechazar` y `motivoRechazo`.
3. Si el usuario actual es el solicitante y no el propietario:
   - Cancelar con `POST /api/sw/solicitudes/:id/cancelar`.

### 7.8 Crear solicitud organizacional

1. Abrir `Nueva Solicitud`.
2. Elegir modo `Por organizacion`.
3. Elegir organizacion y cuenta.
4. Definir si el movimiento es `Ingreso`, `Gasto` o `Transferencia`.
5. Si aplica proveedor externo, elegir proveedor guardado o capturar uno nuevo.
6. Guardar con `POST /api/sw/solicitudes-organizacion`.
7. Si el backend responde `mode = directa`, tratar el resultado como transaccion aplicada.
8. Si el backend responde `mode = solicitud`, recargar solicitudes organizacionales.
9. Si hay imagenes, subirlas con `POST /api/sw/solicitudes-organizacion/:id/imagenes`.

### 7.9 Procesar solicitud organizacional

1. Un administrador abre la vista `Solicitudes por Organizacion`.
2. Si la solicitud esta `Pendiente`:
   - Aprobar con `POST /api/sw/solicitudes-organizacion/:id/procesar`.
   - Rechazar con `POST /api/sw/solicitudes-organizacion/:id/procesar`.
3. Si la respuesta indica `requiereConfirmacionDueno = true`, el flujo pasa al dueño.

### 7.10 Confirmacion del dueño

1. El propietario de la cuenta abre `Confirmacion Dueño`.
2. Si el movimiento requiere validacion, completa comentario, validacion de compra y comprobante.
3. Confirmar con `POST /api/sw/solicitudes-organizacion/:id/confirmar-dueno`.
4. Si no procede, rechazar con `POST /api/sw/solicitudes-organizacion/:id/rechazar-dueno`.

### 7.11 Crear transaccion recurrente

1. Abrir subtab `Transacciones Recurrentes`.
2. Abrir `Nueva Recurrente`.
3. Capturar datos del movimiento y la recurrencia.
4. Guardar con `POST /api/sw/recurrentes`.
5. Desde la tabla se puede pausar, reanudar, ejecutar manualmente o eliminar.

### 7.12 Crear pago diferido

1. Abrir subtab `Pagos Diferidos`.
2. Abrir `Nuevo Pago Diferido`.
3. Completar monto total, numero de pagos, interes y fecha inicial.
4. Calcular vista previa de cuotas en cliente.
5. Guardar con `POST /api/sw/pagos-diferidos`.
6. Desde el detalle, pagar cuotas con `POST /api/sw/pagos-diferidos/:id/cuotas/:cuotaNumero/pagar`.

### 7.13 Exportar estado de cuenta

1. Ir al tab `Transacciones`.
2. Seleccionar `Desde` y `Hasta`.
3. Elegir opcionalmente una cuenta.
4. Consultar `GET /api/sw/transacciones/estado-cuenta`.
5. Generar `XLSX` o `PDF` localmente con el payload devuelto.

## 8. Resumen operativo rapido

- Para crear dinero directo en cuenta propia se usa `Transaccion`.
- Para pedir aprobacion sobre una cuenta ajena se usa `Solicitud por Cuenta`.
- Para movimientos sujetos a gobierno de organizacion se usa `Solicitud por Organizacion`.
- Si una solicitud organizacional queda en `PendienteConfirmacionDueno`, el ultimo paso siempre lo hace el dueño de la cuenta.
- Las imagenes casi siempre se suben en una segunda llamada despues de crear el registro principal.
- Las categorias se obtienen dinamicamente y no deben hardcodearse en la app.
- Los proveedores externos pertenecen a una organizacion, no a una cuenta.
