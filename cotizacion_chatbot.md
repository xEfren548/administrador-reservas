# Cotización: Chatbot de WhatsApp para automatizar el flujo de Vendedores

## 1. Resumen del proyecto

**¿Qué hay que construir?**
Un chatbot de WhatsApp (motor LLM con function-calling, sin menús de botones) que automatice el flujo que hoy hacen los Vendedores humanos: responder disponibilidad, resolver dudas sobre las propiedades, cotizar, crear la reserva, enviar la confirmación y recibir el comprobante de pago (transferencia o depósito OXXO). El bot opera sobre **3 números de WhatsApp** (una marca cada uno), compartiendo el mismo catálogo de habitaciones y la misma lógica del flujo interno de Vendedor. Una vez recibido el comprobante, el bot escala la conversación a un equipo humano ("torre de control") y deja de participar.

**Alcance incluido**
- Migración del envío/recepción de WhatsApp de Meta Cloud API directa a **YCloud** (proveedor BSP), para las 3 marcas bajo una sola cuenta.
- Motor conversacional LLM con function-calling contra los endpoints internos ya existentes (disponibilidad, cotización, crear reserva, registrar pago).
- Consulta de disponibilidad y FAQ de propiedades (amenidades, fotos) vía WhatsApp.
- Flujo completo de creación de reserva conversacional, con confirmación explícita antes de reservar.
- Recepción y registro de comprobante de pago (transferencia u OXXO, mismo tratamiento) para aprobación humana posterior.
- Escalación automática a la torre de control vía el Shared Team Inbox de YCloud (sin construir dashboard propio).
- QA manual y ajuste iterativo de prompts, validado primero con 1 marca antes de encender las 3.

**Fuera de alcance** (ver detalle en sección de supuestos): refactor de controllers, búsqueda semántica, cupones/modo inversionista, OCR de comprobantes, dashboard propio para la torre de control, reactivación automática del bot tras escalar, soporte multiidioma, pruebas de carga y suite de tests extensa.

---

## 2. Desglose de servicios y precios

> Cotización expresada en **esfuerzo (días de desarrollo, 1 dev senior familiarizado con el repo)**, no en tarifa monetaria — según lo acordado. Si necesitas también una cifra en dinero, dime tu tarifa/día o el total que manejas y la calculo sobre esta misma tabla.

**Descripción general:** el proyecto se divide en 8 servicios/fases secuenciales, desde la migración del proveedor de WhatsApp hasta la validación final con las 3 marcas en producción.

| # | Servicio | Descripción detallada | Esfuerzo |
|---|---|---|---|
| 1 | Seguridad e infraestructura base | Variables de entorno (`YCLOUD_API_KEY`, `YCLOUD_WEBHOOK_SECRET`), usuario técnico con rol y permisos de Vendedor, scaffolding de módulos del bot, modelo de conversación, mapeo de las 3 marcas a sus números YCloud | 8–12 horas |
| 2 | Webhook y mensajería de texto (YCloud) | Migración del envío de mensajes (confirmaciones y plantillas) de Meta a YCloud, nuevo envío de texto libre, webhook entrante nuevo con deduplicación y resolución de marca por payload | 12–20 horas |
| 3 | Motor LLM con function-calling | Integración del SDK del LLM, definición de tools, prompt de sistema, orquestador multi-turno con manejo de historial y errores | 32–48 horas |
| 4 | Disponibilidad y FAQ de propiedades | Tool de disponibilidad, tool de detalle/amenidades sobre el catálogo compartido, envío de fotos por WhatsApp | 16–24 horas |
| 5 | Creación de reserva | Recolección conversacional de datos, cotización y creación de reserva contra los endpoints internos, con confirmación explícita del cliente antes de reservar | 24–32 horas |
| 6 | Recepción de pago (transferencia/OXXO) | Descarga del comprobante enviado por WhatsApp y registro contra el flujo de pagos existente, para aprobación humana | 16–32 horas |
| 7 | Escalación a torre de control | Marca de conversación como escalada tras recibir comprobante, integración con el Shared Team Inbox de YCloud | 8–16 horas |
| 8 | QA y ajuste de prompts | Casos de prueba manuales, ajuste iterativo del comportamiento del bot, validación con 1 marca antes de encender las 3 | 24–40 horas |
| | **Total** | | **~144–224 horas** |

*(Conversión a jornadas de 8 horas.)*

No incluye tiempos de espera/coordinación con Meta o YCloud (aprobación de plantillas, alta de cuenta/WABAs, contratación del tier de Team Inbox) ni el costo recurrente de tokens del LLM — ambos son operativos, no de desarrollo.

---

## 3. Infraestructura y servicios habilitados para la operación inicial

- **YCloud (BSP de WhatsApp):** cuenta única con las 3 WABA (una por marca) y una sola API key. Incluye el producto **Shared Team Inbox** para el handoff bot → humano — se usa en vez de construir un dashboard propio. *Pendiente confirmar con YCloud el tier/plan que incluye Team Inbox y cuántos agentes necesita la torre de control (costo recurrente).*
- **Backend actual (monolito Express):** el bot vive dentro del mismo backend, reutilizando los endpoints de negocio existentes (`/api/eventos`, `/api/pagos`) vía llamadas internas autenticadas con un usuario técnico — no se despliega infraestructura nueva.
- **Proveedor del LLM:** por definir (no hay SDK de LLM instalado hoy en el proyecto); el gasto de tokens es operativo y corre por separado del desarrollo.
- **Plantillas de WhatsApp:** las plantillas ya aprobadas en Meta (ej. confirmación de reserva) deben confirmarse con YCloud — si se migran automáticamente o requieren nueva aprobación.

---

## 4. Condiciones de pago

*(Propuesta estándar, a ajustar una vez definida la tarifa por día — no hay montos definidos aún porque la cotización se entregó en esfuerzo, no en dinero.)*

- **Anticipo:** al arranque del proyecto, previo a Fase 1.
- **Pago intermedio:** al completar Fase 5 (creación de reserva funcional end-to-end).
- **Pago final:** a la entrega y validación de Fase 8 (QA con las 3 marcas en producción).
- Los pendientes de terceros (aprobación de plantillas Meta, alta de WABAs, contratación de tier de YCloud) corren por cuenta del cliente y no forman parte del cronograma de desarrollo ni de estos pagos.

---

## 7. Supuestos del proyecto

- Catálogo de habitaciones compartido entre las 3 marcas (mismo `Habitacion` para todas).
- Depósito OXXO recibe el mismo tratamiento que transferencia: solo comprobante, sin integración de cobro con tarjeta (Stripe).
- Las 3 WABA (una por marca) viven en la misma cuenta de YCloud, con una sola API key.
- La torre de control usará el Shared Team Inbox de YCloud en vez de un dashboard propio construido a medida.
- El código de negocio actual (disponibilidad, cotización, reservas, pagos) no se refactoriza; el bot lo invoca vía llamadas internas con un usuario técnico.
- Fuera de alcance: búsqueda semántica sobre propiedades, cupones/promociones complejas o modo inversionista vía bot, OCR/validación automática de comprobantes, reactivación automática del bot tras escalar a un humano, soporte multiidioma, pruebas de carga y suite de tests automatizados extensa.
- El costo recurrente de tokens del LLM es un gasto operativo del cliente, no está incluido en el esfuerzo de desarrollo cotizado.
