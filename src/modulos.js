// ============================================================
//  modulos.js — Grupos, Comunidades, Perfil, Privacidad y Canales
//  Se usan desde el bot:  bot.grupos.crear(...), bot.perfil.nombre(...)
// ============================================================
import { aJid, aMedia, idBase, jidANumero } from './utilidades.js'

const TTL_CACHE_GRUPO = 60_000 // 1 minuto

/** Acepta un código ("ABC123") o un enlace completo y devuelve solo el código */
function extraerCodigo(codigoOEnlace) {
   return String(codigoOEnlace).split('chat.whatsapp.com/').pop().split('?')[0].trim()
}

// ------------------------------------------------------------
//  GRUPOS
// ------------------------------------------------------------
export class Grupos {
   constructor(bot) {
      this.bot = bot
      this._cache = new Map()
   }

   get _s() { return this.bot._s() }

   /** Crea un grupo. `participantes` son números o JIDs. */
   crear(nombre, participantes = []) {
      return this._s.groupCreate(nombre, participantes.map(aJid))
   }

   /** Información del grupo (con caché de 1 minuto). Usa { forzar: true } para refrescar. */
   async info(jid, { forzar = false } = {}) {
      const guardado = this._cache.get(jid)
      if (!forzar && guardado && Date.now() - guardado.t < TTL_CACHE_GRUPO) return guardado.data
      const data = await this._s.groupMetadata(jid)
      this._cache.set(jid, { t: Date.now(), data })
      return data
   }

   /** Datos ya guardados en caché (sin pedirlos a WhatsApp). Útil para el socket. */
   cacheado(jid) { return this._cache.get(jid)?.data }

   /** Borra la caché de un grupo (el bot lo hace solo cuando hay cambios) */
   invalidar(jid) { this._cache.delete(jid) }

   /** Todos los grupos donde está el bot. Devuelve un objeto { jid: metadata } */
   todos() { return this._s.groupFetchAllParticipating() }

   /** Código de invitación ("ABC123...") */
   codigo(jid) { return this._s.groupInviteCode(jid) }

   /** Enlace de invitación completo */
   async enlace(jid) { return `https://chat.whatsapp.com/${await this.codigo(jid)}` }

   /** Invalida el enlace actual y genera uno nuevo */
   revocarEnlace(jid) { return this._s.groupRevokeInvite(jid) }

   /** Entra a un grupo con un enlace o código */
   unirse(codigoOEnlace) { return this._s.groupAcceptInvite(extraerCodigo(codigoOEnlace)) }

   /** Mira la información de un grupo con su enlace sin entrar */
   infoInvitacion(codigoOEnlace) { return this._s.groupGetInviteInfo(extraerCodigo(codigoOEnlace)) }

   /** El bot sale del grupo */
   salir(jid) { return this._s.groupLeave(jid) }

   // --- Participantes
   agregar(jid, personas) { return this._actualizar(jid, personas, 'add') }
   eliminar(jid, personas) { return this._actualizar(jid, personas, 'remove') }
   promover(jid, personas) { return this._actualizar(jid, personas, 'promote') }
   degradar(jid, personas) { return this._actualizar(jid, personas, 'demote') }

   _actualizar(jid, personas, accion) {
      const lista = [].concat(personas).map(aJid)
      return this._s.groupParticipantsUpdate(jid, lista, accion)
   }

   // --- Datos del grupo
   nombre(jid, nuevoNombre) { return this._s.groupUpdateSubject(jid, nuevoNombre) }
   descripcion(jid, texto) { return this._s.groupUpdateDescription(jid, texto) }
   foto(jid, fuente) { return this._s.updateProfilePicture(jid, aMedia(fuente)) }
   quitarFoto(jid) { return this._s.removeProfilePicture(jid) }

   // --- Ajustes (true/false)
   /** true = solo admins pueden escribir */
   soloAdminsEscriben(jid, activar = true) {
      return this._s.groupSettingUpdate(jid, activar ? 'announcement' : 'not_announcement')
   }

   /** true = solo admins pueden editar la info del grupo */
   soloAdminsEditan(jid, activar = true) {
      return this._s.groupSettingUpdate(jid, activar ? 'locked' : 'unlocked')
   }

   /** true = solo admins pueden agregar personas */
   soloAdminsAgregan(jid, activar = true) {
      return this._s.groupMemberAddMode(jid, activar ? 'admin_add' : 'all_member_add')
   }

   /** Mensajes temporales en segundos: 86400 (1 día), 604800 (7 días), 7776000 (90 días), 0 = desactivar */
   efimeros(jid, segundos) { return this._s.groupToggleEphemeral(jid, segundos) }

   /** Activa/desactiva la aprobación de nuevos miembros */
   aprobacion(jid, activar = true) {
      return this._s.groupJoinApprovalMode(jid, activar ? 'on' : 'off')
   }

   /** Lista de solicitudes pendientes */
   solicitudes(jid) { return this._s.groupRequestParticipantsList(jid) }

   /** Aprueba (true) o rechaza (false) solicitudes */
   responderSolicitudes(jid, personas, aprobar = true) {
      return this._s.groupRequestParticipantsUpdate(jid, [].concat(personas).map(aJid), aprobar ? 'approve' : 'reject')
   }

   /** Cambia la etiqueta (label) del bot en el grupo */
   etiquetaMiembro(jid, texto) { return this._s.updateMemberLabel(jid, texto) }

   // --- Ayudas de administración

   /** ¿Alguno de estos ids es admin del grupo? (acepta JID, LID o número) */
   async esAdmin(jid, ...ids) {
      const info = await this.info(jid)
      const buscados = new Set(ids.flat().filter(Boolean).map(idBase))
      return (info.participants ?? []).some((p) =>
         p.admin && [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).some((x) => buscados.has(idBase(x)))
      )
   }

   /** ¿El bot es admin del grupo? */
   async botEsAdmin(jid) {
      const yo = this.bot.sock?.user
      return this.esAdmin(jid, yo?.id, yo?.lid)
   }

   /** Lista de admins [{ id, admin }] */
   async admins(jid) {
      const info = await this.info(jid)
      return (info.participants ?? []).filter((p) => p.admin)
   }
}

// ------------------------------------------------------------
//  COMUNIDADES
// ------------------------------------------------------------
export class Comunidades {
   constructor(bot) { this.bot = bot }

   get _s() { return this.bot._s() }

   crear(nombre, descripcion = '') { return this._s.communityCreate(nombre, descripcion) }
   crearGrupo(nombre, participantes, comunidadJid) {
      return this._s.communityCreateGroup(nombre, participantes.map(aJid), comunidadJid)
   }
   vincularGrupo(grupoJid, comunidadJid) { return this._s.communityLinkGroup(grupoJid, comunidadJid) }
   desvincularGrupo(grupoJid, comunidadJid) { return this._s.communityUnlinkGroup(grupoJid, comunidadJid) }
   info(jid) { return this._s.communityMetadata(jid) }
   todas() { return this._s.communityFetchAllParticipating() }
   gruposVinculados(jid) { return this._s.communityFetchLinkedGroups(jid) }
   codigo(jid) { return this._s.communityInviteCode(jid) }
   revocarEnlace(jid) { return this._s.communityRevokeInvite(jid) }
   unirse(codigoOEnlace) { return this._s.communityAcceptInvite(extraerCodigo(codigoOEnlace)) }
   infoInvitacion(codigoOEnlace) { return this._s.communityGetInviteInfo(extraerCodigo(codigoOEnlace)) }
   salir(jid) { return this._s.communityLeave(jid) }
   nombre(jid, texto) { return this._s.communityUpdateSubject(jid, texto) }
   descripcion(jid, texto) { return this._s.communityUpdateDescription(jid, texto) }
   soloAdminsEscriben(jid, activar = true) {
      return this._s.communitySettingUpdate(jid, activar ? 'announcement' : 'not_announcement')
   }
   soloAdminsEditan(jid, activar = true) {
      return this._s.communitySettingUpdate(jid, activar ? 'locked' : 'unlocked')
   }
   soloAdminsAgregan(jid, activar = true) {
      return this._s.communityMemberAddMode(jid, activar ? 'admin_add' : 'all_member_add')
   }
   efimeros(jid, segundos) { return this._s.communityToggleEphemeral(jid, segundos) }
   aprobacion(jid, activar = true) { return this._s.communityJoinApprovalMode(jid, activar ? 'on' : 'off') }
   solicitudes(jid) { return this._s.communityRequestParticipantsList(jid) }
   responderSolicitudes(jid, personas, aprobar = true) {
      return this._s.communityRequestParticipantsUpdate(jid, [].concat(personas).map(aJid), aprobar ? 'approve' : 'reject')
   }
}

// ------------------------------------------------------------
//  PERFIL Y CONTACTOS
// ------------------------------------------------------------
export class Perfil {
   constructor(bot) { this.bot = bot }

   get _s() { return this.bot._s() }

   /** JID propio del bot (sin sufijo de dispositivo) */
   miJid() { return `${jidANumero(this._s.user?.id)}@s.whatsapp.net` }

   /** URL de la foto de perfil de alguien (o undefined si no tiene/no la puede ver) */
   async fotoDe(jid, { alta = true } = {}) {
      try {
         return await this._s.profilePictureUrl(aJid(jid), alta ? 'image' : 'preview')
      } catch {
         return undefined
      }
   }

   cambiarFoto(fuente) { return this._s.updateProfilePicture(this.miJid(), aMedia(fuente)) }
   quitarFoto() { return this._s.removeProfilePicture(this.miJid()) }
   nombre(nuevoNombre) { return this._s.updateProfileName(nuevoNombre) }
   estado(texto) { return this._s.updateProfileStatus(texto) }

   bloquear(jid) { return this._s.updateBlockStatus(aJid(jid), 'block') }
   desbloquear(jid) { return this._s.updateBlockStatus(aJid(jid), 'unblock') }
   bloqueados() { return this._s.fetchBlocklist() }

   /** Perfil de negocio de una cuenta Business */
   negocio(jid) { return this._s.getBusinessProfile(aJid(jid)) }

   /** ¿Este número tiene WhatsApp? Devuelve { existe, jid } */
   async existe(numero) {
      const jid = aJid(numero)
      const resultado = await this._s.onWhatsApp(jid)
      const primero = Array.isArray(resultado) ? resultado[0] : undefined
      return { existe: Boolean(primero?.exists), jid: primero?.jid ?? jid }
   }

   /** Guarda/edita un contacto en la agenda de la cuenta del bot */
   guardarContacto(jid, nombre) { return this._s.addOrEditContact(aJid(jid), { displayName: nombre }) }
   eliminarContacto(jid) { return this._s.removeContact(aJid(jid)) }
}

// ------------------------------------------------------------
//  PRIVACIDAD
// ------------------------------------------------------------
export class Privacidad {
   constructor(bot) { this.bot = bot }

   get _s() { return this.bot._s() }

   /** 'all' | 'contacts' | 'contact_blacklist' | 'nobody' */
   ultimaConexion(valor) { return this._s.updateLastSeenPrivacy(valor) }
   /** 'all' | 'match_last_seen' */
   enLinea(valor) { return this._s.updateOnlinePrivacy(valor) }
   /** 'all' | 'contacts' | 'contact_blacklist' | 'none' */
   fotoPerfil(valor) { return this._s.updateProfilePicturePrivacy(valor) }
   /** 'all' | 'contacts' | 'contact_blacklist' | 'none' */
   estados(valor) { return this._s.updateStatusPrivacy(valor) }
   /** 'all' | 'none' */
   confirmacionLectura(valor) { return this._s.updateReadReceiptsPrivacy(valor) }
   /** 'all' | 'contacts' | 'contact_blacklist' — quién puede añadirte a grupos */
   grupos(valor) { return this._s.updateGroupsAddPrivacy(valor) }
   /** 'all' | 'contacts' | 'nobody' */
   mensajes(valor) { return this._s.updateMessagesPrivacy(valor) }
   /** 'everyone' | 'known' */
   llamadas(valor) { return this._s.updateCallPrivacy(valor) }
   /** Segundos: 86400, 604800, 7776000, 0 = desactivado */
   mensajesTemporales(segundos) { return this._s.updateDefaultDisappearingMode(segundos) }
   /** true = desactiva las vistas previas de enlaces */
   desactivarVistaPrevia(valor = true) { return this._s.updateDisableLinkPreviewsPrivacy(valor) }
}

// ------------------------------------------------------------
//  CANALES (newsletters)
// ------------------------------------------------------------
export class Canales {
   constructor(bot) { this.bot = bot }

   get _s() { return this.bot._s() }

   crear(nombre, descripcion = '') { return this._s.newsletterCreate(nombre, descripcion) }

   /** Información de un canal. Acepta su JID (xxx@newsletter) o su enlace de invitación. */
   info(jidOEnlace) {
      const texto = String(jidOEnlace)
      if (texto.endsWith('@newsletter')) return this._s.newsletterMetadata('jid', texto)
      const codigo = texto.split('/').pop().split('?')[0]
      return this._s.newsletterMetadata('invite', codigo)
   }

   suscriptores(jid) { return this._s.newsletterSubscribers(jid) }
   cantidadAdmins(jid) { return this._s.newsletterAdminCount(jid) }
   seguir(jid) { return this._s.newsletterFollow(jid) }
   dejarDeSeguir(jid) { return this._s.newsletterUnfollow(jid) }
   silenciar(jid) { return this._s.newsletterMute(jid) }
   quitarSilencio(jid) { return this._s.newsletterUnmute(jid) }
   quitarAdmin(jid, persona) { return this._s.newsletterDemote(jid, aJid(persona)) }
   cambiarPropietario(jid, persona) { return this._s.newsletterChangeOwner(jid, aJid(persona)) }
   nombre(jid, texto) { return this._s.newsletterUpdateName(jid, texto) }
   descripcion(jid, texto) { return this._s.newsletterUpdateDescription(jid, texto) }
   foto(jid, fuente) { return this._s.newsletterUpdatePicture(jid, aMedia(fuente)) }
   quitarFoto(jid) { return this._s.newsletterRemovePicture(jid) }
   /** Reacciona a un mensaje del canal con el id del servidor del mensaje */
   reaccionar(jid, idServidor, emoji) { return this._s.newsletterReactMessage(jid, String(idServidor), emoji) }
   /** Canales a los que sigue el bot */
   suscritos() { return this._s.newsletterSubscribed() }
   /** Últimos mensajes de un canal */
   mensajes(jid, cantidad = 50) { return this._s.newsletterFetchMessages('jid', jid, cantidad, 0, 0) }
   eliminar(jid) { return this._s.newsletterDelete(jid) }
}
