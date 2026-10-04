// Ejemplo 2: sistema de comandos
import { WhatsAppBot, aleatorio } from '../src/index.js'

const bot = new WhatsAppBot({
   sesion: 'sesion',
   prefijos: ['!', '/'],                 // !ping  o  /ping
   propietarios: ['5491112345678']       // tu número, sin +
})

// --- Comando simple
bot.comando('ping', (msg) => msg.responder('🏓 pong'), {
   descripcion: 'Comprueba que el bot responde',
   categoria: 'Utilidades'
})

// --- Con argumentos:  !decir hola mundo
bot.comando('decir', async (msg, args, { texto }) => {
   if (!texto) return msg.responder('Escribe algo. Ejemplo: !decir hola')
   await msg.responder(texto)
}, { descripcion: 'Repite lo que escribas', categoria: 'Utilidades', cooldown: 5 })

// --- Con alias
bot.comando('dado', (msg) => msg.responder(`🎲 Salió: ${aleatorio([1, 2, 3, 4, 5, 6])}`), {
   alias: ['dice', 'd6'],
   descripcion: 'Tira un dado',
   categoria: 'Juegos'
})

// --- Solo en grupos y solo admins
bot.comando('todos', (msg) => msg.responder('📢 ¡Atención a todos!', { mencionarTodos: true }), {
   soloGrupos: true,
   soloAdmins: true,
   descripcion: 'Menciona a todo el grupo',
   categoria: 'Grupos'
})

// --- Conversación: el bot pregunta y espera la respuesta
bot.comando('nombre', async (msg) => {
   await msg.responder('¿Cómo te llamas?')
   const respuesta = await msg.esperarRespuesta(30_000)   // 30 s
   if (!respuesta) return msg.responder('⌛ Se acabó el tiempo.')
   await respuesta.responder(`Mucho gusto, ${respuesta.texto} 😊`)
}, { descripcion: 'Te pregunta tu nombre', categoria: 'Juegos' })

// --- Descargar una imagen que te envían (responde a una foto con !guardar)
bot.comando('guardar', async (msg) => {
   const objetivo = msg.esMultimedia ? msg : msg.citado
   if (!objetivo?.esMultimedia) return msg.responder('Envía o responde a una imagen/video con !guardar')
   const buffer = await objetivo.descargar()
   await msg.responder(`✅ Archivo descargado: ${buffer.length} bytes`)
}, { descripcion: 'Descarga el archivo de un mensaje' })

// --- Solo dueño
bot.comando('apagar', async (msg) => {
   await msg.responder('👋 Apagando...')
   bot.detener()
   process.exit(0)
}, { soloPropietario: true })

// --- Menú automático con los comandos que tienen descripción
bot.comando(['menu', 'ayuda'], (msg) => msg.responder(bot.generarMenu()), {
   descripcion: 'Muestra esta lista'
})

bot.on('comando:desconocido', (msg, nombre) => console.log('Comando desconocido:', nombre))
bot.on('error', (error, contexto) => console.error('Error en', contexto, error))

await bot.iniciar()
