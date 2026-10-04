// ============================================================
//  bot.js — Clase principal WhatsAppBot
// ============================================================
import { EventEmitter } from 'node:events'
import * as B from '@itsliaaa/baileys'
import { Mensaje } from './mensaje.js'
import { Grupos, Comunidades, Perfil, Privacidad, Canales } from './modulos.js'
import {
   dormir, aJid, aMedia, idBase, limpiar, normalizarJid, formatearCodigo, adivinarMime,
   crearVCard, convertirSecciones, convertirBotonNativo
} from './utilidades.js'

const makeWASocket = B.makeWASocket ?? B.default

// Logger que no imprime nada (Baileys necesita un objeto con estos métodos)
const SILENCIOSO = {
   level: 'silent',
   child() { return SILENCIOSO },
   trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {}
}

async function crearLogger(nivel) {
   if (nivel === 'silent') return SILENCIOSO
   try {
      const modulo = await import('pino')
      return (modulo.default ?? modulo)({ level: nivel })
   } catch {
      return SILENCIOSO
   }
}

const DEFECTO = {
   sesion: 'sesion',               // carpeta donde se guarda la sesión
   modo: 'qr',                     // 'qr' o 'codigo'
   numero: null,                   // necesario si modo === 'codigo'
   codigoPersonalizado: null,      // opcional: 8 letras/números para el código
   prefijos: ['!', '/', '.'],      // prefijos de comandos ('' = sin prefijo)
   propietarios: [],               // números con permisos de dueño
   ignorarPropios: true,           // ignorar mensajes enviados por el propio bot
   incluirEstados: false,          // procesar estados (status@broadcast)
   procesarHistorial: false,       // procesar mensajes antiguos al conectar
   ignorarMayusculas: true,        // !PING == !ping
   marcarEnLinea: false,           // aparecer "en línea" al conectar
   mostrarQR: true,                // imprimir el QR en consola (requiere qrcode-terminal)
   logs: true,                     // mensajes amigables en consola
   nivelLog: 'silent',             // nivel del logger interno de Baileys
   reconectar: true,
   maxReintentos: Infinity,
   esperaReconexion: 2000,         // ms (crece en cada intento, máx. 30 s)
   rechazarLlamadas: false,
   avisarErrores: true,            // responde "Ocurrió un error" si un comando falla
   opcionesSocket: {},             // se mezclan con la config de makeWASocket
   estadoAuth: null,               // función async que devuelve { state, saveCreds }
   mensajes: {
      soloGrupos: '⚠️ Este comando solo funciona en grupos.',
      soloPrivado: '⚠️ Este comando solo funciona en chats privados.',
      soloAdmins: '⚠️ Solo los administradores del grupo pueden usar este comando.',
      botNoAdmin: '⚠️ Necesito ser administrador del grupo para hacer eso.',
      soloPropietario: '⚠️ Este comando es solo para el propietario del bot.',
      espera: (segundos) => `⏳ Espera ${segundos}s antes de usar este comando otra vez.`,
      error: '❌ Ocurrió un error al ejecutar el comando.'
   }
}

export class WhatsAppBot extends EventEmitter {
   /**
    * @param {Partial<typeof DEFECTO>} opciones
    */
   constructor(opciones = {}) {
      super()
      this.opts = {
         ...DEFECTO,
         ...opciones,
         mensajes: { ...DEFECTO.mensajes, ...(opciones.mensajes ?? {}) }
      }
      this.opts.prefijos = [].concat(this.opts.prefijos)

      if (this.opts.modo === 'codigo' && !this.opts.numero) {
         throw new Error('Con modo "codigo" debes indicar tu número: new WhatsAppBot({ modo: "codigo", numero: "5491112345678" })')
      }

      this._sock = null
      this.conectado = false
      this._detenido = true
      this._intentos = 0
      this._comandos = new Map()
      this._cooldowns = new Map()
      this._esperas = new Set()
      this._esperandoListo = []
      this._escuchasCrudas = []

      this.grupos = new Grupos(this)
      this.comunidades = new Comunidades(this)
      this.perfil = new Perfil(this)
      this.privacidad = new Privacidad(this)
      this.canales = new Canales(this)
   }

   // ============================================================
   //  Acceso interno
   // ============================================================

   /** Socket original de Baileys (para usar funciones que el wrapper no cubre) */
   get sock() { return this._sock }

   _s() {
      if (!this._sock) {
         throw new Error('El bot todavía no está iniciado. Llama a `await bot.iniciar()` y espera el evento "listo".')
      }
      return this._sock
   }

   /** Datos del bot: { jid, lid, nombre } */
   get yo() {
      const u = this._sock?.user
      if (!u) return null
      return {
         jid: normalizarJid(u.id),
         lid: u.lid ? normalizarJid(u.lid) : null,
         nombre: u.name ?? null
      }
   }

   _log(...args) { if (this.opts.logs) console.log(...args) }

   _error(error, contexto) {
      if (this.listenerCount('error') > 0) this.emit('error', error, contexto)
      else console.error(`❌ [wa-facil${contexto ? ':' + contexto : ''}]`, error)
   }

   // ============================================================
   //  Conexión
   // ============================================================

   /** Inicia la conexión con WhatsApp. */
   async iniciar() {
      if (!this._detenido) return this
      this._detenido = false
      await this._conectar()
      return this
   }

   /** Promesa que se cumple cuando el bot está conectado */
   esperarListo() {
      if (this.conectado) return Promise.resolve(this.yo)
      return new Promise((resolve) => this._esperandoListo.push(resolve))
   }

   /** Cierra la conexión pero conserva la sesión (podrás volver a iniciar) */
   detener() {
      this._detenido = true
      this.conectado = false
      try { this._sock?.end?.(undefined) } catch { /* ya estaba cerrado */ }
   }

   /** Cierra la sesión en WhatsApp (el dispositivo se desvincula; tendrás que volver a vincular) */
   async cerrarSesion() {
      this._detenido = true
      await this._s().logout()
      this.conectado = false
   }

   async _conectar() {
      const logger = await crearLogger(this.opts.nivelLog)
      this.logger = logger

      let state, saveCreds, keys
      if (this.opts.estadoAuth) {
         ;({ state, saveCreds } = await this.opts.estadoAuth())
         keys = state.keys
      } else {
         ;({ state, saveCreds } = await B.useMultiFileAuthState(this.opts.sesion))
         keys = B.makeCacheableSignalKeyStore ? B.makeCacheableSignalKeyStore(state.keys, logger) : state.keys
      }

      const config = {
         logger,
         auth: { creds: state.creds, keys },
         markOnlineOnConnect: this.opts.marcarEnLinea,
         syncFullHistory: false,
         cachedGroupMetadata: async (jid) => this.grupos.cacheado(jid),
         ...this.opts.opcionesSocket
      }

      const sock = makeWASocket(config)
      this._sock = sock
      this._registrarEventos(sock, saveCreds)
   }

   _registrarEventos(sock, saveCreds) {
      let codigoPedido = false

      sock.ev.on('creds.update', saveCreds)

      sock.ev.on('connection.update', async (update) => {
         const { connection, lastDisconnect, qr } = update
         this.emit('conexion', update)

         // --- QR
         if (qr && this.opts.modo === 'qr') {
            this.emit('qr', qr)
            if (this.opts.mostrarQR) await this._imprimirQR(qr)
         }

         // --- Código de vinculación
         if (connection === 'connecting' && this.opts.modo === 'codigo'
            && !sock.authState?.creds?.registered && !codigoPedido) {
            codigoPedido = true
            try {
               await dormir(1500)
               const numero = String(this.opts.numero).replace(/\D/g, '')
               const codigo = this.opts.codigoPersonalizado
                  ? await sock.requestPairingCode(numero, this.opts.codigoPersonalizado)
                  : await sock.requestPairingCode(numero)
               const bonito = formatearCodigo(codigo)
               this.emit('codigo', bonito)
               this._log(`🔗 Código de vinculación: ${bonito}`)
               this._log('   WhatsApp > Dispositivos vinculados > Vincular con número de teléfono')
            } catch (e) {
               this._error(e, 'codigo')
            }
         }

         // --- Conectado
         if (connection === 'open') {
            this.conectado = true
            this._intentos = 0
            const yo = this.yo
            this._log(`✅ Conectado a WhatsApp${yo?.nombre ? ' como ' + yo.nombre : ''}`)
            this.emit('listo', yo)
            for (const resolver of this._esperandoListo.splice(0)) resolver(yo)
         }

         // --- Desconectado
         if (connection === 'close') {
            this.conectado = false
            const codigo = lastDisconnect?.error?.output?.statusCode
            const razon = lastDisconnect?.error?.message ?? 'desconocida'
            await this._alCerrar(codigo, razon)
         }
      })

      sock.ev.on('messages.upsert', ({ messages, type }) => {
         if (type !== 'notify' && !this.opts.procesarHistorial) return
         for (const raw of messages) {
            this._procesarMensaje(raw).catch((e) => this._error(e, 'mensaje'))
         }
      })

      sock.ev.on('group-participants.update', (evento) => {
         this.grupos.invalidar(evento.id)
         const ids = (evento.participants ?? []).map((p) => (typeof p === 'string' ? p : p.id))
         this.emit('participantes', {
            grupo: evento.id,
            accion: evento.action,   // 'add' | 'remove' | 'promote' | 'demote' | ...
            participantes: ids,
            autor: evento.author,
            raw: evento
         })
      })

      sock.ev.on('groups.update', (actualizaciones) => {
         for (const g of actualizaciones) {
            if (g.id) this.grupos.invalidar(g.id)
            this.emit('grupo:actualizado', g)
         }
      })

      sock.ev.on('messages.reaction', (reacciones) => {
         for (const r of reacciones) {
            this.emit('reaccion', {
               chat: r.key?.remoteJid,
               mensajeId: r.key?.id,
               emoji: r.reaction?.text ?? '',
               de: r.reaction?.key?.participant ?? r.reaction?.key?.remoteJid,
               raw: r
            })
         }
      })

      sock.ev.on('messages.update', (u) => this.emit('mensaje:actualizado', u))
      sock.ev.on('presence.update', (u) => this.emit('presencia', u))

      sock.ev.on('call', (llamadas) => {
         for (const c of llamadas) {
            this.emit('llamada', {
               id: c.id, de: c.from, estado: c.status,
               esVideo: Boolean(c.isVideo), esGrupo: Boolean(c.isGroup), raw: c
            })
            if (this.opts.rechazarLlamadas && c.status === 'offer') {
               sock.rejectCall?.(c.id, c.from).catch((e) => this._error(e, 'llamada'))
            }
         }
      })

      // Eventos crudos registrados con bot.escucharCrudo()
      for (const [evento, fn] of this._escuchasCrudas) sock.ev.on(evento, fn)
   }

   async _alCerrar(codigo, razon) {
      const DR = B.DisconnectReason ?? {}
      const cerroSesion = codigo === DR.loggedOut
      const reemplazada = codigo === DR.connectionReplaced
      const reconectara = this.opts.reconectar && !this._detenido && !cerroSesion && !reemplazada

      this._log(`⚠️ Conexión cerrada (código ${codigo ?? '?'}: ${razon})${reconectara ? ', reconectando...' : ''}`)
      this.emit('cerrado', { codigo, razon, reconectara })

      try { this._sock?.ev?.removeAllListeners?.() } catch { /* nada */ }

      if (cerroSesion) {
         this._log('🚪 La sesión fue cerrada desde el teléfono. Borra la carpeta de sesión y vuelve a vincular.')
         this.emit('sesionCerrada')
         return
      }
      if (reemplazada) {
         this._log('⚠️ La sesión se abrió en otro lugar. No se reconectará.')
         this.emit('sesionReemplazada')
         return
      }
      if (!reconectara) return

      if (this._intentos >= this.opts.maxReintentos) {
         this._error(new Error('Se alcanzó el máximo de reintentos de conexión.'), 'conexion')
         return
      }

      const reinicio = codigo === DR.restartRequired // normal justo después de vincular
      const espera = reinicio ? 0 : Math.min(this.opts.esperaReconexion * 2 ** Math.min(this._intentos, 5), 30_000)
      this._intentos++
      this.emit('reconectando', { intento: this._intentos, espera })
      if (espera) await dormir(espera)

      try {
         await this._conectar()
      } catch (e) {
         this._error(e, 'reconexion')
         await this._alCerrar(undefined, e.message)
      }
   }

   async _imprimirQR(qr) {
      try {
         const modulo = await import('qrcode-terminal')
         ;(modulo.default ?? modulo).generate(qr, { small: true })
         this._log('📱 Escanea el QR: WhatsApp > Dispositivos vinculados > Vincular un dispositivo')
      } catch {
         this._log('📱 Para ver el QR en consola instala: npm i qrcode-terminal (o usa bot.on("qr", texto => ...))')
      }
   }

   /**
    * Escucha un evento "crudo" de Baileys (por ejemplo 'messages.update').
    * Sobrevive a las reconexiones.
    */
   escucharCrudo(evento, funcion) {
      this._escuchasCrudas.push([evento, funcion])
      this._sock?.ev.on(evento, funcion)
      return this
   }

   // ============================================================
   //  Procesar mensajes entrantes
   // ============================================================

   async _procesarMensaje(raw) {
      if (!raw?.message || !raw.key?.remoteJid) return
      if (raw.key.remoteJid === 'status@broadcast' && !this.opts.incluirEstados) return
      if (raw.key.fromMe && this.opts.ignorarPropios) return

      const msg = new Mensaje(this, raw)

      // Mensaje eliminado por alguien
      if (msg.tipo === 'protocolo') {
         const p = msg.contenido.protocolMessage
         if (p?.type === 0 || p?.type === 'REVOKE') {
            this.emit('mensaje:eliminado', { chat: msg.chat, id: p.key?.id, de: msg.de })
         }
         return
      }
      if (msg.tipo === 'desconocido') return

      // ¿Alguien estaba esperando esta respuesta?
      for (const espera of this._esperas) {
         const okChat = !espera.chat || espera.chat === msg.chat
         const okDe = !espera.de || [msg.de, msg.deAlt].filter(Boolean).some((j) => idBase(j) === idBase(espera.de))
         if (okChat && okDe && (!espera.filtro || espera.filtro(msg))) {
            clearTimeout(espera.timer)
            this._esperas.delete(espera)
            espera.resolve(msg)
            return // la respuesta esperada no dispara comandos
         }
      }

      this.emit('mensaje', msg)
      this.emit(msg.esGrupo ? 'mensaje:grupo' : 'mensaje:privado', msg)

      await this._despacharComando(msg)
   }

   /**
    * Espera el próximo mensaje que cumpla las condiciones.
    * Devuelve el Mensaje o `null` si pasó el tiempo.
    *   await bot.esperarMensaje({ chat, de, filtro: (m) => m.texto === 'si', tiempo: 30000 })
    */
   esperarMensaje({ chat, de, filtro, tiempo = 60_000 } = {}) {
      return new Promise((resolve) => {
         const espera = { chat, de, filtro, resolve }
         espera.timer = setTimeout(() => {
            this._esperas.delete(espera)
            resolve(null)
         }, tiempo)
         this._esperas.add(espera)
      })
   }

   // ============================================================
   //  Comandos
   // ============================================================

   _norm(nombre) {
      const n = String(nombre).trim()
      return this.opts.ignorarMayusculas ? n.toLowerCase() : n
   }

   /**
    * Registra un comando.
    *   bot.comando('ping', (msg, args) => msg.responder('pong'))
    *   bot.comando(['hola', 'hi'], handler, { descripcion: 'Saluda', cooldown: 5 })
    *
    * Opciones: alias[], descripcion, categoria, soloGrupos, soloPrivado,
    *           soloAdmins, botAdmin, soloPropietario, cooldown (segundos)
    */
   comando(nombres, handler, opciones = {}) {
      if (typeof handler !== 'function') throw new Error('El comando necesita una función: bot.comando("nombre", async (msg, args) => {...})')
      const lista = [...[].concat(nombres), ...(opciones.alias ?? [])].map((n) => this._norm(n))
      const def = { ...opciones, nombre: lista[0], alias: lista.slice(1), handler }
      for (const n of lista) this._comandos.set(n, def)
      return this
   }

   /** Lista de comandos registrados (sin duplicados por alias) */
   get comandos() { return [...new Set(this._comandos.values())] }

   /**
    * Genera un texto de menú con todos los comandos que tengan `descripcion`.
    */
   generarMenu({ titulo = '📋 *Comandos disponibles*', prefijo = this.opts.prefijos[0] ?? '' } = {}) {
      const porCategoria = new Map()
      for (const c of this.comandos) {
         if (!c.descripcion) continue
         const cat = c.categoria ?? 'General'
         if (!porCategoria.has(cat)) porCategoria.set(cat, [])
         porCategoria.get(cat).push(c)
      }
      const bloques = [titulo]
      for (const [cat, lista] of porCategoria) {
         bloques.push(`\n*${cat}*`)
         for (const c of lista) bloques.push(`• ${prefijo}${c.nombre} — ${c.descripcion}`)
      }
      return bloques.join('\n')
   }

   _esPropietario(msg) {
      const dueños = this.opts.propietarios.map(idBase)
      return [msg.de, msg.deAlt, msg.numero].filter(Boolean).some((j) => dueños.includes(idBase(j))) || msg.esMia
   }

   async _despacharComando(msg) {
      const texto = (msg.texto ?? '').trim()
      if (!texto) return

      const prefijo = this.opts.prefijos.find((p) => texto.startsWith(p))
      if (prefijo === undefined) return

      const resto = texto.slice(prefijo.length).trim()
      if (!resto) return
      const [palabra, ...args] = resto.split(/\s+/)
      const clave = this._norm(palabra)
      const def = this._comandos.get(clave)
      if (!def) {
         if (prefijo !== '') this.emit('comando:desconocido', msg, clave)
         return
      }

      const m = this.opts.mensajes
      const info = { bot: this, prefijo, comando: def.nombre, texto: args.join(' ') }

      // --- Restricciones
      if (def.soloGrupos && !msg.esGrupo) return msg.responder(m.soloGrupos)
      if (def.soloPrivado && !msg.esPrivado) return msg.responder(m.soloPrivado)
      if (def.soloPropietario && !this._esPropietario(msg)) return msg.responder(m.soloPropietario)
      if (def.soloAdmins && msg.esGrupo && !(await msg.esAdmin()) && !this._esPropietario(msg)) {
         return msg.responder(m.soloAdmins)
      }
      if (def.botAdmin && msg.esGrupo && !(await msg.botEsAdmin())) return msg.responder(m.botNoAdmin)

      // --- Cooldown
      if (def.cooldown) {
         const k = `${def.nombre}:${idBase(msg.de)}`
         const ultimo = this._cooldowns.get(k) ?? 0
         const restante = Math.ceil((ultimo + def.cooldown * 1000 - Date.now()) / 1000)
         if (restante > 0) return msg.responder(m.espera(restante))
         this._cooldowns.set(k, Date.now())
      }

      this.emit('comando', msg, info)
      try {
         await def.handler(msg, args, info)
      } catch (e) {
         this._error(e, `comando:${def.nombre}`)
         if (this.opts.avisarErrores) {
            await msg.responder(m.error).catch(() => {})
         }
      }
   }

   // ============================================================
   //  Enviar mensajes
   // ============================================================

   /** Aplica opciones comunes (menciones, ia, spoiler...) al contenido */
   _contenido(contenido, op = {}) {
      const c = { ...contenido }
      if (op.menciones?.length) c.mentions = op.menciones.map(aJid)
      if (op.mencionarTodos) c.mentionAll = true
      if (op.ia) c.ai = true
      if (op.efimero) c.ephemeral = true
      if (op.verUnaVez) c.viewOnce = true
      if (op.verUnaVezV2) c.viewOnceV2 = true
      if (op.spoiler) c.spoiler = true
      if (op.etiquetaMeta) c.secureMetaServiceLabel = true
      if (op.grupoEstado) c.groupStatus = true
      if (op.anuncio) {
         c.externalAdReply = limpiar({
            title: op.anuncio.titulo,
            body: op.anuncio.texto,
            thumbnail: op.anuncio.miniatura,
            largeThumbnail: op.anuncio.grande,
            url: op.anuncio.url
         })
      }
      if (op.vistaPrevia) {
         const v = op.vistaPrevia
         c.linkPreview = limpiar({
            'matched-text': v.url,
            title: v.titulo,
            description: v.descripcion,
            previewType: 0,
            jpegThumbnail: v.miniatura
         })
      }
      return c
   }

   /** Envía contenido (formato Baileys) aplicando las opciones comunes. */
   enviarCrudo(jid, contenido, op = {}) {
      const opcionesEnvio = { ...(op.opcionesEnvio ?? {}) }
      if (op.citar) opcionesEnvio.quoted = op.citar.raw ?? op.citar
      return this._s().sendMessage(aJid(jid), this._contenido(contenido, op), opcionesEnvio)
   }

   /** Responde citando un mensaje. `contenido` puede ser texto u objeto Baileys. */
   responder(msg, contenido, op = {}) {
      return typeof contenido === 'string'
         ? this.enviarTexto(msg.chat, contenido, { ...op, citar: msg })
         : this.enviarCrudo(msg.chat, contenido, { ...op, citar: msg })
   }

   // ---------- Básicos ----------

   enviarTexto(jid, texto, op = {}) {
      return this.enviarCrudo(jid, { text: String(texto) }, op)
   }

   enviarImagen(jid, fuente, leyenda = '', op = {}) {
      return this.enviarCrudo(jid, { image: aMedia(fuente), caption: leyenda }, op)
   }

   /** op.gif = true -> se reproduce como GIF; op.ptv = true -> videomensaje redondo */
   enviarVideo(jid, fuente, leyenda = '', op = {}) {
      return this.enviarCrudo(jid, {
         video: aMedia(fuente),
         caption: leyenda,
         gifPlayback: Boolean(op.gif),
         ptv: Boolean(op.ptv)
      }, op)
   }

   /** op.nota = true -> nota de voz */
   enviarAudio(jid, fuente, op = {}) {
      return this.enviarCrudo(jid, limpiar({
         audio: aMedia(fuente),
         ptt: Boolean(op.nota),
         mimetype: op.mimetype
      }), op)
   }

   /** op: { nombre, mimetype, leyenda } */
   enviarDocumento(jid, fuente, op = {}) {
      const nombre = op.nombre ?? (typeof fuente === 'string' ? fuente.split(/[\\/]/).pop() : 'archivo')
      return this.enviarCrudo(jid, limpiar({
         document: aMedia(fuente),
         fileName: nombre,
         mimetype: op.mimetype ?? adivinarMime(nombre),
         caption: op.leyenda
      }), op)
   }

   /** El sticker debe estar en formato .webp */
   enviarSticker(jid, fuente, op = {}) {
      return this.enviarCrudo(jid, { sticker: aMedia(fuente) }, op)
   }

   /**
    * Álbum de fotos/videos:
    *   bot.enviarAlbum(jid, [{ imagen: 'a.jpg', leyenda: '1' }, { video: 'b.mp4' }])
    */
   enviarAlbum(jid, elementos, op = {}) {
      const album = elementos.map((e) => (e.video
         ? { video: aMedia(e.video), caption: e.leyenda ?? '' }
         : { image: aMedia(e.imagen), caption: e.leyenda ?? '' }))
      return this.enviarCrudo(jid, { album }, op)
   }

   /**
    * Paquete de stickers (WebP, o con sharp/@napi-rs/image instalado cualquier imagen):
    *   bot.enviarPaqueteStickers(jid, { portada, stickers: ['1.webp', '2.webp'], nombre, autor, descripcion })
    */
   enviarPaqueteStickers(jid, { portada, stickers, nombre, autor, descripcion }, op = {}) {
      return this.enviarCrudo(jid, limpiar({
         cover: aMedia(portada),
         stickers: stickers.map((s) => ({ data: aMedia(s) })),
         name: nombre,
         publisher: autor,
         description: descripcion
      }), op)
   }

   enviarUbicacion(jid, lat, lng, nombre = '', op = {}) {
      return this.enviarCrudo(jid, {
         location: { degreesLatitude: lat, degreesLongitude: lng, name: nombre }
      }, op)
   }

   /**
    * Uno o varios contactos:
    *   bot.enviarContacto(jid, { nombre: 'Lia', numero: '628123456789' })
    *   bot.enviarContacto(jid, [{ nombre: 'A', numero: '1' }, { nombre: 'B', numero: '2' }])
    */
   enviarContacto(jid, contactos, op = {}) {
      const lista = [].concat(contactos)
      return this.enviarCrudo(jid, {
         contacts: {
            displayName: lista.length === 1 ? lista[0].nombre : `${lista.length} contactos`,
            contacts: lista.map((c) => ({ vcard: crearVCard(c) }))
         }
      }, op)
   }

   /**
    * Encuesta:
    *   bot.enviarEncuesta(jid, '¿Pizza?', ['Sí', 'No'], { maxSelecciones: 1 })
    * op: maxSelecciones, terminaEn (Date), ocultarVotantes, permitirAgregarOpciones
    */
   enviarEncuesta(jid, pregunta, opciones, op = {}) {
      return this.enviarCrudo(jid, {
         poll: limpiar({
            name: pregunta,
            values: opciones,
            selectableCount: op.maxSelecciones ?? 1,
            toAnnouncementGroup: false,
            endDate: op.terminaEn,
            hideVoter: op.ocultarVotantes,
            canAddOption: op.permitirAgregarOpciones
         })
      }, op)
   }

   /**
    * Evento:
    *   bot.enviarEvento(jid, { nombre, descripcion, inicio: new Date(...), fin, ubicacion: { nombre, lat, lng }, llamada: 'audio' })
    */
   enviarEvento(jid, e, op = {}) {
      return this.enviarCrudo(jid, {
         event: limpiar({
            name: e.nombre,
            description: e.descripcion,
            startDate: e.inicio,
            endDate: e.fin,
            call: e.llamada,
            isCancelled: e.cancelado,
            extraGuestsAllowed: e.invitadosExtra,
            location: e.ubicacion ? limpiar({
               name: e.ubicacion.nombre,
               degreesLatitude: e.ubicacion.lat,
               degreesLongitude: e.ubicacion.lng
            }) : undefined
         })
      }, op)
   }

   /** Tarjeta de invitación a un grupo */
   enviarInvitacionGrupo(jid, { codigo, grupoJid, nombre, texto = '', expira = Date.now() + 86_400_000 }, op = {}) {
      const limpio = String(codigo).split('chat.whatsapp.com/').pop().split('?')[0]
      return this.enviarCrudo(jid, {
         groupInvite: { inviteCode: limpio, inviteExpiration: expira, text: texto, jid: grupoJid, subject: nombre }
      }, op)
   }

   // ---------- Interactivos ----------

   /**
    * Botones simples (con o sin imagen):
    *   bot.enviarBotones(jid, 'Elige', [{ texto: 'Sí', id: '!si' }, { texto: 'No', id: '!no' }], { pie: 'Mi bot', imagen: 'foto.jpg' })
    */
   enviarBotones(jid, texto, botones, op = {}) {
      const lista = botones.map((b) => (b.secciones
         ? { text: b.texto, sections: convertirSecciones(b.secciones) }
         : { text: b.texto, id: b.id }))
      const base = op.imagen
         ? { image: aMedia(op.imagen), caption: texto }
         : op.video
            ? { video: aMedia(op.video), caption: texto }
            : { text: texto }
      return this.enviarCrudo(jid, limpiar({ ...base, footer: op.pie, buttons: lista }), op)
   }

   /**
    * Lista desplegable (solo chats privados):
    *   bot.enviarLista(jid, {
    *     texto: 'Menú', titulo: 'Hola', pie: '...', botonTexto: 'Ver opciones',
    *     secciones: [{ titulo: 'Juegos', filas: [{ titulo: 'Trivia', descripcion: '...', id: '!trivia' }] }]
    *   })
    */
   enviarLista(jid, { texto, titulo, pie, botonTexto = 'Ver opciones', secciones }, op = {}) {
      return this.enviarCrudo(jid, limpiar({
         text: texto,
         footer: pie,
         title: titulo,
         buttonText: botonTexto,
         sections: secciones.map((s) => ({
            title: s.titulo,
            rows: s.filas.map((f) => ({ title: f.titulo, description: f.descripcion ?? '', rowId: f.id }))
         }))
      }), op)
   }

   /**
    * Mensaje interactivo (nativeFlow): botones de respuesta, URL, copiar, llamar y listas.
    *   bot.enviarInteractivo(jid, {
    *     texto: 'Hola', pie: 'Mi bot', imagen: 'foto.jpg',
    *     botones: [
    *       { texto: 'Saludar', id: '!hola' },
    *       { texto: 'Web', url: 'https://example.com' },
    *       { texto: 'Copiar', copiar: 'CODIGO123' },
    *       { texto: 'Llamar', llamar: '628123456789' }
    *     ],
    *     oferta: { texto: 'Cupón', codigo: 'PROMO10', url: 'https://example.com', expira: Date.now() + 3600000 }
    *   })
    */
   enviarInteractivo(jid, cfg, op = {}) {
      const base = cfg.imagen
         ? { image: aMedia(cfg.imagen), caption: cfg.texto }
         : cfg.video
            ? { video: aMedia(cfg.video), caption: cfg.texto }
            : { text: cfg.texto }
      return this.enviarCrudo(jid, limpiar({
         ...base,
         footer: cfg.pie,
         optionText: cfg.textoOpciones,
         optionTitle: cfg.tituloOpciones,
         offerText: cfg.oferta?.texto,
         offerCode: cfg.oferta?.codigo,
         offerUrl: cfg.oferta?.url,
         offerExpiration: cfg.oferta?.expira,
         nativeFlow: cfg.botones.map(convertirBotonNativo),
         interactiveAsTemplate: cfg.comoPlantilla
      }), op)
   }

   /**
    * Carrusel de tarjetas:
    *   bot.enviarCarrusel(jid, 'Mira esto', [
    *     { imagen: 'a.jpg', texto: 'Foto 1', pie: 'Pie', botones: [{ texto: 'Web', url: 'https://...' }] }
    *   ], { pie: 'Mi bot' })
    */
   enviarCarrusel(jid, texto, tarjetas, op = {}) {
      return this.enviarCrudo(jid, limpiar({
         text: texto,
         footer: op.pie,
         cards: tarjetas.map((t) => limpiar({
            image: t.imagen ? aMedia(t.imagen) : undefined,
            video: t.video ? aMedia(t.video) : undefined,
            caption: t.texto,
            footer: t.pie,
            optionText: t.textoOpciones,
            optionTitle: t.tituloOpciones,
            offerText: t.oferta?.texto,
            offerCode: t.oferta?.codigo,
            offerUrl: t.oferta?.url,
            offerExpiration: t.oferta?.expira,
            nativeFlow: (t.botones ?? []).map(convertirBotonNativo)
         }))
      }), op)
   }

   /**
    * Plantilla con botones:
    *   bot.enviarPlantilla(jid, { titulo, texto, pie, imagen, botones: [{ texto, id } | { texto, url } | { texto, llamar }] })
    */
   enviarPlantilla(jid, { titulo, texto, pie, imagen, botones }, op = {}) {
      return this.enviarCrudo(jid, limpiar({
         title: titulo,
         image: imagen ? aMedia(imagen) : undefined,
         caption: texto,
         footer: pie,
         templateButtons: botones.map((b) => limpiar({
            text: b.texto,
            id: b.id,
            url: b.url,
            call: b.llamar ? String(b.llamar) : undefined
         }))
      }), op)
   }

   // ---------- Texto enriquecido ----------

   /**
    * Tabla:
    *   bot.enviarTabla(jid, {
    *     titulo: 'Comparación', cabecera: '## Runtimes', pie: '¿Claro?',
    *     filas: [['', 'Node', 'Bun'], ['Motor', 'V8', 'JSC']]
    *   })
    * `sinEncabezado: true` -> la primera fila no se marca como encabezado.
    */
   enviarTabla(jid, { titulo, filas, cabecera, texto = '---', pie, aviso, sinEncabezado = false }, op = {}) {
      return this.enviarCrudo(jid, limpiar({
         disclaimerText: aviso,
         headerText: cabecera,
         contentText: texto,
         title: titulo,
         table: filas,
         noHeading: sinEncabezado,
         footerText: pie
      }), op)
   }

   /** Bloque de código con resaltado de sintaxis */
   enviarCodigo(jid, { codigo, lenguaje = 'javascript', cabecera, texto = '---', pie, aviso }, op = {}) {
      return this.enviarCrudo(jid, limpiar({
         disclaimerText: aviso,
         headerText: cabecera,
         contentText: texto,
         code: codigo,
         language: lenguaje,
         footerText: pie
      }), op)
   }

   /** Lista de enlaces con título: enlaces: [{ texto, titulo, url }] */
   enviarEnlaces(jid, { enlaces, cabecera, texto = '---', pie, aviso }, op = {}) {
      return this.enviarCrudo(jid, limpiar({
         disclaimerText: aviso,
         headerText: cabecera,
         contentText: texto,
         links: enlaces.map((e) => ({ text: e.texto, title: e.titulo, url: e.url })),
         footerText: pie
      }), op)
   }

   // ============================================================
   //  Acciones sobre mensajes
   // ============================================================

   _clave(mensajeOClave) { return mensajeOClave?.key ?? mensajeOClave }

   /** Reacciona con un emoji. Usa '' para quitar la reacción. */
   reaccionar(mensajeOClave, emoji) {
      const key = this._clave(mensajeOClave)
      return this._s().sendMessage(key.remoteJid, { react: { key, text: emoji } })
   }

   /**
    * Edita un mensaje enviado por el bot.
    * Si es una imagen/video/documento se edita su leyenda automáticamente.
    */
   editar(mensajeOClave, nuevoTexto, { leyenda } = {}) {
      const key = this._clave(mensajeOClave)
      const esLeyenda = leyenda ?? Boolean(mensajeOClave?.esMultimedia)
      return this._s().sendMessage(
         key.remoteJid,
         esLeyenda ? { caption: nuevoTexto, edit: key } : { text: nuevoTexto, edit: key }
      )
   }

   /** Borra un mensaje para todos */
   borrar(mensajeOClave) {
      const key = this._clave(mensajeOClave)
      return this._s().sendMessage(key.remoteJid, { delete: key })
   }

   /** Reenvía un mensaje a otro chat */
   reenviar(jid, mensaje, { forzar = true } = {}) {
      return this._s().sendMessage(aJid(jid), { forward: mensaje.raw ?? mensaje, force: forzar })
   }

   /** Fija un mensaje. `segundos`: 86400 (1 día), 604800 (7 días), 2592000 (30 días) */
   fijar(mensajeOClave, segundos = 604_800) {
      const key = this._clave(mensajeOClave)
      return this._s().sendMessage(key.remoteJid, { pin: key, time: segundos, type: 1 })
   }

   desfijar(mensajeOClave) {
      const key = this._clave(mensajeOClave)
      return this._s().sendMessage(key.remoteJid, { pin: key, type: 2 })
   }

   /** Marca como leído */
   leer(mensajeOClave) {
      return this._s().readMessages([this._clave(mensajeOClave)])
   }

   /** "escribiendo..." durante `ms` milisegundos ('composing') o "grabando audio..." ('recording') */
   async escribiendo(jid, ms = 1500, estado = 'composing') {
      const s = this._s()
      await s.presenceSubscribe?.(aJid(jid))
      await s.sendPresenceUpdate(estado, aJid(jid))
      await dormir(ms)
      await s.sendPresenceUpdate('paused', aJid(jid))
   }

   /** 'available' | 'unavailable' | 'composing' | 'recording' | 'paused' */
   presencia(estado, jid) {
      return this._s().sendPresenceUpdate(estado, jid ? aJid(jid) : undefined)
   }

   // ============================================================
   //  Archivos
   // ============================================================

   async _descargar(raw) {
      const s = this._s()
      return B.downloadMediaMessage(
         raw,
         'buffer',
         {},
         { logger: this.logger ?? SILENCIOSO, reuploadRequest: s.updateMediaMessage }
      )
   }

   /** ¿Existe este número en WhatsApp? */
   existeEnWhatsApp(numero) { return this.perfil.existe(numero) }
}
