// Ejemplo 4: administración de grupos + bienvenida
import { WhatsAppBot } from '../src/index.js'

const bot = new WhatsAppBot({ sesion: 'sesion', prefijos: ['!'] })

// Bienvenida / despedida automática
bot.on('participantes', async ({ grupo, accion, participantes }) => {
   for (const jid of participantes) {
      const numero = jid.split('@')[0]
      if (accion === 'add') {
         await bot.enviarTexto(grupo, `👋 ¡Bienvenido @${numero}!`, { menciones: [jid] })
      } else if (accion === 'remove') {
         await bot.enviarTexto(grupo, `😢 @${numero} salió del grupo.`, { menciones: [jid] })
      }
   }
})

// !expulsar (respondiendo a un mensaje o mencionando)
bot.comando('expulsar', async (msg) => {
   const objetivo = msg.menciones[0] ?? msg.citado?.de
   if (!objetivo) return msg.responder('Menciona o responde al mensaje de la persona.')
   await bot.grupos.eliminar(msg.chat, objetivo)
   await msg.reaccionar('✅')
}, { soloGrupos: true, soloAdmins: true, botAdmin: true, descripcion: 'Expulsa a alguien' })

// !admin / !quitaradmin
bot.comando('admin', async (msg) => {
   const objetivo = msg.menciones[0] ?? msg.citado?.de
   if (!objetivo) return msg.responder('Menciona a alguien.')
   await bot.grupos.promover(msg.chat, objetivo)
   await msg.reaccionar('⭐')
}, { soloGrupos: true, soloAdmins: true, botAdmin: true })

bot.comando('quitaradmin', async (msg) => {
   const objetivo = msg.menciones[0] ?? msg.citado?.de
   if (!objetivo) return msg.responder('Menciona a alguien.')
   await bot.grupos.degradar(msg.chat, objetivo)
   await msg.reaccionar('✅')
}, { soloGrupos: true, soloAdmins: true, botAdmin: true })

// !cerrar / !abrir  -> solo admins escriben / todos escriben
bot.comando('cerrar', async (msg) => { await bot.grupos.soloAdminsEscriben(msg.chat, true); await msg.responder('🔒 Grupo cerrado') },
   { soloGrupos: true, soloAdmins: true, botAdmin: true })
bot.comando('abrir', async (msg) => { await bot.grupos.soloAdminsEscriben(msg.chat, false); await msg.responder('🔓 Grupo abierto') },
   { soloGrupos: true, soloAdmins: true, botAdmin: true })

// !enlace
bot.comando('enlace', async (msg) => msg.responder(await bot.grupos.enlace(msg.chat)),
   { soloGrupos: true, soloAdmins: true, botAdmin: true })

// !info
bot.comando('info', async (msg) => {
   const g = await msg.grupo()
   const admins = g.participants.filter((p) => p.admin).length
   await msg.responder(`👥 *${g.subject}*\nMiembros: ${g.participants.length}\nAdmins: ${admins}`)
}, { soloGrupos: true })

await bot.iniciar()
