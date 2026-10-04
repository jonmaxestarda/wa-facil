# 🌱 wa-facil

**Wrapper en español, fácil de usar, para [`@itsliaaa/baileys`](https://www.npmjs.com/package/@itsliaaa/baileys)** (un fork de Baileys v7 para WhatsApp Web).

En lugar de escribir esto:

```js
sock.sendMessage(jid, { poll: { name: '¿Pizza?', values: ['Sí', 'No'], selectableCount: 1 } }, { quoted: message })
```

escribes esto:

```js
msg.responderEncuesta('¿Pizza?', ['Sí', 'No'])
```

Y te da ya resuelto: conexión con QR o código, reconexión automática, sistema de comandos con permisos, mensajes normalizados, grupos, perfil, privacidad y canales.

---

## 📋 Contenido

1. [Requisitos e instalación](#1--requisitos-e-instalación)
2. [Inicio rápido (2 minutos)](#2--inicio-rápido-2-minutos)
3. [Conectar con WhatsApp (QR o código)](#3--conectar-con-whatsapp-qr-o-código)
4. [Opciones de configuración](#4--opciones-de-configuración)
5. [Eventos](#5--eventos)
6. [El objeto `msg` (mensaje recibido)](#6--el-objeto-msg-mensaje-recibido)
7. [Comandos](#7--comandos)
8. [Enviar mensajes](#8--enviar-mensajes)
9. [Mensajes interactivos](#9--mensajes-interactivos-botones-listas-carrusel)
10. [Texto enriquecido (tabla, código, enlaces)](#10--texto-enriquecido-tabla-código-enlaces)
11. [Acciones sobre mensajes](#11--acciones-sobre-mensajes)
12. [Grupos](#12--grupos)
13. [Comunidades](#13--comunidades)
14. [Perfil y contactos](#14--perfil-y-contactos)
15. [Privacidad](#15--privacidad)
16. [Canales](#16--canales-newsletters)
17. [Esperar respuestas (conversaciones)](#17--esperar-respuestas-conversaciones)
18. [Utilidades](#18--utilidades)
19. [Usar la librería original (escape)](#19--usar-la-librería-original-escape)
20. [Tabla de equivalencias](#20--tabla-de-equivalencias)
21. [Solución de problemas](#21--solución-de-problemas)
22. [Avisos y créditos](#22--avisos-y-créditos)

---

## 1. 📥 Requisitos e instalación

- **Node.js 20 o superior** (`node --version`)
- Un teléfono con WhatsApp para vincular el bot
- Proyecto en **ESM**: en tu `package.json` pon `"type": "module"` (o usa archivos `.mjs`)

```bash
# 1) Copia la carpeta wa-facil a tu proyecto (o publícala en npm / GitHub)
# 2) Instala las dependencias
npm install

# Opcional: para ver el QR dibujado en la consola
npm install qrcode-terminal

# Opcional: para convertir imágenes a stickers/miniaturas automáticamente
npm install sharp
```

Estructura:

```
wa-facil/
├── src/
│   ├── index.js        ← lo que importas
│   ├── bot.js          ← clase WhatsAppBot
│   ├── mensaje.js      ← clase Mensaje (msg)
│   ├── modulos.js      ← grupos, comunidades, perfil, privacidad, canales
│   └── utilidades.js   ← funciones auxiliares
└── ejemplos/           ← 4 ejemplos listos para ejecutar
```

Importar:

```js
import { WhatsAppBot } from './wa-facil/src/index.js'
```

---

## 2. 🚀 Inicio rápido (2 minutos)

```js
import { WhatsAppBot } from './wa-facil/src/index.js'

const bot = new WhatsAppBot()          // por defecto: QR + sesión en la carpeta "sesion"

bot.comando('ping', (msg) => msg.responder('🏓 pong'))

await bot.iniciar()
```

1. Ejecuta `node bot.js`.
2. Escanea el QR: **WhatsApp → Dispositivos vinculados → Vincular un dispositivo**.
3. Escríbele `!ping` al bot desde **otro** número (o en un grupo donde esté).

> La sesión se guarda en la carpeta `sesion/`. La próxima vez que lo ejecutes no te pedirá el QR.

---

## 3. 🔐 Conectar con WhatsApp (QR o código)

### Opción A: QR (por defecto)

```js
const bot = new WhatsAppBot({ modo: 'qr' })
```

Si instalaste `qrcode-terminal`, el QR se dibuja en consola. Si no, puedes recibirlo como texto y mostrarlo como quieras:

```js
bot.on('qr', (textoQR) => console.log('QR:', textoQR))
```

### Opción B: Código de vinculación (sin escanear)

```js
const bot = new WhatsAppBot({
   modo: 'codigo',
   numero: '5491112345678'     // TU número con código de país, solo dígitos
})

bot.on('codigo', (codigo) => console.log('Escribe este código en tu WhatsApp:', codigo))
```

En el teléfono: **WhatsApp → Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono** y escribe el código (por ejemplo `ABCD-1234`).

Puedes elegir tu propio código de 8 caracteres:

```js
new WhatsAppBot({ modo: 'codigo', numero: '5491112345678', codigoPersonalizado: 'STARFALL' })
```

### Reconexión automática

Si se cae internet o WhatsApp cierra la conexión, el bot **reconecta solo** (con esperas crecientes de hasta 30 s). No reconecta si:

- Cerraste la sesión desde el teléfono (`sesionCerrada`): borra la carpeta `sesion/` y vincula de nuevo.
- La sesión se abrió en otro lugar (`sesionReemplazada`).

### Detener / cerrar sesión

```js
bot.detener()              // cierra la conexión, conserva la sesión
await bot.cerrarSesion()   // desvincula el dispositivo (tendrás que vincular otra vez)
```

---

## 4. ⚙️ Opciones de configuración

```js
const bot = new WhatsAppBot({ /* opciones */ })
```

| Opción | Por defecto | Descripción |
|---|---|---|
| `sesion` | `'sesion'` | Carpeta donde se guarda la sesión. |
| `modo` | `'qr'` | `'qr'` o `'codigo'`. |
| `numero` | `null` | Tu número (obligatorio si `modo: 'codigo'`). |
| `codigoPersonalizado` | `null` | Código de 8 caracteres para vincular. |
| `prefijos` | `['!', '/', '.']` | Prefijos de comando. Usa `''` para comandos sin prefijo. |
| `propietarios` | `[]` | Números (solo dígitos) con permisos de dueño. |
| `ignorarPropios` | `true` | Ignora los mensajes enviados por el propio bot. |
| `incluirEstados` | `false` | Procesa estados (`status@broadcast`). |
| `procesarHistorial` | `false` | Procesa mensajes antiguos que llegan al conectar. |
| `ignorarMayusculas` | `true` | `!PING` funciona igual que `!ping`. |
| `marcarEnLinea` | `false` | Aparecer "en línea" al conectar. |
| `mostrarQR` | `true` | Dibuja el QR en consola (necesita `qrcode-terminal`). |
| `logs` | `true` | Mensajes amigables en consola (conectado, desconectado...). |
| `nivelLog` | `'silent'` | Nivel del logger interno de Baileys (`'info'`, `'debug'`...). Necesita `pino`. |
| `reconectar` | `true` | Reconexión automática. |
| `maxReintentos` | `Infinity` | Máximo de reintentos seguidos. |
| `esperaReconexion` | `2000` | Milisegundos base entre reintentos. |
| `rechazarLlamadas` | `false` | Rechaza automáticamente las llamadas entrantes. |
| `avisarErrores` | `true` | Si un comando falla, responde con un mensaje de error. |
| `mensajes` | (ver abajo) | Personaliza los textos de aviso. |
| `opcionesSocket` | `{}` | Opciones extra que se pasan a `makeWASocket`. |
| `estadoAuth` | `null` | Función `async () => ({ state, saveCreds })` para usar otro tipo de sesión. |

### Personalizar los avisos

```js
const bot = new WhatsAppBot({
   mensajes: {
      soloGrupos: '👥 Solo en grupos, por favor.',
      soloAdmins: '🚫 Eso es solo para admins.',
      espera: (segundos) => `Calma, espera ${segundos}s ⏳`
   }
})
```

Claves disponibles: `soloGrupos`, `soloPrivado`, `soloAdmins`, `botNoAdmin`, `soloPropietario`, `espera(segundos)`, `error`.

---

## 5. 📡 Eventos

Se usan con `bot.on('nombre', funcion)`.

| Evento | Se dispara cuando... | Datos |
|---|---|---|
| `listo` | El bot se conectó. | `{ jid, lid, nombre }` |
| `qr` | Hay un QR nuevo (modo `qr`). | texto del QR |
| `codigo` | Se generó el código (modo `codigo`). | `'ABCD-1234'` |
| `cerrado` | Se cerró la conexión. | `{ codigo, razon, reconectara }` |
| `reconectando` | Va a reintentar. | `{ intento, espera }` |
| `sesionCerrada` | Cerraste la sesión desde el teléfono. | — |
| `sesionReemplazada` | Se abrió la sesión en otro sitio. | — |
| `conexion` | Cualquier cambio de conexión (crudo). | objeto de Baileys |
| `mensaje` | Llega un mensaje. | `msg` |
| `mensaje:grupo` | Llega un mensaje de grupo. | `msg` |
| `mensaje:privado` | Llega un mensaje privado. | `msg` |
| `mensaje:eliminado` | Alguien borró un mensaje. | `{ chat, id, de }` |
| `mensaje:actualizado` | Cambió el estado de un mensaje (entregado, leído, votos...). | crudo |
| `comando` | Va a ejecutarse un comando. | `msg, info` |
| `comando:desconocido` | Escribieron un comando que no existe. | `msg, nombre` |
| `participantes` | Entra/sale/cambia alguien en un grupo. | `{ grupo, accion, participantes, autor }` |
| `grupo:actualizado` | Cambió el nombre/ajustes de un grupo. | crudo |
| `reaccion` | Alguien reaccionó a un mensaje. | `{ chat, mensajeId, emoji, de }` |
| `llamada` | Llamada entrante. | `{ id, de, estado, esVideo, esGrupo }` |
| `presencia` | Alguien está escribiendo/en línea. | crudo |
| `error` | Ocurrió un error. | `error, contexto` |

> 💡 Si no escuchas `error`, los errores se muestran en consola igualmente.

```js
bot.on('listo', (yo) => console.log('Conectado como', yo.nombre))
bot.on('cerrado', ({ reconectara }) => console.log('Se cayó. ¿Reconecta?', reconectara))
bot.on('error', (e, contexto) => console.error(`Error en ${contexto}:`, e))
```

### Eventos crudos de Baileys

Para eventos que el wrapper no traduce, usa `escucharCrudo` (sobrevive a reconexiones):

```js
bot.escucharCrudo('chats.upsert', (chats) => console.log(chats))
```

Lista completa en el README de `@itsliaaa/baileys` (sección *Events*).

---

## 6. 💬 El objeto `msg` (mensaje recibido)

Cada vez que llega un mensaje (evento `mensaje` o en un comando) recibes un objeto `msg`.

### Propiedades

| Propiedad | Ejemplo | Descripción |
|---|---|---|
| `msg.texto` | `'hola'` | Texto del mensaje (o leyenda de una foto; o el `id` de un botón pulsado). |
| `msg.tipo` | `'imagen'` | `texto`, `imagen`, `video`, `audio`, `documento`, `sticker`, `ubicacion`, `contacto`, `contactos`, `encuesta`, `voto`, `reaccion`, `respuesta_boton`, `respuesta_lista`, `respuesta_interactiva`, `evento`, `producto`... |
| `msg.chat` | `'123@g.us'` | Dónde se escribió (para responder). |
| `msg.de` | `'5491...@s.whatsapp.net'` | Quién lo escribió. |
| `msg.deAlt` | `'...'` | Identificador alternativo (si `de` es un LID, aquí suele venir el teléfono). |
| `msg.numero` | `'5491112345678'` | Mejor intento de obtener el teléfono del autor. |
| `msg.nombre` | `'Ana'` | Nombre de perfil del autor. |
| `msg.id` | `'3EB0...'` | ID del mensaje. |
| `msg.fecha` | `Date` | Fecha de envío. |
| `msg.esGrupo` / `msg.esPrivado` / `msg.esCanal` / `msg.esEstado` | `true/false` | Dónde se escribió. |
| `msg.esMia` | `false` | ¿Lo envió el propio bot? |
| `msg.esMultimedia` | `true` | ¿Tiene archivo (imagen, video, audio, documento, sticker)? |
| `msg.menciones` | `['...@s.whatsapp.net']` | Personas mencionadas. |
| `msg.citado` | `{ id, de, tipo, texto, descargar() }` o `null` | Mensaje al que respondió. |
| `msg.editado` | `false` | ¿Es una edición? |
| `msg.mimetype`, `msg.nombreArchivo` | | Datos del archivo. |
| `msg.ubicacion` | `{ lat, lng, nombre }` | Si es una ubicación. |
| `msg.reaccion` | `{ emoji, mensajeId }` | Si es una reacción. |
| `msg.raw` | | Mensaje original de Baileys. |
| `msg.bot` | | El bot. |

### Métodos

```js
// --- Responder
await msg.responder('Hola')                          // citando el mensaje
await msg.enviar('Hola')                             // sin citar
await msg.responderImagen('foto.jpg', 'Mira esto')
await msg.responderVideo('video.mp4', 'Mira esto')
await msg.responderAudio('audio.mp3', { nota: true })
await msg.responderDocumento('informe.pdf', { nombre: 'Informe.pdf' })
await msg.responderSticker('sticker.webp')
await msg.responderBotones('¿Sí o no?', [{ texto: 'Sí', id: '!si' }])
await msg.responderLista({ /* ver sección 9 */ })
await msg.responderEncuesta('¿Pizza?', ['Sí', 'No'])

// --- Acciones
await msg.reaccionar('❤️')          // '' para quitar la reacción
await msg.leer()                    // marca como leído
await msg.escribiendo(2000)         // "escribiendo..." 2 segundos
await msg.editar('texto nuevo')     // solo si el mensaje es del bot
await msg.borrar()

// --- Archivos
const buffer = await msg.descargar()          // Buffer de la imagen/video/audio/...
await msg.guardar('./descargas/foto.jpg')     // descarga y guarda en disco

// --- Grupos
await msg.esAdmin()                 // ¿el autor es admin?
await msg.botEsAdmin()              // ¿el bot es admin?
await msg.grupo()                   // información del grupo

// --- Conversación
const resp = await msg.esperarRespuesta(30000)   // espera la siguiente respuesta de esta persona
```

### Mensaje citado

```js
bot.comando('quien', async (msg) => {
   if (!msg.citado) return msg.responder('Responde a un mensaje con !quien')
   await msg.responder(`Escribió: ${msg.citado.texto}\nAutor: ${msg.citado.de}`)

   if (msg.citado.esMultimedia) {
      const buffer = await msg.citado.descargar()   // descarga el archivo citado
   }
})
```

---

## 7. 🧩 Comandos

### Lo básico

```js
bot.comando('nombre', async (msg, args, info) => {
   // msg  -> el mensaje
   // args -> palabras después del comando, como arreglo
   // info -> { bot, prefijo, comando, texto }
})
```

Si escriben `!saludar Ana Pérez`:

```js
bot.comando('saludar', (msg, args, info) => {
   args        // ['Ana', 'Pérez']
   info.texto  // 'Ana Pérez'   (todo junto)
   info.comando // 'saludar'
   info.prefijo // '!'
   return msg.responder(`Hola ${info.texto}`)
})
```

### Opciones de un comando

```js
bot.comando('ban', handler, {
   alias: ['expulsar', 'kick'],   // otros nombres
   descripcion: 'Expulsa a alguien',   // aparece en generarMenu()
   categoria: 'Grupos',                // agrupa el menú
   soloGrupos: true,                   // solo funciona en grupos
   soloPrivado: false,                 // solo funciona en privado
   soloAdmins: true,                   // solo admins del grupo (o el propietario)
   botAdmin: true,                     // el bot debe ser admin del grupo
   soloPropietario: false,             // solo los números de `propietarios`
   cooldown: 10                        // segundos de espera por usuario
})
```

También puedes dar varios nombres en un arreglo: `bot.comando(['hola', 'hi'], handler)`.

### Menú automático

```js
bot.comando(['menu', 'ayuda'], (msg) => msg.responder(bot.generarMenu()), {
   descripcion: 'Muestra los comandos'
})
```

Resultado:

```
📋 *Comandos disponibles*

*Utilidades*
• !ping — Comprueba que el bot responde
• !decir — Repite lo que escribas

*Juegos*
• !dado — Tira un dado
```

Personaliza con `bot.generarMenu({ titulo: '🤖 *Mi bot*', prefijo: '/' })`.

### Botones que ejecutan comandos

Cuando alguien pulsa un botón/fila de lista, el `id` del botón llega como `msg.texto`. Si el `id` es `'!ping'`, **se ejecuta el comando `ping`** automáticamente.

### Sin prefijo

```js
new WhatsAppBot({ prefijos: [''] })    // "ping" ejecuta el comando ping
```

### Lista de comandos registrados

```js
bot.comandos   // arreglo con todas las definiciones
```

### Manejo de errores

Si el comando lanza un error, el bot lo muestra en consola (o en tu evento `error`) y responde con `mensajes.error` (desactívalo con `avisarErrores: false`).

---

## 8. ✉️ Enviar mensajes

Todos los métodos están en `bot` y reciben el destino (`jid`) como primer parámetro. El destino puede ser:

| Tipo | Ejemplo |
|---|---|
| Número | `'5491112345678'` (se convierte solo a `@s.whatsapp.net`) |
| JID de persona | `'5491112345678@s.whatsapp.net'` |
| Grupo | `'120363000000000000@g.us'` |
| Canal | `'120363000000000000@newsletter'` |
| Dentro de un comando | `msg.chat` |

### Opciones comunes (último parámetro `op`)

Todos los métodos de envío aceptan estas opciones:

| Opción | Qué hace |
|---|---|
| `citar: msg` | Responde citando ese mensaje. |
| `menciones: ['5491...']` | Menciona personas (el texto debe contener `@numero`). |
| `mencionarTodos: true` | Menciona a todo el grupo. |
| `ia: true` | Icono de IA (solo chats privados). |
| `efimero: true` | Envuelve en mensaje efímero. |
| `verUnaVez: true` | Se ve una sola vez (también `verUnaVezV2`). |
| `spoiler: true` | Marca el contenido como spoiler. |
| `grupoEstado: true` | Publica como estado de grupo (solo grupos). |
| `etiquetaMeta: true` | Etiqueta de servicio seguro de Meta. |
| `anuncio: {...}` | Miniatura estilo anuncio (ver más abajo). |
| `vistaPrevia: {...}` | Vista previa de enlace personalizada (ver más abajo). |
| `opcionesEnvio: {...}` | Opciones extra para `sendMessage` (3er parámetro de Baileys). |

### Texto

```js
await bot.enviarTexto(jid, 'Hola 👋')
await bot.enviarTexto(jid, 'Hola @5491112345678', { menciones: ['5491112345678'] })
await bot.enviarTexto(grupoJid, 'Atención @todos', { mencionarTodos: true })
await bot.enviarTexto(jid, 'Respondiendo...', { citar: msg })
```

Vista previa de enlace personalizada:

```js
import { readFileSync } from 'node:fs'

await bot.enviarTexto(jid, 'https://ejemplo.com 👆 Mira esto', {
   vistaPrevia: {
      url: 'https://ejemplo.com',
      titulo: 'Mi sitio',
      descripcion: 'Una descripción corta',
      miniatura: readFileSync('./miniatura.jpg')   // Buffer
   }
})
```

Miniatura estilo anuncio:

```js
await bot.enviarTexto(jid, '📰 Noticia', {
   anuncio: {
      titulo: '¿Sabías que...?',
      texto: 'Dato curioso',
      miniatura: readFileSync('./foto.jpg'),   // debe ser Buffer
      grande: false,
      url: 'https://ejemplo.com'
   }
})
```

### De dónde pueden venir los archivos

En imagen, video, audio, documento y sticker puedes pasar:

```js
'./carpeta/foto.jpg'                 // ruta local
'https://sitio.com/foto.jpg'         // URL
readFileSync('./foto.jpg')           // Buffer
{ url: './foto.jpg' }                // objeto con url
{ stream: createReadStream('./foto.jpg') }   // stream
```

### Imagen, video, audio, documento, sticker

```js
await bot.enviarImagen(jid, './foto.jpg', '🔥 Genial')

await bot.enviarVideo(jid, './video.mp4', 'Mira esto')
await bot.enviarVideo(jid, './video.mp4', '', { gif: true })   // se reproduce como GIF
await bot.enviarVideo(jid, './video.mp4', '', { ptv: true })   // videomensaje redondo

await bot.enviarAudio(jid, './audio.mp3')
await bot.enviarAudio(jid, './audio.ogg', { nota: true })      // nota de voz

await bot.enviarDocumento(jid, './informe.pdf', { nombre: 'Informe.pdf', leyenda: '✨ Mi trabajo' })
// el mimetype se detecta por la extensión; puedes forzarlo con { mimetype: '...' }

await bot.enviarSticker(jid, './sticker.webp')     // debe ser .webp
```

### Álbum (varias fotos y videos juntos)

```js
await bot.enviarAlbum(jid, [
   { imagen: './1.jpg', leyenda: 'Primera' },
   { video: './2.mp4', leyenda: 'Un video' },
   { imagen: './3.jpg' }
])
```

### Paquete de stickers

```js
await bot.enviarPaqueteStickers(jid, {
   portada: './portada.webp',
   stickers: ['./1.webp', './2.webp', './3.webp'],
   nombre: '📦 Mi paquete',
   autor: '🌟 Yo',
   descripcion: 'Hecho con wa-facil'
})
```

> Si no tienes `sharp` ni `@napi-rs/image` instalado, la portada y los stickers deben estar ya en formato WebP.

### Ubicación y contactos

```js
await bot.enviarUbicacion(jid, -34.6037, -58.3816, 'Obelisco, Buenos Aires')

await bot.enviarContacto(jid, { nombre: 'Lia Wynn', numero: '628123456789', organizacion: 'Mi empresa' })

await bot.enviarContacto(jid, [
   { nombre: 'Ana', numero: '5491111111111' },
   { nombre: 'Luis', numero: '5491122222222' }
])
```

### Encuesta

```js
await bot.enviarEncuesta(jid, '🔥 ¿Cuál prefieres?', ['JavaScript', 'Python', 'Rust'])

await bot.enviarEncuesta(jid, '¿Qué toppings?', ['Queso', 'Jamón', 'Piña'], {
   maxSelecciones: 2,                           // cuántas opciones se pueden elegir
   terminaEn: new Date(Date.now() + 3600000),   // opcional: cierre
   ocultarVotantes: false,                      // opcional
   permitirAgregarOpciones: false               // opcional
})
```

### Evento

```js
await bot.enviarEvento(jid, {
   nombre: '🎶 Fiesta',
   descripcion: 'Una reunión para conocernos.',
   inicio: new Date(Date.now() + 3600000),
   fin: new Date(Date.now() + 28800000),
   ubicacion: { nombre: 'Buenos Aires', lat: -34.6, lng: -58.4 },
   llamada: 'audio',            // opcional: 'audio' | 'video'
   cancelado: false,            // opcional
   invitadosExtra: false        // opcional
})
```

### Invitación a un grupo

```js
await bot.enviarInvitacionGrupo(jid, {
   codigo: 'https://chat.whatsapp.com/ABC123',   // acepta enlace o código
   grupoJid: '120363000000000000@g.us',
   nombre: 'Mi grupo',
   texto: '👋 Te invitamos a nuestro grupo'
})
```

---

## 9. 🔘 Mensajes interactivos (botones, listas, carrusel)

> ⚠️ Los mensajes interactivos dependen de la versión de WhatsApp del que los recibe y WhatsApp puede cambiar su comportamiento sin aviso. Pruébalos en tus dispositivos antes de depender de ellos.

### Botones simples

```js
await bot.enviarBotones(jid, '¿Te gusta este bot?', [
   { texto: '👍 Sí', id: '!si' },
   { texto: '👎 No', id: '!no' }
], { pie: 'wa-facil' })

// Con imagen
await bot.enviarBotones(jid, 'Elige', [{ texto: 'OK', id: '!ok' }], { imagen: './foto.jpg', pie: 'Pie' })
```

Un botón también puede abrir una lista:

```js
await bot.enviarBotones(jid, 'Menú', [
   { texto: '👋 Hola', id: '!hola' },
   {
      texto: '📋 Seleccionar',
      secciones: [
         { titulo: 'Sección 1', filas: [{ titulo: 'Opción A', id: '!a' }] },
         { titulo: 'Sección 2', etiqueta: '🔥 Popular', filas: [{ titulo: 'Opción B', id: '!b' }] }
      ]
   }
])
```

### Lista desplegable (solo chats privados)

```js
await bot.enviarLista(jid, {
   texto: '📋 Elige una opción',
   titulo: '👋 Hola',
   pie: 'wa-facil',
   botonTexto: 'Ver opciones',
   secciones: [
      { titulo: 'Juegos', filas: [{ titulo: 'Dado', descripcion: 'Tira un dado', id: '!dado' }] },
      { titulo: 'Utilidades', filas: [{ titulo: 'Ping', descripcion: 'Prueba', id: '!ping' }] }
   ]
})
```

### Interactivo (el más completo)

Permite mezclar varios tipos de botón:

```js
await bot.enviarInteractivo(jid, {
   texto: '🗄️ Mensaje interactivo',
   pie: 'wa-facil',
   imagen: './foto.jpg',           // opcional (también `video`)
   botones: [
      { texto: '👋 Saludar', id: '!hola', icono: 'review' },          // responde con un id
      { texto: '🌐 Web', url: 'https://ejemplo.com', webview: true },  // abre un enlace
      { texto: '📋 Copiar', copiar: 'CODIGO-123' },                    // copia un texto
      { texto: '📞 Llamar', llamar: '5491112345678' },                 // llama
      { texto: '📋 Lista', secciones: [{ titulo: 'Menú', filas: [{ titulo: 'Item', id: '!item' }] }] }
   ],
   // Opcionales:
   textoOpciones: '👉 Ver opciones',     // agrupa todos los botones en un solo desplegable
   tituloOpciones: '📄 Opciones',
   oferta: {                              // cupón
      texto: '🏷️ ¡Cupón!',
      codigo: 'PROMO10',
      url: 'https://ejemplo.com',
      expira: Date.now() + 3_600_000
   },
   comoPlantilla: false
})
```

### Carrusel

```js
await bot.enviarCarrusel(jid, '🗂️ Mira estas opciones', [
   {
      imagen: './1.jpg',
      texto: '🖼️ Imagen 1',
      pie: 'Pinterest',
      botones: [{ texto: '🌐 Ver', url: 'https://ejemplo.com' }]
   },
   {
      imagen: './2.jpg',
      texto: '🖼️ Imagen 2',
      botones: [{ texto: '🌐 Ver', url: 'https://ejemplo.com' }],
      oferta: { texto: 'Cupón', codigo: 'ABC', url: 'https://ejemplo.com', expira: Date.now() + 3600000 }
   }
], { pie: 'wa-facil' })
```

### Plantilla (hydrated template)

```js
await bot.enviarPlantilla(jid, {
   titulo: '👋 Hola',
   imagen: './foto.jpg',
   texto: '🫙 Plantilla',
   pie: 'wa-facil',
   botones: [
      { texto: '👉 Pedir', id: '!pedir' },
      { texto: '🌐 Web', url: 'https://ejemplo.com' },
      { texto: '📞 Llamar', llamar: '5491112345678' }
   ]
})
```

### Cómo llegan las respuestas de los botones

Cuando alguien pulsa un botón recibes un mensaje normal donde:

- `msg.texto` = el `id` del botón (ej. `'!si'`)
- `msg.tipo` = `'respuesta_boton'`, `'respuesta_lista'` o `'respuesta_interactiva'`

Por eso, si usas ids con tu prefijo (`!si`), **se ejecutan los comandos solos**.

---

## 10. 📋 Texto enriquecido (tabla, código, enlaces)

> Estos formatos son relativamente nuevos en WhatsApp y pueden no verse en versiones antiguas.

### Tabla

```js
await bot.enviarTabla(jid, {
   aviso: 'Tabla de ejemplo',                  // opcional (texto de aviso arriba)
   cabecera: '## Node.js vs Bun vs Deno',      // opcional
   texto: '---',                               // opcional
   titulo: 'Comparación de runtimes',
   filas: [
      ['', 'Node.js', 'Bun', 'Deno'],          // primera fila = encabezado
      ['Motor', 'V8', 'JavaScriptCore', 'V8'],
      ['Rendimiento', '4/5', '5/5', '4/5']
   ],
   sinEncabezado: false,                       // true = la primera fila no es encabezado
   pie: '¿Quedó claro?'
})
```

### Código con colores

```js
await bot.enviarCodigo(jid, {
   cabecera: '## Ejemplo',
   lenguaje: 'javascript',
   codigo: 'console.log("Hola, mundo!")',
   pie: '¡Así de simple!'
})
```

Lenguajes soportados por la librería: `css`, `html`, `javascript`, `typescript`, `python`, `golang`, `rust`, `c`, `c#`, `c++`, `bash`, `bat`, `powershell`.

### Enlaces con título

```js
await bot.enviarEnlaces(jid, {
   cabecera: '## Mira esto',
   enlaces: [
      { texto: '1. Google', titulo: 'Buscador', url: 'https://www.google.com/' },
      { texto: '2. YouTube', titulo: 'Videos', url: 'https://www.youtube.com/' }
   ]
})
```

---

## 11. 🛠️ Acciones sobre mensajes

Estos métodos aceptan un `msg` **o** una clave (`key`) de mensaje.

```js
await bot.reaccionar(msg, '✨')            // '' para quitar
await bot.editar(enviado, 'texto nuevo')   // editar un mensaje del bot
await bot.borrar(msg)                      // borrar para todos
await bot.reenviar(otroJid, msg)           // reenviar
await bot.fijar(msg, 86400)                // fijar 1 día (86400 | 604800 | 2592000)
await bot.desfijar(msg)
await bot.leer(msg)                        // marcar como leído

await bot.escribiendo(jid, 2000)               // "escribiendo..." 2 s
await bot.escribiendo(jid, 2000, 'recording')  // "grabando audio..."
await bot.presencia('available')               // 'available' | 'unavailable' | ...
```

### Editar o borrar un mensaje que el bot acaba de enviar

Los métodos de envío devuelven el mensaje enviado de Baileys, que tiene `.key`:

```js
const enviado = await msg.responder('Calculando...')
await bot.editar(enviado, '✅ Listo')

const otro = await msg.responder('Este se borrará')
await bot.borrar(otro)
```

---

## 12. 👥 Grupos

Todo en `bot.grupos`. Los participantes pueden ser **números** o **JIDs**, uno solo o un arreglo.

```js
// --- Crear y consultar
const grupo = await bot.grupos.crear('Mi grupo', ['5491111111111', '5491122222222'])
const info = await bot.grupos.info(grupoJid)               // nombre, participantes, admins...
const info2 = await bot.grupos.info(grupoJid, { forzar: true })   // salta la caché de 1 minuto
const todos = await bot.grupos.todos()                     // todos los grupos del bot { jid: metadata }

// --- Enlaces
const enlace = await bot.grupos.enlace(grupoJid)           // https://chat.whatsapp.com/XXXX
const codigo = await bot.grupos.codigo(grupoJid)
await bot.grupos.revocarEnlace(grupoJid)                   // invalida el enlace anterior
await bot.grupos.unirse('https://chat.whatsapp.com/ABC123')   // acepta enlace o código
const previo = await bot.grupos.infoInvitacion('ABC123')   // ver el grupo sin entrar
await bot.grupos.salir(grupoJid)

// --- Participantes
await bot.grupos.agregar(grupoJid, '5491133333333')
await bot.grupos.eliminar(grupoJid, ['5491133333333'])
await bot.grupos.promover(grupoJid, '5491133333333')       // hacer admin
await bot.grupos.degradar(grupoJid, '5491133333333')       // quitar admin

// --- Datos del grupo
await bot.grupos.nombre(grupoJid, 'Nuevo nombre')
await bot.grupos.descripcion(grupoJid, 'Nueva descripción')
await bot.grupos.foto(grupoJid, './foto.jpg')
await bot.grupos.quitarFoto(grupoJid)

// --- Ajustes (true = activar, false = desactivar)
await bot.grupos.soloAdminsEscriben(grupoJid, true)    // solo admins pueden escribir
await bot.grupos.soloAdminsEditan(grupoJid, true)      // solo admins editan la info
await bot.grupos.soloAdminsAgregan(grupoJid, true)     // solo admins agregan personas
await bot.grupos.efimeros(grupoJid, 86400)             // mensajes temporales: 86400 | 604800 | 7776000 | 0
await bot.grupos.aprobacion(grupoJid, true)            // aprobar nuevos miembros

// --- Solicitudes de ingreso
const pendientes = await bot.grupos.solicitudes(grupoJid)
await bot.grupos.responderSolicitudes(grupoJid, ['5491144444444'], true)    // aprobar
await bot.grupos.responderSolicitudes(grupoJid, ['5491144444444'], false)   // rechazar

// --- Admins
await bot.grupos.esAdmin(grupoJid, '5491111111111')    // ¿es admin?
await bot.grupos.botEsAdmin(grupoJid)                  // ¿el bot es admin?
await bot.grupos.admins(grupoJid)                      // lista de admins

// --- Etiqueta del bot en el grupo
await bot.grupos.etiquetaMiembro(grupoJid, 'Asistente')
```

### Bienvenida y despedida

```js
bot.on('participantes', async ({ grupo, accion, participantes }) => {
   for (const jid of participantes) {
      const numero = jid.split('@')[0]
      if (accion === 'add') {
         await bot.enviarTexto(grupo, `👋 ¡Bienvenido @${numero}!`, { menciones: [jid] })
      }
      if (accion === 'remove') {
         await bot.enviarTexto(grupo, `😢 @${numero} salió.`, { menciones: [jid] })
      }
   }
})
```

`accion` puede ser `'add'`, `'remove'`, `'promote'`, `'demote'` (u otras que envíe WhatsApp).

---

## 13. 🏘️ Comunidades

Todo en `bot.comunidades`.

```js
const comunidad = await bot.comunidades.crear('Mi comunidad', 'Descripción')
await bot.comunidades.crearGrupo('📢 Anuncios', ['5491111111111'], comunidadJid)
await bot.comunidades.vincularGrupo(grupoJid, comunidadJid)
await bot.comunidades.desvincularGrupo(grupoJid, comunidadJid)

const info = await bot.comunidades.info(comunidadJid)
const todas = await bot.comunidades.todas()
const vinculados = await bot.comunidades.gruposVinculados(comunidadJid)

const codigo = await bot.comunidades.codigo(comunidadJid)
await bot.comunidades.revocarEnlace(comunidadJid)
await bot.comunidades.unirse('ABC123')
await bot.comunidades.salir(comunidadJid)

await bot.comunidades.nombre(comunidadJid, 'Otro nombre')
await bot.comunidades.descripcion(comunidadJid, 'Otra descripción')
await bot.comunidades.soloAdminsEscriben(comunidadJid, true)
await bot.comunidades.soloAdminsEditan(comunidadJid, true)
await bot.comunidades.soloAdminsAgregan(comunidadJid, true)
await bot.comunidades.efimeros(comunidadJid, 86400)
await bot.comunidades.aprobacion(comunidadJid, true)

const pendientes = await bot.comunidades.solicitudes(comunidadJid)
await bot.comunidades.responderSolicitudes(comunidadJid, ['5491144444444'], true)
```

---

## 14. 👤 Perfil y contactos

Todo en `bot.perfil`.

```js
await bot.perfil.nombre('Mi Bot')                       // nombre de perfil
await bot.perfil.estado('Disponible 24/7')              // info/estado
await bot.perfil.cambiarFoto('./foto.jpg')
await bot.perfil.quitarFoto()

const url = await bot.perfil.fotoDe('5491112345678')    // URL de la foto (o undefined)
const miniatura = await bot.perfil.fotoDe(jid, { alta: false })

await bot.perfil.bloquear('5491112345678')
await bot.perfil.desbloquear('5491112345678')
const bloqueados = await bot.perfil.bloqueados()

const { existe, jid } = await bot.perfil.existe('5491112345678')   // ¿tiene WhatsApp?
// o directamente:
await bot.existeEnWhatsApp('5491112345678')

await bot.perfil.negocio('5491112345678')               // perfil de una cuenta Business
await bot.perfil.guardarContacto('5491112345678', 'Ana')
await bot.perfil.eliminarContacto('5491112345678')

bot.perfil.miJid()                                      // JID del propio bot
```

---

## 15. 🔐 Privacidad

Todo en `bot.privacidad`. Estos son los valores válidos:

```js
await bot.privacidad.ultimaConexion('contacts')       // 'all' | 'contacts' | 'contact_blacklist' | 'nobody'
await bot.privacidad.enLinea('match_last_seen')       // 'all' | 'match_last_seen'
await bot.privacidad.fotoPerfil('contacts')           // 'all' | 'contacts' | 'contact_blacklist' | 'none'
await bot.privacidad.estados('contacts')              // 'all' | 'contacts' | 'contact_blacklist' | 'none'
await bot.privacidad.confirmacionLectura('none')      // 'all' | 'none'
await bot.privacidad.grupos('contacts')               // 'all' | 'contacts' | 'contact_blacklist'
await bot.privacidad.mensajes('contacts')             // 'all' | 'contacts' | 'nobody'
await bot.privacidad.llamadas('everyone')             // 'everyone' | 'known'
await bot.privacidad.mensajesTemporales(86400)        // segundos (0 = desactivado)
await bot.privacidad.desactivarVistaPrevia(true)      // desactiva vistas previas de enlaces
```

> Los valores van en inglés porque son los que entiende WhatsApp. Si uno no es válido para tu versión, recibirás un error de WhatsApp.

---

## 16. 📣 Canales (newsletters)

Todo en `bot.canales`. Los canales tienen JID `xxxx@newsletter`.

```js
const canal = await bot.canales.crear('Mi canal', '📣 Novedades cada semana')

const info = await bot.canales.info('120363000000000000@newsletter')
const info2 = await bot.canales.info('https://whatsapp.com/channel/XXXXXXXX')   // también por enlace

await bot.canales.seguir(canalJid)
await bot.canales.dejarDeSeguir(canalJid)
await bot.canales.silenciar(canalJid)
await bot.canales.quitarSilencio(canalJid)

await bot.canales.nombre(canalJid, 'Otro nombre')
await bot.canales.descripcion(canalJid, 'Otra descripción')
await bot.canales.foto(canalJid, './logo.jpg')
await bot.canales.quitarFoto(canalJid)

await bot.canales.suscriptores(canalJid)
await bot.canales.cantidadAdmins(canalJid)
await bot.canales.suscritos()                  // canales que sigue el bot
await bot.canales.mensajes(canalJid, 50)       // últimos mensajes
await bot.canales.reaccionar(canalJid, '100', '💛')   // id de servidor del mensaje + emoji

await bot.canales.quitarAdmin(canalJid, '5491112345678')
await bot.canales.cambiarPropietario(canalJid, '5491112345678')
await bot.canales.eliminar(canalJid)
```

Publicar en un canal es igual que en cualquier chat (la librería corrige el envío de multimedia a canales):

```js
await bot.enviarTexto('120363000000000000@newsletter', '📣 ¡Nueva versión!')
await bot.enviarImagen('120363000000000000@newsletter', './banner.jpg', 'Novedades')
```

---

## 17. 🗣️ Esperar respuestas (conversaciones)

Para hacer preguntas paso a paso sin complicarte con estados:

```js
bot.comando('registro', async (msg) => {
   await msg.responder('¿Cómo te llamas?')
   const nombre = await msg.esperarRespuesta(30_000)
   if (!nombre) return msg.responder('⌛ Se acabó el tiempo.')

   await nombre.responder('¿Cuántos años tienes?')
   const edad = await nombre.esperarRespuesta(30_000)
   if (!edad) return nombre.responder('⌛ Se acabó el tiempo.')

   await edad.responder(`Listo ${nombre.texto}, ${edad.texto} años ✅`)
})
```

- Espera el siguiente mensaje **de la misma persona en el mismo chat**.
- Devuelve el `msg` o **`null`** si se acabó el tiempo.
- La respuesta esperada **no ejecuta comandos** (así "hola" o "!ping" como respuesta no se mezclan).

Versión avanzada con filtros:

```js
const respuesta = await bot.esperarMensaje({
   chat: msg.chat,                       // opcional
   de: msg.de,                           // opcional
   filtro: (m) => ['si', 'no'].includes(m.texto.toLowerCase()),   // opcional
   tiempo: 20_000
})
```

---

## 18. 🧰 Utilidades

```js
import {
   numeroAJid, jidANumero, normalizarJid,
   esJidGrupo, esJidCanal, esJidEstado, esJidLid,
   crearVCard, aMedia, dormir, aleatorio
} from './wa-facil/src/index.js'

numeroAJid('+54 9 11 1234-5678')       // '5491112345678@s.whatsapp.net'
jidANumero('5491112345678:5@s.whatsapp.net')   // '5491112345678'
normalizarJid('123:5@s.whatsapp.net')  // '123@s.whatsapp.net'
esJidGrupo('123@g.us')                 // true

await dormir(2000)                     // esperar 2 s
aleatorio(['a', 'b', 'c'])             // elemento al azar
```

---

## 19. 🚪 Usar la librería original (escape)

El wrapper no cubre el 100 % de la librería. Para lo demás tienes acceso directo:

```js
// Socket original de Baileys
bot.sock.sendMessage(jid, { /* cualquier contenido soportado por @itsliaaa/baileys */ })

// Enviar contenido con formato Baileys pero con las opciones del wrapper (citar, menciones...)
await bot.enviarCrudo(jid, { text: 'Hola', footer: 'pie' }, { citar: msg })

// Mensaje original de Baileys
msg.raw
```

Por ejemplo, para productos, estados o pagos, consulta el README de `@itsliaaa/baileys` y usa `bot.sock.sendMessage(...)`.

> El wrapper **no incluye** la opción `raw` de la librería ni nada pensado para manipular o dañar a otros usuarios; el propio autor de la librería indica que no debe usarse con fines de explotación.

### Otro tipo de sesión

Por defecto se usa `useMultiFileAuthState` (una carpeta con archivos). Si prefieres otro sistema de almacenamiento de sesión:

```js
import * as baileys from '@itsliaaa/baileys'

const bot = new WhatsAppBot({
   estadoAuth: async () => {
      // debe devolver { state, saveCreds }
      return await baileys.useMultiFileAuthState('otra-carpeta')
   }
})
```

### Opciones extra para el socket

```js
new WhatsAppBot({
   opcionesSocket: {
      markOnlineOnConnect: false,
      syncFullHistory: false
      // cualquier opción de makeWASocket
   }
})
```

---

## 20. 🔁 Tabla de equivalencias

| Con `wa-facil` | Con `@itsliaaa/baileys` |
|---|---|
| `msg.responder('hola')` | `sock.sendMessage(jid, { text: 'hola' }, { quoted: message })` |
| `msg.reaccionar('✨')` | `sock.sendMessage(jid, { react: { key: message.key, text: '✨' } })` |
| `bot.enviarImagen(jid, 'a.jpg', 'hola')` | `sock.sendMessage(jid, { image: { url: 'a.jpg' }, caption: 'hola' })` |
| `bot.enviarAudio(jid, 'a.mp3', { nota: true })` | `sock.sendMessage(jid, { audio: { url: 'a.mp3' }, ptt: true })` |
| `bot.enviarEncuesta(jid, 'P', ['a','b'])` | `sock.sendMessage(jid, { poll: { name: 'P', values: ['a','b'], selectableCount: 1 } })` |
| `bot.enviarBotones(jid, 't', [{ texto, id }])` | `sock.sendMessage(jid, { text: 't', buttons: [{ text, id }] })` |
| `bot.enviarInteractivo(jid, { botones })` | `sock.sendMessage(jid, { nativeFlow: [...] })` |
| `bot.enviarCarrusel(jid, 't', tarjetas)` | `sock.sendMessage(jid, { text: 't', cards: [...] })` |
| `bot.editar(msg, 'nuevo')` | `sock.sendMessage(jid, { text: 'nuevo', edit: key })` |
| `bot.borrar(msg)` | `sock.sendMessage(jid, { delete: key })` |
| `bot.fijar(msg, 86400)` | `sock.sendMessage(jid, { pin: key, time: 86400, type: 1 })` |
| `bot.grupos.promover(jid, n)` | `sock.groupParticipantsUpdate(jid, [n], 'promote')` |
| `bot.grupos.soloAdminsEscriben(jid, true)` | `sock.groupSettingUpdate(jid, 'announcement')` |
| `bot.perfil.nombre('X')` | `sock.updateProfileName('X')` |
| `bot.privacidad.ultimaConexion('nobody')` | `sock.updateLastSeenPrivacy('nobody')` |
| `await msg.descargar()` | `downloadMediaMessage(message, 'buffer', {}, { logger, reuploadRequest })` |
| Opción `ia: true` | campo `ai: true` |
| Opción `mencionarTodos: true` | campo `mentionAll: true` |
| Opción `verUnaVez: true` | campo `viewOnce: true` |
| Opción `spoiler: true` | campo `spoiler: true` |

---

## 21. 🩺 Solución de problemas

**`Cannot use import statement outside a module`**
Tu proyecto debe ser ESM. Agrega `"type": "module"` a tu `package.json` o usa la extensión `.mjs`.

**No sale el QR en consola**
Instala `npm i qrcode-terminal`, o usa `bot.on('qr', texto => ...)` y genera el QR con otra herramienta.

**El código de vinculación no aparece / falla**
- Usa solo dígitos y código de país en `numero` (sin `+`, espacios ni guiones).
- Si ya existe una sesión vinculada en la carpeta `sesion/`, no pedirá código. Borra la carpeta para vincular de nuevo.

**Se cerró la sesión (`sesionCerrada`) y no reconecta**
Es normal: desvinculaste el dispositivo (o WhatsApp lo cerró). Borra la carpeta `sesion/` y vincula otra vez.

**Aparece `sesionReemplazada`**
La misma sesión se abrió desde otro proceso. Asegúrate de tener una sola instancia ejecutándose.

**El bot no responde en el chat**
- Escríbele desde **otro** número: por defecto ignora los mensajes enviados desde su propia cuenta (`ignorarPropios: true`).
- Revisa que uses el prefijo correcto (`!ping`, no `ping`), o configura `prefijos: ['']`.
- Mira si algo falla: `bot.on('error', console.error)`.

**`soloAdmins` no detecta a un admin**
WhatsApp está migrando a identificadores LID. El wrapper compara varios campos (`id`, `lid`, `phoneNumber`), pero si algún caso no coincide, usa `await bot.grupos.info(jid, { forzar: true })` e inspecciona `participants` para ver qué identificadores recibes.

**Los botones/listas no se ven**
Los mensajes interactivos dependen de la versión de WhatsApp del que los recibe. La lista (`enviarLista`) solo funciona en chats privados.

**Los botones no ejecutan el comando**
El `id` del botón debe incluir el prefijo (`'!si'`, no `'si'`) y el comando debe estar registrado.

**El sticker no se envía**
Debe ser `.webp` (o instala `sharp` / `@napi-rs/image` para conversión automática en paquetes de stickers).

**"El bot todavía no está iniciado"**
Estás enviando antes de conectar. Espera: `await bot.iniciar(); await bot.esperarListo()`.

**Quiero ver más información interna**
`new WhatsAppBot({ nivelLog: 'debug' })` (requiere `pino`, que ya viene con Baileys).

---

## 22. ⚖️ Avisos y créditos

- **Esto no es un producto oficial de WhatsApp ni de Meta.** Baileys se conecta emulando WhatsApp Web. WhatsApp puede **suspender o bloquear números** que usen clientes no oficiales, y más aún si se envía spam, mensajes masivos o contenido no solicitado. Úsalo con responsabilidad, respeta los [términos de servicio de WhatsApp](https://www.whatsapp.com/legal/terms-of-service) y la privacidad de las personas. Prueba primero con un número que no te importe perder.
- Si publicas o redistribuyes este wrapper, **conserva los créditos** de abajo.

**Créditos de la librería base:**

- [`@itsliaaa/baileys`](https://github.com/itsliaaa/baileys) por [Lia Wynn](https://github.com/itsliaaa): fork de Baileys con soporte extra de mensajes (la librería que este wrapper envuelve).
- [Baileys (WhiskeySockets)](https://github.com/WhiskeySockets/Baileys): proyecto original, con créditos a [purpshell](https://github.com/purpshell), [jlucaso1](https://github.com/jlucaso1) y [adiwajshing](https://github.com/adiwajshing).
- Definiciones Protocol Buffer de [WPP Connect](https://github.com/wppconnect-team) vía [`wa-proto`](https://github.com/wppconnect-team/wa-proto).

`wa-facil` es solo una capa de conveniencia por encima; todo el trabajo pesado lo hacen los proyectos anteriores.

Licencia: MIT.
