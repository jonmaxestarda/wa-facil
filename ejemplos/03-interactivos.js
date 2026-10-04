// Ejemplo 3: botones, listas, encuestas, ubicación, contactos...
import { WhatsAppBot } from '../src/index.js'

const bot = new WhatsAppBot({ sesion: 'sesion', prefijos: ['!'] })

// Los botones envían su `id` como si el usuario lo hubiera escrito.
// Por eso un botón con id '!si' ejecuta el comando "si".
bot.comando('botones', (msg) => msg.responderBotones('¿Te gusta este bot?', [
   { texto: '👍 Sí', id: '!si' },
   { texto: '👎 No', id: '!no' }
], { pie: 'wa-facil' }))

bot.comando('si', (msg) => msg.responder('¡Gracias! 💛'))
bot.comando('no', (msg) => msg.responder('Lo vamos a mejorar 🛠️'))

// Lista desplegable (solo chats privados)
bot.comando('lista', (msg) => msg.responderLista({
   texto: 'Elige una opción',
   titulo: '📋 Menú',
   botonTexto: 'Ver opciones',
   pie: 'wa-facil',
   secciones: [
      { titulo: 'Juegos', filas: [{ titulo: 'Dado', descripcion: 'Tira un dado', id: '!dado' }] },
      { titulo: 'Utilidades', filas: [{ titulo: 'Ping', descripcion: 'Prueba el bot', id: '!ping' }] }
   ]
}))
bot.comando('ping', (msg) => msg.responder('pong'))

// Mensaje interactivo con varios tipos de botón
bot.comando('interactivo', (msg) => bot.enviarInteractivo(msg.chat, {
   texto: '🗄️ Mensaje interactivo',
   pie: 'wa-facil',
   botones: [
      { texto: '👋 Saludar', id: '!si' },
      { texto: '🌐 Web', url: 'https://www.npmjs.com/package/@itsliaaa/baileys' },
      { texto: '📋 Copiar', copiar: 'CODIGO-123' },
      { texto: '📞 Llamar', llamar: '5491112345678' }
   ]
}, { citar: msg }))

// Encuesta
bot.comando('encuesta', (msg) => msg.responderEncuesta('¿Cuál es tu lenguaje favorito?', ['JavaScript', 'Python', 'Rust'], { maxSelecciones: 1 }))

// Ubicación y contacto
bot.comando('ubicacion', (msg) => bot.enviarUbicacion(msg.chat, -34.6037, -58.3816, 'Obelisco, Buenos Aires', { citar: msg }))
bot.comando('contacto', (msg) => bot.enviarContacto(msg.chat, { nombre: 'Mi Bot', numero: '5491112345678' }, { citar: msg }))

// Tabla y código
bot.comando('tabla', (msg) => bot.enviarTabla(msg.chat, {
   titulo: 'Comparación',
   cabecera: '## Node.js vs Bun vs Deno',
   filas: [['', 'Node.js', 'Bun', 'Deno'], ['Motor', 'V8', 'JavaScriptCore', 'V8'], ['Rendimiento', '4/5', '5/5', '4/5']]
}, { citar: msg }))

bot.comando('codigo', (msg) => bot.enviarCodigo(msg.chat, {
   cabecera: '## Ejemplo',
   lenguaje: 'javascript',
   codigo: 'console.log("Hola, mundo!")'
}, { citar: msg }))

// Imagen / documento desde una ruta o URL
bot.comando('imagen', (msg) => msg.responderImagen('./ejemplos/foto.jpg', '📷 Mi foto'))
bot.comando('documento', (msg) => msg.responderDocumento('./ejemplos/manual.pdf', { nombre: 'Manual.pdf', leyenda: '📄 Aquí está' }))

await bot.iniciar()
