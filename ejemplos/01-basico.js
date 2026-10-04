// Ejemplo 1: el bot más simple posible
// Ejecuta:  node ejemplos/01-basico.js
import { WhatsAppBot } from '../src/index.js'

const bot = new WhatsAppBot({
   sesion: 'sesion',   // carpeta donde se guarda la sesión
   modo: 'qr'          // o: modo: 'codigo', numero: '5491112345678'
})

bot.on('listo', (yo) => console.log('Bot listo como', yo.jid))

// Se ejecuta con CADA mensaje recibido
bot.on('mensaje', async (msg) => {
   console.log(`${msg.nombre ?? msg.numero}: ${msg.texto || '[' + msg.tipo + ']'}`)

   if (msg.texto.toLowerCase() === 'hola') {
      await msg.escribiendo(1000)                 // "escribiendo..."
      await msg.responder(`¡Hola ${msg.nombre ?? ''}! 👋`)
      await msg.reaccionar('👋')
   }
})

await bot.iniciar()
