# Plan técnico: Chatbot de WhatsApp para automatizar el flujo de Vendedores

*Actualizado 2026-10-08.*

## Contexto

Chatbot de WhatsApp que automatiza lo que hoy hacen los Vendedores humanos: responder disponibilidad y dudas de propiedades, cotizar, crear la reserva y recibir el comprobante de pago (transferencia o depósito OXXO). Después del comprobante, la "torre de control" humana toma la conversación y el bot deja de participar.

Decisiones tomadas:
- **Motor:** LLM con function-calling (Claude **Haiku 5.5** por defecto, configurable a Sonnet 5.5 por variable de entorno si el QA lo pide). Sin menús de botones.
- **Integración 100% independiente de lo existente.** Las confirmaciones, recordatorios, mensajes de check-in y encuestas **siguen por la API oficial de Meta tal cual** (`common/tasks/send-messages.js`). No se migra ni se modifica nada de eso.
- **Números del bot:** 3 números **nuevos** (uno por marca), conectados a **YCloud con coexistence** (app WhatsApp Business + API en el mismo número). Catálogo de habitaciones compartido.
- **Flujo de negocio:** el bot actúa como un Vendedor más, sobre los mismos endpoints internos (`/api/eventos/cotizaciones`, `/api/eventos`, `/api/utilidades/reserva`, `/api/pagos`).
- **Depósito OXXO = Transferencia:** solo comprobante, aprobación humana como hoy.
- **Torre de control:** contesta desde la app WhatsApp Business del número del bot (coexistence). El Shared Team Inbox de YCloud queda como opcional.

## Regla de oro: no tocar lo existente

Archivos existentes que se modifican: **ninguno**, salvo una línea en `routes/indexRoutes.js` para montar el webhook nuevo (etapa C). Todo lo demás es código nuevo en `services/bot/`, `routes/botRoutes.js`, `models/BotConversation.js` y `scripts/botSimulator.js`.

## Cómo encaja con lo que ya existe (verificado en código)

El bot llama a los endpoints por HTTP con un JWT firmado para un **usuario técnico por marca** (privilegio Vendedor, rol con `CREATE_RESERVATIONS` y `ADD_PAYMENTS`). `authMiddleware` ya acepta `Authorization: Bearer`.

| Paso | Endpoint | Notas |
|---|---|---|
| Disponibilidad + precio | `POST /api/eventos/cotizaciones` (`soloDisponibles: true`) | Mismo cotizador que el flujo de inversionista; ya suma comisiones de la jerarquía del usuario técnico. Devuelve también características, descripción e imágenes. |
| Crear reserva | `POST /api/eventos` con `isDeposit: true` | Reserva tentativa con fecha límite de pago. **El sistema actual envía por Meta** la plantilla `tentativa_reserva_mx` al cliente (banco, CLABE, beneficiario, monto 50%, hora límite) y una copia al teléfono del usuario técnico. Si no se paga, el cron existente la cancela. |
| Comisiones | `POST /api/utilidades/reserva` | Igual que hace el panel después de crear la reserva. |
| Comprobante | `POST /api/pagos` multipart (`metodoPago: "Transferencia"`) | Crea pago pendiente + `SWSolicitudTransaccion` para aprobación humana. |

Consecuencias de diseño:
- **El cliente recibe las instrucciones de pago desde el número oficial de Meta**, no desde el del bot. El bot se lo avisa.
- **Teléfono del usuario técnico = número del bot de esa marca** → la plantilla `{{9}}` le indica al cliente a qué número mandar el comprobante (pendiente confirmar el texto de la plantilla). La copia al "agente" llega al número del bot: el webhook **ignora mensajes que vengan del número oficial de Meta**, y la torre de control la ve en la app como aviso de "reserva nueva por bot".
- **El precio nunca lo decide el LLM.** El bot guarda la cotización en el servidor; `crear_reserva` solo recibe el id de habitación y toma total, costo y comisiones de esa cotización guardada (evita que un cliente manipule el precio por chat). Al LLM nunca se le pasan costo base ni margen.
- **Teléfono del cliente = el número de WhatsApp que escribe** (no se le pide).

## Arquitectura

```
WhatsApp (número bot, coexistence) ─► YCloud ─► POST /api/bot/ycloud/webhook (nuevo)
                                                    │  dedup por id, ignora número oficial Meta,
                                                    │  ignora conversaciones escaladas
                                                    ▼
                                            services/bot/engine.js  (loop tool-calling, Haiku 5.5)
                                                    │
                                    services/bot/tools.js ──► services/bot/api.js ──► endpoints actuales (HTTP + JWT técnico)
                                                    │
                                            respuesta ─► YCloud sendDirectly ─► cliente
```

Herramientas del LLM:
1. `buscar_disponibilidad(fecha_llegada, fecha_salida, huespedes)` → cotizador.
2. `detalle_propiedad(habitacion_id)` → descripción, amenidades y fotos (de la última cotización).
3. `crear_reserva(habitacion_id, nombre, apellido)` → solo tras confirmación explícita del cliente; una por conversación.
4. `registrar_pago(importe, codigo_operacion?)` → usa el comprobante recibido; escala la conversación.
5. `escalar_a_humano(motivo)` → cualquier caso fuera del flujo (quejas, cambios, cancelaciones, dudas que no puede resolver).

## Etapas

| Etapa | Contenido | Depende del cliente | Estimado |
|---|---|---|---|
| **A. Base** | SDK de Anthropic, config de marcas por `.env`, cliente HTTP con JWT técnico | No | 1–1.5 días |
| **B. Motor + simulador** | Loop tool-calling, prompt, las 5 tools, `scripts/botSimulator.js` para chatear desde terminal contra la base de desarrollo | Solo API key de Anthropic | 10–14 días |
| **C. Canal YCloud** | `models/BotConversation.js`, webhook nuevo (dedup, filtro número oficial, respuesta rápida y proceso async), envío de texto y fotos por `sendDirectly`, descarga de comprobante con `X-API-Key` | Sí: cuenta YCloud + números | 2–4.5 días |
| **D. Escalación** | Flag `escalated`; si YCloud reenvía los mensajes escritos desde la app (echoes de coexistence), auto-escalar cuando un humano contesta | Sí: confirmar echoes en YCloud | 0.5–1 día |
| **E. QA y piloto** | Casos de prueba con conversaciones reales, ajuste de prompt, 1 marca y luego las 3 | Sí: marca piloto + validador | 3–5 días |
| **Total** | | | **~16.5–26 días (~132–208 h)** |

## Qué se necesita de los clientes

1. **3 números nuevos** activos en WhatsApp Business App y conectados a YCloud con coexistence; API key de YCloud.
2. **Confirmar con YCloud** que reenvía por webhook los mensajes enviados desde la app (echoes), para auto-detectar cuando un humano toma la conversación.
3. **3 usuarios técnicos** (uno por marca) dados de alta en el panel: privilegio Vendedor, rol con `CREATE_RESERVATIONS` y `ADD_PAYMENTS`, teléfono = número del bot de esa marca, y **quién es su administrador** (define a quién se le pagan las comisiones de las ventas del bot).
4. **Texto de la plantilla `tentativa_reserva_mx`**: confirmar que `{{9}}` es "envía tu comprobante a este número".
5. Que todas las propiedades tengan **cuenta financiera** configurada (sin ella no se mandan instrucciones de pago ni se puede registrar el comprobante).
6. **Cuenta de Anthropic** con facturación a su nombre (~$3–8 USD/mes con Haiku a 2,000 conversaciones).
7. Contenido: políticas (cancelación, check-in/out, mascotas, depósito), nombre y tono del bot por marca, horario de la torre de control y qué responde el bot fuera de horario.
8. 20–50 conversaciones reales de Vendedores (anonimizadas) para los casos de prueba; marca piloto y quién valida.
9. Revisar aviso de privacidad (los mensajes pasan por YCloud y Anthropic).

## Fuera de alcance

- Cualquier cambio a los mensajes actuales por Meta (confirmaciones, recordatorios, check-in, encuestas).
- Refactor de controllers; búsqueda semántica; cupones o modo inversionista por bot.
- OCR/validación automática del comprobante (sigue la aprobación humana).
- Dashboard propio para la torre de control; reactivación automática del bot tras escalar.
- Multiidioma, pruebas de carga, suite extensa de tests.
- Costo recurrente de tokens y de YCloud (operativo).

## Verificación por etapa

- **B:** en el simulador: "¿tienen algo para 4 personas del 20 al 22 de noviembre?" → la respuesta coincide con el cotizador del panel; crear una reserva de prueba y verla en el panel con su comisión; adjuntar un comprobante y ver la solicitud pendiente.
- **C:** mensaje real al número de pruebas → el webhook lo recibe una sola vez y contesta; un mensaje del número oficial de Meta se ignora.
- **D:** tras el comprobante el bot deja de contestar; si un humano escribe desde la app, el bot también se calla.
