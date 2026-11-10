# Clasificación de las FAQ para el chatbot — Cabañas Mazamitla Navarro

*Fuente: `FAQ_chatbot_Cabanas_Mazamitla.xlsx` (202 preguntas, basadas en ~3,700 conversaciones de Whaticket). Actualizado 2026-10-29.*

## Resumen

| Grupo | Preguntas | Qué se hace |
|---|---|---|
| **A. Conocimiento general** | 89 | Va resumido al prompt del bot: [conocimiento/comun.md](services/bot/conocimiento/comun.md) (políticas, iguales para las 3 marcas) + un archivo corto por marca |
| **B. Ya lo resuelve el sistema** | 36 | Sale del cotizador o de los datos de cada cabaña. Solo hay que exponer algunos campos al bot y revisar que estén bien capturados en el panel. |
| **C. Dato por cabaña que falta** | 18 | Hay que capturarlo por cabaña (propuesta: un campo de texto "Información para ventas"). |
| **D. Pasar a humano** | 37 | El bot no lo resuelve: usa `escalar_a_humano`. |
| **X. Decisión del cliente** | 22 | Respuestas que se contradicen entre asesores o con cómo funciona el bot. Hay que definirlas antes de activar el bot (14 decisiones, abajo). |

No hace falta fine-tuning ni búsqueda semántica: el texto general mide unos pocos miles de tokens y entra completo en el prompt (con caché).

---

## Decisiones pendientes del cliente (grupo X)

Estas preguntas no se pueden cargar tal cual. O los asesores responden distinto, o la respuesta sugerida choca con lo que el sistema ya hace.

| # | Tema | IDs | El conflicto | Recomendación |
|---|---|---|---|---|
| 1 | **INE y correo para reservar** | C03-07, C03-10, C03-21 | Las FAQ piden nombre, correo y foto de INE antes de reservar. El bot hoy solo pide nombre y apellido. | El bot no pide la INE: cualquier imagen que recibe la toma como comprobante y las confundiría. La torre de control la pide después del comprobante. El correo sí lo puede pedir el bot. |
| 2 | **¿Se aparta antes de pagar?** | C01-14, C03-04 | Las FAQ dicen "solo queda apartada al recibir el anticipo". El bot crea una **reserva tentativa** que bloquea las fechas hasta la hora límite de pago; si no se paga, el sistema la cancela. | Que el mensaje oficial sea el del sistema: "queda apartada hasta [hora límite]; si no se recibe el anticipo, se libera". |
| 3 | **Reservas para el mismo día** | C01-25 | Las FAQ piden pago completo antes de dar ubicación y clave. El bot crea tentativa con 50%. | Por ahora el bot escala las reservas para hoy. |
| 4 | **Promociones (3x2, redes sociales)** | C02-12 a C02-15 | Cambian cada mes y el bot no tiene forma de aplicarlas al precio. | Escalar cuando pregunten. Más adelante se pueden conectar con el módulo de cupones. |
| 5 | **Precios aproximados sin fecha** | C02-04 | Las FAQ dan rangos ($1,900–$2,900 pareja, etc.), marcados "validar". | El bot no da rangos: cotiza exacto en segundos con fechas y personas. Un rango viejo genera reclamos. |
| 6 | **Factura** | C02-08 | No hay política definida. | Escalar hasta que se defina. |
| 7 | **Pago del saldo en efectivo** | C03-15 | Unas cabañas aceptan efectivo al llegar, otras solo transferencia. | Dato por cabaña (grupo C) o una regla única. |
| 8 | **Horario de silencio y penalización** | C04-01, C04-04, C07-14 | 10:00 o 10:30 pm según plantilla. La multa de $1,000 solo está confirmada en Bosque Imperial. | Una regla única para todas, o dato por cabaña. |
| 9 | **Cambios de fecha** | C04-16 | Una plantilla dice "no se hacen cambios"; otra permite cambio si se revende la noche (7+ / 4–6 / 0–3 días). | Unificar el texto. El bot de todas formas escala cualquier cambio a una reserva existente. |
| 10 | **Toallas** | C06-30 | Unos dicen que sí hay, otros que solo de mano. | Dato por cabaña. Mientras tanto el bot recomienda llevar toallas de baño. |
| 11 | **Bebés menores de 2 años** | C07-02 | "Normalmente no cuentan" (validar). Afecta cuántas personas busca el bot en el cotizador. | Definir la regla. Si no cuentan, el bot pide edades y los excluye. |
| 12 | **Ubicación antes de pagar** | C08-07 | C05-01 dice que la ubicación exacta se manda al confirmar; C08-04 y C08-07 dicen que se manda al cotizar. | Definir. El sistema tiene las coordenadas de cada cabaña y puede mandar el pin de Maps. |
| 13 | **Catálogo y marca** | C01-02, C06-05 | La FAQ manda al catálogo `wa.me/c/5213319791076`, que es de **otro número**: desde el bot llevaría al cliente al número de los asesores. Además, los enlaces de la cotización apuntan a `rentravel.com.mx` y la marca en `BOT_BRANDS` se llama "Rentravel". | Confirmar con qué nombre se presenta el bot y qué enlaces usa. Recomiendo quitar el catálogo y usar los enlaces de la cotización. |
| 14 | **Fotos dentro del chat** | C06-07 | Los clientes piden las fotos por WhatsApp cuando el enlace no abre. El bot hoy solo manda enlaces. | Mejora técnica: mandar 3–5 fotos como imágenes vía YCloud (~medio día). |

Además, la hoja "Resumen" del Excel menciona que **muchos clientes reciben el saludo automático aunque ya dieron fecha y personas**. El bot ya está instruido para leer esos datos y solo preguntar lo que falta.

---

## B. Lo que ya resuelve el sistema (36)

| Tema | IDs | De dónde sale |
|---|---|---|
| Disponibilidad, cotización, opciones por capacidad | C01-01, 03, 04, 06, 07, 15, 16, 17, 18 · C02-01, 02, 03 | `buscar_disponibilidad` (cotizador). Si una cabaña no aparece en los resultados, no está libre o no cumple la estancia mínima: **las noches mínimas por cabaña y fecha ya las aplica el sistema** (restricciones en `BloqueoFechas`). |
| Cabañas con alberca / jacuzzi | C02-05 · C06-01, 02, 03, 11 | Casillas `privatePool`, `heatedPool`, `jacuzzi` de cada cabaña. |
| Capacidad | C06-13 | `minOccupancy` / `maxOccupancy`. |
| Amenidades | C06-10, 16, 17, 19, 20, 21, 22, 24, 26 | Casillas: sofá cama, billar/juegos, calefacción, chimenea, WiFi, TV, estacionamiento, asador, horno/cocina. |
| Mascotas permitidas | C07-06 | Casilla `petsAllowed`. |
| Hora de entrada y salida | C05-07 | `others.arrivalTime` / `departureTime` de cada cabaña. **Resuelve la discrepancia 2:00 / 2:30 / 3:00 pm**, siempre que cada cabaña tenga su hora capturada. |
| Distancia entre cabañas | C08-03 | Coordenadas de cada cabaña. |
| Anticipo 50%, datos bancarios, comprobante | C03-01, 05, 09, 24 | Flujo actual: `crear_reserva` → plantilla de Meta con los datos bancarios → `registrar_pago`. |
| Fotos de cada cabaña | C06-05 | Enlace en la cotización. |
| Mensaje automático de anuncios | C10-03 | El bot lee lo que el cliente ya escribió. |

**Requisitos:**
1. **Exponer campos al bot.** Hoy no recibe la hora de entrada y salida, la ubicación ni el texto adicional; hay que agregarlos a `detalle_propiedad`. En la búsqueda tampoco recibe alberca, jacuzzi ni mascotas: hay que agregarlos para que pueda filtrar "pet friendly" o "con alberca" sin consultar cabaña por cabaña.
2. **Revisar las casillas en el panel.** El bot responde según lo capturado: si una cabaña acepta mascotas y nadie marcó la casilla, dirá que no. Conviene revisar mascotas, alberca (privada/climatizada), jacuzzi, chimenea, asador, WiFi, TV, sofá cama, horno y horas de entrada/salida.

---

## C. Datos por cabaña que faltan (18)

Propuesta: **un solo campo de texto por cabaña**, "Información para ventas", editable en el panel, que el bot lee al consultar la cabaña. Es más fácil de mantener que 20 casillas nuevas y el modelo entiende texto libre sin problema.

Ya existe `additionalAccomodationDescription` ("descripción adicional", editable en el panel). Se puede reutilizar si no se muestra en la web pública; si se muestra, mejor un campo nuevo para no exponer notas internas.

Qué debería decir ese campo para cada cabaña:

| Dato | IDs |
|---|---|
| Distribución: recámaras, tapanco, tamaño de camas | C06-08 |
| Jacuzzi interior o exterior, y cuántos | C06-12 |
| Bosque o pueblo, minutos al centro, si se puede ir caminando | C08-01, C08-02, C08-09 |
| Fraccionamiento, y si pide QR / placas en caseta | C05-17, C08-10 |
| Acceso: terracería, si entra autobús grande | C05-10, C08-06 |
| Entrega de llaves: caja de seguridad o en persona (y con quién) | C05-03 |
| Red para descansar | C06-25 |
| Privacidad: apartada o con vecinos cerca | C06-18 |
| La vista y qué la distingue de cabañas parecidas | C02-09 |
| Suite de pareja: si admite bebé o niño pequeño | C07-03 |
| Mascotas: tamaño, cuántas, depósito de $500 | C07-07, C07-08, C07-09 |
| Acceso a la cascada El Salto | C08-14 |

Si el cliente decide que estos datos van por cabaña, también entran aquí: saldo en efectivo (#7), horario de silencio y multa (#8), toallas (#10).

---

## D. El bot pasa la conversación a humano (37)

| Tema | IDs |
|---|---|
| Calendario de una cabaña ("¿qué fechas tiene libre la Renata?") | C01-26, C01-27 |
| Lista de espera | C01-10 |
| Dos cabañas o grupo dividido | C01-19, C03-12 |
| Agregar noches, cambios o saldo de una reserva existente | C01-22, C03-19, C04-17 |
| Descuento por estancia larga | C02-16 |
| Decoración (paquetes, fotos, precios) | C02-06, C10-08, C10-09 |
| Emergencias y cancelaciones | C04-10 |
| Identificar una cabaña de una foto o anuncio | C06-06 |
| Durante la estancia: clave, ubicación, llegada, cualquier falla (agua, luz, gas, limpieza, WiFi, chimenea, jacuzzi…) | C05-02, C05-05, C05-09, C09-01 a C09-17 |
| Bolsa de trabajo, proveedores, colaboraciones | C10-06, C10-07 |
| Pide asesor o llamada | C10-15 |

Ojo con la estancia: el huésped escribe al mismo número donde reservó, o sea al del bot. Mientras la conversación siga escalada, el bot no contesta y la atiende la torre de control. Pero después de 7 días sin mensajes el bot vuelve a contestar. Por eso el prompt debe indicarle que escale todo lo que sea de una estancia en curso.

Con la decoración pasa lo mismo que con las promociones: si el cliente entrega los paquetes con fotos y precios, el bot podría presentarlos en vez de escalar.

---

## A. Conocimiento general (89)

*C04-14 ("¿y si llego y la cabaña no es como en las fotos?") pasó de D a A: las pruebas mostraron que es una pregunta antes de reservar, no un incidente.*

Está resumido (no copiado pregunta por pregunta) en [services/bot/conocimiento/comun.md](services/bot/conocimiento/comun.md). Las líneas con `<!-- validar ... -->` son datos que el propio Excel marca por validar; los comentarios no le llegan al modelo. Lo propio de cada marca (cómo se presenta, verificación, redes, números) va aparte, en `navarro.md`, `mazamitla-jalisco.md` y `rentravel.md`.

IDs: C01-05, 08, 09, 11, 12, 13, 20, 21, 23, 24, 28 · C02-07, 10, 11, 17, 18, 19, 20 · C03-02, 03, 06, 08, 11, 13, 14, 16, 17, 18, 20, 22, 23 · C04-02, 03, 05, 06, 07, 08, 09, 11, 12, 13, 15 · C05-01, 04, 06, 08, 11, 12, 13, 14, 15, 16, 18 · C06-04, 09, 14, 15, 23, 27, 28, 29 · C07-01, 04, 05, 10, 11, 12, 13, 15 · C08-04, 05, 08, 11, 12, 13, 15, 16 · C10-01, 02, 04, 05, 10, 11, 12, 13, 14, 16, 17.

---

## Cómo se "entrena" y se mide

La columna "Así la escriben los clientes" trae 2–3 variantes por pregunta: **~500 frases reales**. Se convierten en un set de pruebas:

1. Un script le manda cada variante al bot (como en el simulador, con fechas futuras).
2. Otro modelo compara la respuesta con la "Respuesta sugerida" y con el grupo esperado. Revisa que conteste lo correcto en A, que use los datos en B y C, y que escale en D.
3. Cada cambio al prompt o a los datos se mide contra ese set. Se ve qué mejoró y qué se rompió, en vez de probar a mano.

---

## Trabajo técnico (3 marcas)

El catálogo de cabañas es **compartido** entre las 3 marcas ([plan_chatbot.md](plan_chatbot.md)). Por eso los datos por cabaña (grupos B y C) se trabajan **una sola vez**. Lo que cambia por marca es el texto de conocimiento (nombre, enlaces, números, y políticas si difieren) y la configuración en `BOT_BRANDS`.

### Conocimiento por marca

Las 3 marcas tienen las mismas políticas (confirmado 2026-10-29). Por eso hay un solo archivo de políticas y uno corto por marca, en `services/bot/conocimiento/`:

| Archivo | Contenido | Estado |
|---|---|---|
| `comun.md` | Políticas, reglas, cabañas en general, Mazamitla, cuándo escalar | Listo, con datos por validar |
| `navarro.md` | Cabañas Mazamitla Navarro: cómo se presenta, mazamitlaseguro.com, redes | Faltan enlaces de redes y números oficiales |
| `mazamitla-jalisco.md` | Mazamitla Jalisco | Falta casi todo: nombre exacto, verificación, redes, números |
| `rentravel.md` | Rentravel | Faltan verificación, redes y números |

El nombre de cada archivo debe coincidir con el `key` de la marca en `BOT_BRANDS`.

### Tareas

| # | Tarea | Detalle | Estimado |
|---|---|---|---|
| 1 | **Conocimiento en el prompt** | El engine carga `conocimiento/comun.md` + `conocimiento/<key>.md`, quita los comentarios y los agrega al prompt del sistema (con caché). Ajustar el prompt base: reglas de escalación nuevas, no dar rangos de precio, pedir edades si hay niños. | 2–3 h |
| 2 | **Configuración por marca** | Hoy el enlace de la cotización (`rentravel.com.mx/cabin/…`) y la URL de imágenes están fijos en `tools.js`. Pasarlos a `BOT_BRANDS` (`cabinUrl`, `imagesUrl`) para que cada marca mande sus propios enlaces. | 1 h |
| 3 | **Datos de cabaña al bot** | Todo ya existe; solo se mapea en `tools.js`. `detalle_propiedad`: pin de Google Maps con las coordenadas que ya trae la cotización (normalizando las guardadas ×10,000, como hace `eventController`), y hora de entrada/salida + "Información para ventas" con el mismo `GET /api/habitaciones/:id` que ya usa `crear_reserva`. `buscar_disponibilidad`: pasar alberca, jacuzzi y mascotas de `accomodationFeatures`, que ya vienen en la cotización. | 1–1.5 h |
| 4 | **Campo "Información para ventas"** | Modelo `Habitacion` + vistas de alta y edición de cabaña en el panel + validación. Si se reutiliza `additionalAccomodationDescription`, esta tarea desaparece. | 2–3 h |
| 5 | **Correo del cliente** | `crear_reserva` pide y envía el correo (`clientEmail` ya lo acepta el API). | 1 h |
| 6 | **Set de pruebas** | Script que lee el Excel de FAQ, manda cada variante al bot de cada marca contra la base de desarrollo, y otro modelo califica la respuesta: contestó bien (A), usó los datos (B/C) o escaló (D). Reporte por marca con lo que falla. | 1–1.5 días |
| 7 | **Ajuste con los resultados** | Iterar prompt y conocimiento hasta que el set pase. La primera marca lleva más; las otras reutilizan casi todo. | 1.5–2 días |
| | **Total** | | **~3.5–4.5 días** (7–9.5 h de código + 2.5–3.5 días de pruebas y ajuste) |
| 8 | *(Opcional)* Fotos como imágenes en el chat | Mandar 3–5 fotos de la cabaña vía YCloud cuando el cliente las pida. | 0.5 día |

### Estado (2026-10-31)

| # | Estado |
|---|---|
| 1 | ✅ `engine.js` carga `comun.md` + `<key>.md`. Prompt ajustado: contestar primero con la información del negocio, escalar solo lo necesario (escalar apaga al bot en esa conversación), aviso de estancia mínima en fin de semana. |
| 2 | ✅ `cabinUrl` e `imagesUrl` opcionales por marca en `BOT_BRANDS`. |
| 3 | ✅ `detalle_propiedad` trae horas de entrada/salida, pin de Maps e "Información para ventas"; `buscar_disponibilidad` marca alberca, alberca climatizada, jacuzzi y mascotas. |
| 4 | ✅ Campo nuevo `salesInfo` ("Información para ventas (chatbot)") en el modelo y en alta y edición de cabaña (incluida la vista optimizada). No se reutilizó la descripción adicional para no exponer notas internas. |
| 5 | ⛔ **No se implementó.** `createReservation` usa `clientEmail` solo para *buscar* un cliente existente y no lo guarda. Si el bot lo enviara y alguien escribiera el correo de otra persona, la reserva quedaría ligada a ese cliente y la plantilla de pago le llegaría a su teléfono. El conocimiento indica que la INE y el correo los pide el equipo después del anticipo. Si se quiere que el bot los capture, hay que guardar el correo en el cliente creado (cambio en `createReservation`, fuera de lo que el bot toca hoy). |
| 6 | ✅ `npm run bot:eval -- <marca> <ruta.xlsx>` (ver BOT_DEPLOY.md). |
| 7 | ✅ Primera ronda con Rentravel: de **80% a 94%** (281 de 298 casos válidos). Lo que falla: datos pendientes de validar (depósito de mascota, decoración, redes de Rentravel) y mensajes que sin contexto son ambiguos. Falta correr Navarro y Mazamitla Jalisco cuando estén en `BOT_BRANDS`. |

**Costo de las pruebas:** cada corrida completa son ~500 variantes × 3 marcas, más la calificación. Con Haiku cuesta unos pocos dólares por corrida.

### Lo que no es desarrollo (lo hace el cliente)

- Las 14 decisiones de arriba.
- **Capturar "Información para ventas"** en cada cabaña y revisar las casillas de amenidades y las horas de entrada/salida. Es el trabajo más largo y del que más depende la calidad de las respuestas.
- Los datos de cada marca: nombre exacto, cómo verificarla, enlaces de redes y números oficiales.

Esto no estaba en [plan_chatbot.md](plan_chatbot.md) (allí el contenido de políticas aparece como insumo del cliente, no como desarrollo).
