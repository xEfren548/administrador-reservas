# Chatbot de WhatsApp: pruebas y despliegue

Arquitectura y decisiones del bot: [plan_chatbot.md](plan_chatbot.md). Este archivo cubre solo cómo correrlo.

## Estado actual

| Etapa | Qué es | Estado |
|---|---|---|
| A + B | Motor (`services/bot/engine.js`), herramientas (`services/bot/tools.js`), simulador de terminal | **Listo** |
| C | Webhook `POST /api/bot/ycloud/webhook` (`routes/botRoutes.js`, `services/bot/ycloud.js`), `models/BotConversation.js`, envío por `sendDirectly`, descarga de comprobantes | **Listo, falta probar con número real** |
| D | Escalación cuando un humano contesta desde la app (evento `whatsapp.smb.message.echoes`) | **Listo, falta probar con número real** |

---

## 1. Requisitos comunes

### Variables de `.env`

| Variable | Obligatoria | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sí | API key de Anthropic (console.anthropic.com). |
| `BOT_BRANDS` | Sí | JSON con una entrada por marca (ver abajo). |
| `JWT_SECRET` | Sí | El mismo que usa el servidor; el bot firma con él el JWT del usuario técnico. |
| `URL` o `BOT_API_URL` | Sí | Base del API al que llama el bot. `BOT_API_URL` tiene prioridad. En local: `http://localhost:<puerto>`. |
| `BOT_MODEL` | No | Por defecto `claude-haiku-5-5`. Para QA se puede usar `claude-sonnet-5-5`. |
| `YCLOUD_API_KEY` | Para WhatsApp | API key de YCloud (Developers → API Keys). Sirve para enviar mensajes y descargar comprobantes. |
| `YCLOUD_WEBHOOK_SECRET` | Para WhatsApp | Secreto de firma del endpoint de webhook en YCloud. Sin él, el webhook rechaza todo con 401. |
| `BOT_DEBOUNCE_MS` | No | Cuánto espera el bot (ms) por más mensajes antes de contestar. Por defecto `5000`. Con `0` contesta cada mensaje por separado. |
| `BOT_IGNORE_PHONES` | Para WhatsApp | Números separados por coma a los que el bot nunca contesta. Pon aquí **el número oficial de Meta**: su copia de la plantilla `tentativa_reserva_mx` llega al número del bot. |

```env
BOT_BRANDS=[{"key":"rentravel","name":"Rentravel","phone":"5233XXXXXXXX","userId":"<_id del usuario técnico>"}]
```

- `key`: el nombre corto con el que se elige la marca en el simulador.
- `name`: el nombre que el bot usa al presentarse.
- `phone`: el número del bot de esa marca, con lada de país y sin `+`.
- `userId`: el `_id` (Mongo) del usuario técnico de la marca.

### Usuario técnico por marca (en el panel)

- Privilegio **Vendedor**, con un rol que tenga `CREATE_RESERVATIONS` y `ADD_PAYMENTS`.
- **Teléfono = número del bot de esa marca.** La plantilla `tentativa_reserva_mx` manda una copia al agente, y ese número es el que el cliente usa para enviar el comprobante.
- Su **administrador** decide a quién se le pagan las comisiones de las ventas del bot.

### Datos del negocio

- Todas las propiedades necesitan una **cuenta financiera** configurada. Sin ella no se mandan las instrucciones de pago y no se puede registrar el comprobante.

---

## 2. Pruebas en terminal (sin WhatsApp)

> ⚠️ El bot crea **reservas y pagos reales** en la base a la que apunte el servidor. Usa siempre la base de desarrollo.
>
> Al crear una reserva, el sistema manda la plantilla de Meta `tentativa_reserva_mx` al teléfono del cliente simulado. Usa tu propio número como `telefonoCliente`, o uno que no exista.

### Prueba automática (sin API, sin base, sin Anthropic, sin YCloud)

```bash
npm run bot:check
```

Corre dos pruebas con todo simulado:
- `bot.check.js`: las herramientas y el loop del motor.
- `ycloud.check.js`: firma del webhook, ruteo de eventos, comprobantes, echoes y cola por conversación.

Debe imprimir `bot.check OK` y `ycloud.check OK`.

### Conversación manual

1. Levanta el servidor:
   ```bash
   npm run dev
   ```
2. En otra terminal, abre el simulador:
   ```bash
   npm run bot:simular -- <marca> [telefonoCliente]
   # ej.
   npm run bot:simular -- rentravel 523312345678
   ```
   `<marca>` es la `key` de `BOT_BRANDS`. Si no das teléfono, se usa `523300000000`.
3. Comandos dentro del chat:

| Comando | Qué hace |
|---|---|
| `/comprobante <ruta>` | Adjunta un comprobante (`.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`). |
| `/estado` | Muestra la cotización guardada, la reserva y si la conversación está escalada. |
| `/salir` | Termina. |

### Guion de verificación (etapa B)

1. Escribe: *"¿tienen algo para 4 personas del 20 al 22 de noviembre?"*. Compara las opciones y los precios con el cotizador del panel; deben coincidir.
2. Elige una opción, da nombre y apellido, y confirma. En el panel debe aparecer la reserva tentativa con su comisión.
3. Escribe `/comprobante C:\ruta\comprobante.jpg`. Debe aparecer un pago pendiente y la solicitud de aprobación.
4. Después del comprobante el bot se despide y deja de contestar. Ahí debe aparecer `(conversación escalada...)`.
5. Prueba también los casos fuera de flujo (quejas, cancelaciones, fechas ambiguas). El bot debe preguntar o escalar, nunca inventar.

---

## 3. Pruebas con un número de WhatsApp en YCloud

### Cómo funciona

```
cliente ─► número del bot (YCloud) ─► POST /api/bot/ycloud/webhook
                                        1. valida la firma (YCloud-Signature)        → 401 si no cuadra
                                        2. dedup por id de evento (colección webhookevents, provider "ycloud")
                                        3. responde 200 de inmediato
                                        4. en segundo plano: engine → respuestas por sendDirectly
```

- **Una conversación por marca + cliente**, en la colección `botconversations`. Los mensajes del mismo cliente se procesan uno a la vez, en orden.
- **Mensajes seguidos se agrupan**: si el cliente manda "hola" / "quiero" / "reservar", el bot espera a que deje de escribir (`BOT_DEBOUNCE_MS`, 5 s por defecto; máximo 20 s desde el primero) y contesta una sola vez a "hola quiero reservar". Lo que llegue mientras el bot está contestando forma el siguiente grupo.
- **Imagen o PDF** del cliente: se descarga de YCloud y queda como comprobante para `registrar_pago`. Audios, stickers y ubicaciones no se procesan; el bot pide que lo escriba.
- **Escalada** (comprobante recibido, `escalar_a_humano`, error del bot o un humano contestó desde la app): el bot deja de contestar a ese cliente.
- **Tras 7 días sin actividad**, el siguiente mensaje del cliente empieza una conversación nueva, aunque la anterior estuviera escalada.
- **Si Claude o la API fallan**, el cliente recibe "Una persona de nuestro equipo continuará la conversación..." y la conversación queda escalada. El error queda en `escalationReason`.

### Requisitos

1. **Número de pruebas** activo en **WhatsApp Business App** y conectado a YCloud con **coexistence**. **No** debe ser el número oficial de Meta.
2. **Usuario técnico** en el panel con teléfono = ese número (ver sección 1).
3. Una entrada en `BOT_BRANDS` con `phone` = ese número (52 + 10 dígitos; con o sin `+`).
4. `.env` con `YCLOUD_API_KEY`, `YCLOUD_WEBHOOK_SECRET` y `BOT_IGNORE_PHONES` (número oficial de Meta).

### Paso a paso (pruebas desde tu máquina)

1. **Levanta el servidor**: `npm run dev`. En desarrollo usa el puerto 3005.
2. **Abre un túnel HTTPS**, porque YCloud no puede llamar a `localhost`:
   ```bash
   cloudflared tunnel --url http://localhost:3005
   # o
   ngrok http 3005
   ```
   Copia la URL `https://...` que te da. Con `cloudflared` sin cuenta, la URL cambia cada vez que lo abres.
3. **En YCloud → Developers → Webhooks**, crea un endpoint:
   - URL: `https://<url-del-túnel>/api/bot/ycloud/webhook`
   - Eventos: `whatsapp.inbound_message.received` y `whatsapp.smb.message.echoes` (este último es el que calla al bot cuando contestas desde la app).
   - Copia el **secreto de firma** a `YCLOUD_WEBHOOK_SECRET` en `.env` y reinicia el servidor.
4. **Escribe desde tu celular** al número de pruebas.

### Guion de verificación

1. Escribe "hola". El bot contesta. En Mongo debe aparecer tu documento en `botconversations` y el evento en `webhookevents` con `processedAt`.
2. Pide una cotización. Llega la cotización y luego el mensaje del bot, en ese orden.
3. Reserva. La plantilla de pago llega **desde el número oficial de Meta**. La copia que llega al número del bot se ignora (gracias a `BOT_IGNORE_PHONES`).
4. Manda una foto o PDF del comprobante. Aparece el pago pendiente en el panel y el bot deja de contestar.
5. Con otro celular (u otra conversación), escribe al bot y luego contesta tú desde la app WhatsApp Business. El bot debe callarse (`escalated: true`, motivo "Un humano respondió desde la app...").

### Si algo no funciona

| Síntoma | Revisa |
|---|---|
| YCloud marca el webhook con error 401 | `YCLOUD_WEBHOOK_SECRET` no coincide con el del endpoint, o no reiniciaste el servidor. El reloj del servidor también debe estar en hora (tolerancia de 5 min). |
| Llega el evento pero el bot no contesta | En el log: `[bot] Evento para +52..., que no está en BOT_BRANDS` → el `phone` de la marca no coincide con el número de YCloud. Revisa también `escalated` del documento en `botconversations`. |
| Error `YCloud sendDirectly 4xx` en el log | `YCLOUD_API_KEY` incorrecta, o el número no está activo para API en YCloud. |
| El bot se calla después de su primera respuesta | YCloud estaría mandando echoes también de los mensajes enviados por API. Avísame; se ajusta el filtro de `onEcho` en `services/bot/ycloud.js`. |
| Quieres reiniciar una prueba | Borra el documento de ese cliente en `botconversations`, o pon `escalated: false`. |

---

## 4. Producción

1. Instala dependencias en el servidor (`npm install`); se agrega `@anthropic-ai/sdk`.
2. Pon las variables de la sección 1 en el `.env` de producción, con `BOT_BRANDS` y los tres números/usuarios técnicos reales.
3. Apunta el webhook de YCloud al dominio de producción: `https://<dominio>/api/bot/ycloud/webhook`, con los mismos dos eventos.
4. Corre **una sola instancia** del servidor. La cola por conversación vive en memoria; con varias instancias, dos mensajes seguidos del mismo cliente podrían procesarse a la vez.
5. Piloto con **una marca** durante unos días. Revisa las conversaciones y ajusta el prompt (`systemPrompt` en `services/bot/engine.js`). Después agrega las otras dos marcas a `BOT_BRANDS`.
6. Pendiente del cliente antes del piloto: políticas (cancelación, check-in/out, mascotas, depósito), tono del bot, horario de la torre de control y revisión del aviso de privacidad (los mensajes pasan por YCloud y Anthropic).
