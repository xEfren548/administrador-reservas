# Cotización: Chatbot de WhatsApp para automatizar el flujo de Vendedores

## Contexto

El usuario quiere cotizar (alcance + esfuerzo en días, no precio en dinero) un chatbot de WhatsApp que automatice el flujo que hoy hacen los Vendedores humanos: responder disponibilidad, resolver dudas sobre las propiedades, crear la reserva, enviar la confirmación (ya implementada) y recibir el comprobante de pago (transferencia o depósito OXXO). A partir de ahí, un equipo humano ("torre de control") toma el seguimiento de check-in — el bot no participa después de ese punto.

Decisiones ya tomadas por el usuario:
- **Motor conversacional:** LLM con function-calling (no menús de botones) — el LLM decide qué endpoint del backend invocar según lo que escribe el cliente.
- **Entregable de la cotización:** alcance + esfuerzo en días por fase, sin tarifa monetaria.
- **Multi-marca:** habrá 3 números de WhatsApp (uno por marca), con el **mismo catálogo de habitaciones** para las 3, usando la misma lógica de bot construida sobre el **flujo interno de Vendedor** (APIs de `/api/eventos`, `/api/pagos`), no sobre el cotizador público web de clientes (rentravel).
- **Proveedor de WhatsApp: YCloud** (BSP sobre WhatsApp Cloud API), no integración directa con Meta. Las 3 WABA estarán en la **misma cuenta de YCloud**.
- **Depósito OXXO = Transferencia:** en ambos casos el cliente solo sube un comprobante; no se integra Stripe/cobro con tarjeta.
- **Torre de control:** no existe dashboard propio hoy; se usará el **Shared Team Inbox de YCloud** (confirmado que soporta handoff bot→humano) en vez de construir uno.

## Hallazgos clave verificados

### Código existente a reutilizar
- **Flujo de Vendedor (backend de negocio, sin cambios):** disponibilidad, cotización, crear reserva y registrar pago — ver endpoints abajo. Esta capa NO cambia por el cambio de proveedor de WhatsApp.
- **Auth lista para un bot:** [common/middlewares/authMiddleware.js](common/middlewares/authMiddleware.js) ya acepta `Authorization: Bearer <JWT>` y reconstruye `req.session` (líneas 69-109), obtenido vía `POST /api/auth/login-token` ([controllers/authController.js:114](controllers/authController.js#L114)). Permite crear un "usuario técnico" con permisos de Vendedor.
- **WhatsApp saliente actual (a migrar):** hoy funciona vía Meta Cloud API directa (`fetch` nativo, sin SDK) en [common/tasks/send-messages.js](common/tasks/send-messages.js) — `sendTemplateMsg` (línea 70) y `sendReservationConfirmation` (línea 162), ya usada por `createReservation`. **Esta función debe reescribirse para usar la API de YCloud en vez de Meta** — no es solo "extender", es migrar el proveedor de la funcionalidad que el usuario describe como "ya implementada".
- **WhatsApp entrante actual:** el webhook existe pero solo hace `console.log` — [routes/webHook.js](routes/webHook.js) líneas 7-19 (`POST /webhook`) y 21-34 (verificación `GET /webhook`). Se reemplaza por el webhook de YCloud (formato de payload distinto y más simple).
- **Secretos hardcodeados (arreglar como prerrequisito, aplica igual con YCloud):** bearer token de Meta en `send-messages.js:74` y `VERIFY_TOKEN` en `webHook.js:5` no están en `.env` — usar como referencia el buen patrón ya usado en [services/fcmService.js](services/fcmService.js) (líneas 60-82) para la nueva `YCLOUD_API_KEY`.

### API de YCloud (verificado en docs.ycloud.com)
- **Envío:** `POST https://api.ycloud.com/v2/whatsapp/messages/sendDirectly`, header `X-API-Key` (una sola key para las 3 WABA de la cuenta). Body simple `{from, to, type: "text"|"template", text/template}` — enviar texto libre es tan simple como enviar plantilla, sin manejo especial de `phone_number_id` por marca.
- **Webhook entrante:** payload ya incluye `to` (número de negocio que recibió el mensaje) y `wabaId` — permite resolver la marca directo del payload, sin tabla de mapeo compleja por app de Meta.
- **Multimedia entrante:** el payload trae URL directa de descarga (`image.link`/`document.link`), solo requiere header `X-API-Key` para descargar (disponible 30 días) — más simple que el flujo de Meta (buscar `media_id` → pedir URL → descargar con token).
- **Shared Team Inbox:** producto de YCloud con "Seamless Agent-Human Handoff", "Open API and Webhook support" y "Multiple agents on one WhatsApp number con auto-assignment". Es la pieza que resuelve "torre de control" sin construir un dashboard propio — pendiente confirmar el tier/costo que lo incluye (no es esfuerzo de desarrollo, es contratación de producto).
- **Disponibilidad:** `GET /api/eventos/disponibilidad` → `eventController.obtenerHabitacionesDisponibles` ([controllers/eventController.js:3772](controllers/eventController.js#L3772)).
- **Cotización interna (Vendedor):** `POST /api/eventos/cotizaciones` → `eventController.cotizadorChaletsyPrecios` (línea 3323) — distinta de la del cotizador público web.
- **Crear reserva:** `POST /api/eventos` → `eventController.createReservation` ([controllers/eventController.js:1286](controllers/eventController.js#L1286)); ya dispara confirmación por WhatsApp, tarea de limpieza y actualización de Channex.
- **Registrar pago:** `POST /api/pagos` (multipart, campo `comprobante`) → `pagoController.registrarPago` ([controllers/pagoController.js:58](controllers/pagoController.js#L58)); sube el comprobante por FTP y crea `SWSolicitudTransaccion` pendiente de aprobación humana.
- **Modelo de habitaciones:** [models/Habitacion.js](models/Habitacion.js) — cada documento es una unidad reservable con amenidades anidadas (`accommodationFeatures`), descripción, precio base e imágenes (URLs públicas vía `https://navarro.integradev.site/navarro/` + `images[]`). No hay búsqueda de texto libre; el LLM tendrá que mapear preguntas a estos campos.

## Decisión de arquitectura

El bot vive **dentro del mismo monolito Express** (nuevo módulo `routes/bot/` + `services/bot/`), pero invoca la lógica de negocio existente **vía llamadas HTTP internas (loopback)** con el JWT del usuario técnico — igual que si fuera un Vendedor externo. Razón: los controllers relevantes (`createReservation`, `registrarPago`, etc.) escriben directo a `res`, no son funciones de servicio reutilizables; refactorizarlos es alto riesgo de regresión en el panel de Vendedores en producción y no está en el alcance pedido.

Para WhatsApp, se agrega un cliente ligero `services/bot/ycloudClient.js` (fetch nativo, mismo patrón que el código actual) que envuelve `sendDirectly` de YCloud — no hace falta SDK de terceros para esto, es una sola API key y payloads simples.

## Fases y esfuerzo estimado (1 dev senior familiarizado con el repo)

| Fase | Contenido | Estimado |
|---|---|---|
| 1. Seguridad/infra | `YCLOUD_API_KEY` + `YCLOUD_WEBHOOK_SECRET` en `.env`, crear usuario técnico + rol con permisos `CREATE_RESERVATIONS`+`ADD_PAYMENTS`, scaffolding `routes/bot/`/`services/bot/`, modelo `BotConversation`, config de las 3 marcas → número YCloud (mapeo simple `to`→marca, una sola cuenta) | 1–1.5 días |
| 2. Webhook + texto libre (YCloud) | Migrar `sendReservationConfirmation`/`sendTemplateMsg` para llamar a YCloud en vez de Meta directo, nueva `sendTextMsg` (`type: "text"`), endpoint webhook nuevo parseando el payload de YCloud (`to`/`wabaId` ya resuelven marca), deduplicar por id de mensaje, responder rápido y procesar async | 1.5–2.5 días |
| 3. Motor LLM function-calling | Elegir/agregar SDK (no hay `@anthropic-ai/sdk` ni `openai` en `package.json` hoy), definir tools, prompt de sistema, orquestador tool-calling multi-turno, manejo de historial y errores | 4–6 días |
| 4. Disponibilidad + FAQ propiedades | Tool de disponibilidad sobre `obtenerHabitacionesDisponibles`, tool de detalle/amenidades sobre `Habitacion` (catálogo único para las 3 marcas), envío de fotos por WhatsApp | 2–3 días |
| 5. Creación de reserva | Recolección conversacional de datos, `cotizar_reserva` + `crear_reserva` contra los endpoints internos, confirmación explícita antes de crear | 3–4 días |
| 6. Pago transferencia/OXXO | Descarga de comprobante vía URL directa de YCloud (+ `X-API-Key`), reenvío multipart a `registrarPago` con `metodoPago: "Transferencia"` para ambos casos (transferencia y depósito OXXO) | 2–4 días |
| 7. Escalación a torre de control | Flag `escalated` en `BotConversation` tras recibir comprobante (el bot deja de auto-responder), configurar el número/conversación para que aparezca en el **Shared Team Inbox de YCloud** — no se construye dashboard propio | 1–2 días |
| 8. QA / ajuste de prompts | Casos de prueba manuales, ajuste iterativo de prompt/tools, aislamiento de conversaciones concurrentes, validación con 1 marca antes de encender las 3 | 3–5 días |
| **Total** | | **~18–28 días** |

No incluye tiempo de espera/coordinación con Meta ni con YCloud (aprobación de plantillas, alta de cuenta/WABAs, contratación del tier de Team Inbox) — eso no depende del desarrollo.

## Qué NO incluye este alcance

- Refactor de controllers a capa de servicio desacoplada de Express.
- Búsqueda semántica/vectorial sobre descripciones de propiedades (se resuelve con filtros estructurados que el LLM elige).
- Cupones/promociones complejas o modo inversionista en la reserva por bot.
- OCR/validación automática del comprobante de pago (sigue siendo aprobación humana, como hoy).
- Dashboard/inbox nuevo para que la torre de control vea y responda conversaciones — se asume que siguen usando WhatsApp Business App directamente tras la notificación push.
- Reactivación automática del bot tras escalar (flujo unidireccional bot → humano).
- Soporte multiidioma, pruebas de carga, suite de tests automatizados extensa.
- Costo recurrente de tokens del LLM (gasto operativo, no de desarrollo).

## Supuestos ya confirmados por el usuario

- Catálogo de habitaciones compartido entre las 3 marcas.
- Depósito OXXO = mismo tratamiento que Transferencia (solo comprobante, sin Stripe/tarjeta).
- Las 3 WABA viven en la misma cuenta de YCloud (una sola API key).
- Torre de control usará el Shared Team Inbox de YCloud en vez de un dashboard propio.

## Pendientes a confirmar antes de arrancar (no bloquean la cotización, sí el arranque)

1. Qué tier/plan de YCloud incluye el Shared Team Inbox y cuántos agentes necesita la torre de control (costo recurrente, no esfuerzo de desarrollo).
2. Si el handoff de YCloud requiere alguna llamada a su API para "marcar" la conversación como escalada, o si basta con que el bot deje de responder y el agente humano la vea en el inbox (afina el tamaño real de la Fase 7, hoy estimada por el escenario más simple).
3. Plantillas de WhatsApp ya aprobadas en Meta (`confirmacion_de_reserva`, etc.) — confirmar si YCloud las migra/re-registra o si hay que volver a someterlas a aprobación.

## Verificación (una vez implementado, por fase)

- **Fase 1-2:** enviar un mensaje real al número de pruebas de YCloud y confirmar que el webhook lo recibe, lo deduplica y responde con texto libre; verificar que `sendReservationConfirmation` migrado sigue entregando el mensaje de confirmación como hoy.
- **Fase 3-4:** conversación de prueba preguntando disponibilidad y amenidades ("¿tienen jacuzzi el 20 de agosto?") y confirmar que el LLM invoca la tool real (no inventa datos) comparando contra el panel de Vendedores.
- **Fase 5:** completar una reserva de prueba por chat y verificar que aparece en el panel igual que una creada por un Vendedor, con confirmación de WhatsApp recibida.
- **Fase 6:** enviar una foto de comprobante por WhatsApp y verificar que se crea el `Pago`/`SWSolicitudTransaccion` pendiente, visible en el panel.
- **Fase 7:** confirmar que tras el comprobante el bot deja de responder y la conversación aparece correctamente en el Shared Team Inbox de YCloud para que la torre de control la tome.
