// ============================================================
//  mensaje.js — Convierte un mensaje "crudo" de Baileys en un
//  objeto fácil de usar, con atajos para responder.
// ============================================================
import { writeFile } from 'node:fs/promises'
import {
   aNumero, esJidGrupo, esJidCanal, esJidEstado, jidANumero, normalizarJid
} from './utilidades.js'

// Mensajes "envoltorio": el contenido real está dentro de .message
const ENVOLTURAS = [
   'ephemeralMessage',
   'viewOnceMessage',
   'viewOnceMessageV2',
   'viewOnceMessageV2Extension',
   'documentWithCaptionMessage',
   'editedMessage',
   'lottieStickerMessage',
   'spoilerMessage'
]

// Nombre técnico de WhatsApp -> nombre simple en español
const TIPOS = {
   conversation: 'texto',
   extendedTextMessage: 'texto',
   imageMessage: 'imagen',
   videoMessage: 'video',
   audioMessage: 'audio',
   documentMessage: 'documento',
   stickerMessage: 'sticker',
   locationMessage: 'ubicacion',
   liveLocationMessage: 'ubicacion',
   contactMessage: 'contacto',
   contactsArrayMessage: 'contactos',
   pollCreationMessage: 'encuesta',
   pollCreationMessageV2: 'encuesta',
   pollCreationMessageV3: 'encuesta',
   pollUpdateMessage: 'voto',
   reactionMessage: 'reaccion',
   buttonsResponseMessage: 'respuesta_boton',
   templateButtonReplyMessage: 'respuesta_boton',
   listResponseMessage: 'respuesta_lista',
   interactiveResponseMessage: 'respuesta_interactiva',
   buttonsMessage: 'botones',
   listMessage: 'lista',
   interactiveMessage: 'interactivo',
   eventMessage: 'evento',
   groupInviteMessage: 'invitacion_grupo',
   productMessage: 'producto',
   protocolMessage: 'protocolo'
}

const TIPOS_MULTIMEDIA = ['imagen', 'video', 'audio', 'documento', 'sticker']
const IGNORAR = ['messageContextInfo', 'senderKeyDistributionMessage']

/** Quita las envolturas y devuelve { contenido, editado } */
export function desenvolver(mensaje) {
   let contenido = mensaje ?? {}
   let editado = false
   for (let i = 0; i < 6; i++) {
      if (contenido.protocolMessage?.editedMessage) {
         contenido = contenido.protocolMessage.editedMessage
         editado = true
         continue
      }
      const clave = ENVOLTURAS.find((k) => contenido[k]?.message)
      if (!clave) break
      if (clave === 'editedMessage') editado = true
      contenido = contenido[clave].message
   }
   return { contenido, editado }
}

function detectarTipo(contenido) {
   const claves = Object.keys(contenido).filter((k) => !IGNORAR.includes(k))
   const tipoRaw = claves.find((k) => TIPOS[k]) ?? claves[0]
   return { tipoRaw, tipo: TIPOS[tipoRaw] ?? (tipoRaw ? 'otro' : 'desconocido') }
}

function extraerTexto(contenido, tipoRaw) {
   const m = contenido?.[tipoRaw]
   if (m === undefined || m === null) return ''
   switch (tipoRaw) {
      case 'conversation': return m
      case 'extendedTextMessage': return m.text ?? ''
      case 'imageMessage':
      case 'videoMessage':
      case 'documentMessage': return m.caption ?? ''
      case 'buttonsResponseMessage': return m.selectedButtonId ?? ''
      case 'listResponseMessage': return m.singleSelectReply?.selectedRowId ?? ''
      case 'templateButtonReplyMessage': return m.selectedId ?? ''
      case 'interactiveResponseMessage':
         try {
            return JSON.parse(m.nativeFlowResponseMessage?.paramsJson || '{}').id ?? ''
         } catch {
            return ''
         }
      default: return ''
   }
}

export class Mensaje {
   /**
    * @param {import('./bot.js').WhatsAppBot} bot
    * @param {object} raw Mensaje crudo de Baileys (WAMessage)
    */
   constructor(bot, raw) {
      this.bot = bot
      this.raw = raw
      this.key = raw.key

      // --- Identificadores
      this.id = raw.key.id
      this.chat = raw.key.remoteJid
      this.esGrupo = esJidGrupo(this.chat)
      this.esCanal = esJidCanal(this.chat)
      this.esEstado = esJidEstado(this.chat)
      this.esPrivado = !this.esGrupo && !this.esCanal && !this.esEstado
      this.esMia = Boolean(raw.key.fromMe)

      // --- Quién lo envió
      const miId = bot.sock?.user?.id
      this.de = this.esMia && miId ? normalizarJid(miId) : (raw.key.participant || raw.key.remoteJid)
      this.deAlt = raw.key.participantAlt || raw.key.remoteJidAlt || null
      const pn = [this.de, this.deAlt].find((j) => j && String(j).endsWith('@s.whatsapp.net'))
      this.numero = jidANumero(pn ?? this.de) // mejor intento de obtener el teléfono
      this.nombre = raw.pushName ?? null
      this.fecha = new Date(aNumero(raw.messageTimestamp) * 1000)

      // --- Contenido
      const { contenido, editado } = desenvolver(raw.message)
      this.contenido = contenido
      this.editado = editado
      const { tipo, tipoRaw } = detectarTipo(contenido)
      this.tipo = tipo
      this.tipoRaw = tipoRaw
      this.texto = extraerTexto(contenido, tipoRaw)
      this.esMultimedia = TIPOS_MULTIMEDIA.includes(tipo)

      const interno = contenido?.[tipoRaw]
      const ctx = interno && typeof interno === 'object' ? interno.contextInfo : undefined
      this.contextInfo = ctx ?? null
      this.menciones = ctx?.mentionedJid ?? []
      this.citado = ctx?.quotedMessage ? this._crearCitado(ctx) : null

      // --- Datos extra según el tipo
      this.mimetype = interno?.mimetype
      this.nombreArchivo = interno?.fileName
      this.ubicacion = tipo === 'ubicacion'
         ? { lat: interno.degreesLatitude, lng: interno.degreesLongitude, nombre: interno.name }
         : undefined
      this.reaccion = tipo === 'reaccion'
         ? { emoji: interno.text, mensajeId: interno.key?.id }
         : undefined
   }

   _crearCitado(ctx) {
      const { contenido } = desenvolver(ctx.quotedMessage)
      const { tipo, tipoRaw } = detectarTipo(contenido)
      const de = ctx.participant || this.chat
      const falso = {
         key: {
            remoteJid: this.chat,
            id: ctx.stanzaId,
            participant: ctx.participant,
            fromMe: normalizarJid(de) === normalizarJid(this.bot.sock?.user?.id ?? '')
         },
         message: ctx.quotedMessage
      }
      return {
         id: ctx.stanzaId,
         de,
         tipo,
         texto: extraerTexto(contenido, tipoRaw),
         esMultimedia: TIPOS_MULTIMEDIA.includes(tipo),
         raw: falso,
         descargar: () => this.bot._descargar(falso)
      }
   }

   // ---------- Información ----------

   /** ¿El que escribió es admin del grupo? */
   async esAdmin() {
      if (!this.esGrupo) return false
      return this.bot.grupos.esAdmin(this.chat, this.de, this.deAlt)
   }

   /** ¿El bot es admin de este grupo? */
   async botEsAdmin() {
      if (!this.esGrupo) return false
      return this.bot.grupos.botEsAdmin(this.chat)
   }

   /** Información del grupo (nombre, participantes, etc.) */
   async grupo() {
      return this.esGrupo ? this.bot.grupos.info(this.chat) : null
   }

   // ---------- Responder ----------

   /** Responde citando el mensaje. Acepta texto o un objeto de contenido de Baileys */
   responder(contenido, opciones = {}) {
      return this.bot.responder(this, contenido, opciones)
   }

   /** Envía un texto al mismo chat SIN citar */
   enviar(texto, opciones = {}) {
      return this.bot.enviarTexto(this.chat, texto, opciones)
   }

   responderImagen(fuente, leyenda = '', op = {}) {
      return this.bot.enviarImagen(this.chat, fuente, leyenda, { ...op, citar: this })
   }

   responderVideo(fuente, leyenda = '', op = {}) {
      return this.bot.enviarVideo(this.chat, fuente, leyenda, { ...op, citar: this })
   }

   responderAudio(fuente, op = {}) {
      return this.bot.enviarAudio(this.chat, fuente, { ...op, citar: this })
   }

   responderDocumento(fuente, op = {}) {
      return this.bot.enviarDocumento(this.chat, fuente, { ...op, citar: this })
   }

   responderSticker(fuente, op = {}) {
      return this.bot.enviarSticker(this.chat, fuente, { ...op, citar: this })
   }

   responderBotones(texto, botones, op = {}) {
      return this.bot.enviarBotones(this.chat, texto, botones, { ...op, citar: this })
   }

   responderLista(config, op = {}) {
      return this.bot.enviarLista(this.chat, config, { ...op, citar: this })
   }

   responderEncuesta(pregunta, opciones, op = {}) {
      return this.bot.enviarEncuesta(this.chat, pregunta, opciones, { ...op, citar: this })
   }

   /** Reacciona al mensaje con un emoji (usa '' para quitar la reacción) */
   reaccionar(emoji) {
      return this.bot.reaccionar(this, emoji)
   }

   /** Edita este mensaje (solo funciona si lo envió el bot) */
   editar(nuevoTexto) {
      return this.bot.editar(this, nuevoTexto)
   }

   /** Borra este mensaje (para todos, si es del bot o el bot es admin) */
   borrar() {
      return this.bot.borrar(this)
   }

   /** Marca el mensaje como leído (doble check azul) */
   leer() {
      return this.bot.leer(this)
   }

   /** Muestra "escribiendo..." durante `ms` milisegundos */
   escribiendo(ms = 1500) {
      return this.bot.escribiendo(this.chat, ms)
   }

   /** Espera el siguiente mensaje de esta misma persona en este mismo chat */
   esperarRespuesta(tiempo = 60000) {
      return this.bot.esperarMensaje({ chat: this.chat, de: this.de, tiempo })
   }

   // ---------- Archivos ----------

   /** Descarga la imagen/video/audio/documento/sticker y devuelve un Buffer */
   async descargar() {
      if (!this.esMultimedia) {
         throw new Error(`Este mensaje es de tipo "${this.tipo}" y no tiene archivo para descargar.`)
      }
      return this.bot._descargar(this.raw)
   }

   /** Descarga el archivo y lo guarda en `ruta` */
   async guardar(ruta) {
      const buffer = await this.descargar()
      await writeFile(ruta, buffer)
      return ruta
   }
}
