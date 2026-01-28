# 🎫 Módulo de Cupones y Referidos - Guía Rápida

## ✅ Parte 2 Completada

La **Parte 2** del módulo de cupones y referidos ha sido completada exitosamente.

### 🎉 Lo que ya está listo

1. **Vista unificada** en [views/vistaCupones.handlebars](views/vistaCupones.handlebars)
   - 4 tabs: Dashboard, Cupones, Referidos, Configuración
   - Modales para CRUD de cupones
   - Gráficas Chart.js
   - Tablas con paginación
   - Filtros y búsqueda en tiempo real
   - Exportación CSV

2. **JavaScript frontend** en [src/public/scripts/cupones.js](src/public/scripts/cupones.js)
   - Navegación entre tabs
   - Fetch API para todos los endpoints
   - Renderizado de gráficas
   - Gestión de modales
   - Sistema de notificaciones

3. **Menú lateral** actualizado
   - Nueva opción "Cupones y Referidos" en el menú del Administrador
   - Ruta: `/cupones/dashboard`

### 🚀 Cómo acceder

1. Inicia el servidor:
   ```bash
   npm start
   ```

2. Inicia sesión como **Administrador**

3. En el menú lateral, haz clic en **"Cupones y Referidos"**

4. Explora las funcionalidades:
   - **Dashboard**: Visualiza estadísticas, gráficas y cupones populares
   - **Cupones**: Crea, edita, activa/desactiva y elimina cupones
   - **Referidos**: Visualiza referidos, top referidores y estadísticas
   - **Configuración**: Configura el sistema de referidos

### 📋 Siguientes pasos (Manual)

#### Parte 3: Integración en Formulario de Reserva
Debes agregar un campo de cupón en el formulario donde se crean/editan reservas y validarlo con el endpoint:
```javascript
POST /api/cupones/validar
```

Ver detalles en [CUPONES_IMPLEMENTACION.md](CUPONES_IMPLEMENTACION.md) líneas 152-249.

#### Parte 4: Integración en createReservation
Debes modificar la función `createReservation` en `controllers/eventController.js` para:
1. Aplicar el descuento al `precioTotal`
2. Guardar el `descuentoCupon` en el campo `descuento`
3. Crear registro en `CuponUsage`
4. Incrementar `usosActuales` del cupón

Ver detalles en [CUPONES_IMPLEMENTACION.md](CUPONES_IMPLEMENTACION.md) líneas 251-360.

### 📚 Documentación completa

Consulta [CUPONES_IMPLEMENTACION.md](CUPONES_IMPLEMENTACION.md) para:
- Detalles de todos los endpoints API
- Estructura de modelos
- Validaciones
- Permisos
- Instrucciones detalladas para Partes 3 y 4

### 🎨 Características destacadas

- ✅ Vista unificada con tabs (patrón igual a vistaFinanzas)
- ✅ CRUD completo de cupones
- ✅ Sistema de referidos integrado
- ✅ Gráficas interactivas con Chart.js 4.4.0
- ✅ Exportación a CSV con UTF-8 BOM
- ✅ Filtros y búsqueda en tiempo real
- ✅ Paginación de resultados
- ✅ Sistema de notificaciones toast
- ✅ Spinner de carga global
- ✅ Modales responsive
- ✅ Diseño con Bootstrap 5 y Tailwind CSS

### 🐛 Problemas comunes

1. **No veo la opción en el menú**: Asegúrate de estar logueado como Administrador
2. **Error 403**: Verifica que tu rol tenga los permisos necesarios en la BD
3. **Gráficas no se muestran**: Verifica la consola del navegador, puede ser un problema de datos
4. **Exportación CSV vacía**: Verifica que haya datos en la BD

### 📞 Contacto

Para cualquier duda o problema, consulta la documentación completa en [CUPONES_IMPLEMENTACION.md](CUPONES_IMPLEMENTACION.md).

---

✨ **Módulo desarrollado con éxito** ✨
