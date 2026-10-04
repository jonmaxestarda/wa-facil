// ============================================================
//  utilidades.js — Funciones auxiliares de wa-facil
// ============================================================

/** Espera N milisegundos: `await dormir(1000)` */
export const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Devuelve un elemento al azar de un arreglo */
export const aleatorio = (arr) => arr[Math.floor(Math.random() * arr.length)]

/** Convierte números "Long" de protobuf (o strings) a Number normal */
export function aNumero(x) {
   if (x == null) return 0
   if (typeof x === 'object' && typeof x.toNumber === 'function') return x.toNumber()
   return Number(x)
}

/**
 * Convierte un número de teléfono (con o sin +, espacios o guiones) a JID.
 * Si ya es un JID (contiene "@") lo devuelve igual.
 *
 *   numeroAJid('+54 9 11 1234-5678') -> '5491112345678@s.whatsapp.net'
 */
export function numeroAJid(numero) {
   if (numero === undefined || numero === null || numero === '') {
      throw new Error('Falta el número o JID de destino.')
   }
   const texto = String(numero).trim()
   if (texto.includes('@')) return texto
   const digitos = texto.replace(/\D/g, '')
   if (!digitos) throw new Error(`Número inválido: "${numero}"`)
   return `${digitos}@s.whatsapp.net`
}

/** Alias corto de numeroAJid */
export const aJid = numeroAJid

/** '5491112345678@s.whatsapp.net' -> '5491112345678' (también quita el sufijo ":device") */
export function jidANumero(jid) {
   return String(jid ?? '').split('@')[0].split(':')[0]
}

/** Parte "usuario" de un JID sin dominio ni dispositivo (sirve para comparar ids) */
export const idBase = jidANumero

/** Quita el sufijo de dispositivo: '123:5@s.whatsapp.net' -> '123@s.whatsapp.net' */
export function normalizarJid(jid) {
   const texto = String(jid ?? '')
   const [usuario, dominio] = texto.split('@')
   return dominio ? `${usuario.split(':')[0]}@${dominio}` : texto
}

export const esJidGrupo = (jid) => String(jid).endsWith('@g.us')
export const esJidCanal = (jid) => String(jid).endsWith('@newsletter')
export const esJidEstado = (jid) => String(jid) === 'status@broadcast'
export const esJidLid = (jid) => String(jid).endsWith('@lid')

/**
 * Normaliza una "fuente de archivo":
 *  - Buffer           -> Buffer
 *  - 'ruta' o 'https://...' -> { url }
 *  - { url } o { stream } -> igual
 */
export function aMedia(fuente) {
   if (Buffer.isBuffer(fuente)) return fuente
   if (fuente instanceof Uint8Array) return Buffer.from(fuente)
   if (typeof fuente === 'string') return { url: fuente }
   if (fuente && typeof fuente === 'object') return fuente
   throw new Error('Fuente de archivo no válida. Usa un Buffer, una ruta/URL (string) o { url } / { stream }.')
}

/** Quita las propiedades undefined/null de un objeto */
export function limpiar(objeto) {
   return Object.fromEntries(
      Object.entries(objeto).filter(([, valor]) => valor !== undefined && valor !== null)
   )
}

/** Crea una tarjeta de contacto (vCard) */
export function crearVCard({ nombre, numero, organizacion }) {
   const n = String(numero).replace(/\D/g, '')
   return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${nombre}`,
      organizacion ? `ORG:${organizacion};` : null,
      `TEL;type=CELL;type=VOICE;waid=${n}:+${n}`,
      'END:VCARD'
   ].filter(Boolean).join('\n')
}

/** '12345678' -> '1234-5678' (formato del código de vinculación) */
export function formatearCodigo(codigo) {
   return String(codigo ?? '').match(/.{1,4}/g)?.join('-') ?? String(codigo ?? '')
}

/** Adivina el mimetype por la extensión del nombre del archivo */
export function adivinarMime(nombre = '') {
   const ext = String(nombre).split('.').pop()?.toLowerCase()
   const tabla = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      zip: 'application/zip',
      txt: 'text/plain',
      csv: 'text/csv',
      json: 'application/json',
      html: 'text/html',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      mp4: 'video/mp4',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp'
   }
   return tabla[ext] ?? 'application/octet-stream'
}

/**
 * Convierte secciones en español al formato de la librería.
 *   [{ titulo, etiqueta?, filas: [{ titulo, descripcion?, encabezado?, id }] }]
 */
export function convertirSecciones(secciones = []) {
   return secciones.map((s) => limpiar({
      title: s.titulo,
      highlight_label: s.etiqueta,
      rows: (s.filas ?? []).map((f) => ({
         header: f.encabezado ?? '',
         title: f.titulo,
         description: f.descripcion ?? '',
         id: f.id
      }))
   }))
}

/**
 * Convierte un botón "nativeFlow" en español al formato de la librería.
 *   { texto, id }                     -> botón que responde con un id
 *   { texto, url, webview? }          -> abre un enlace
 *   { texto, copiar }                 -> copia un texto
 *   { texto, llamar }                 -> llama a un número
 *   { texto, secciones }              -> abre una lista desplegable
 *   cualquiera puede llevar { icono }
 */
export function convertirBotonNativo(boton) {
   const salida = { text: boton.texto }
   if (boton.id !== undefined) salida.id = boton.id
   if (boton.llamar) salida.call = String(boton.llamar)
   if (boton.copiar) salida.copy = boton.copiar
   if (boton.url) {
      salida.url = boton.url
      if (boton.webview) salida.useWebview = true
   }
   if (boton.secciones) salida.sections = convertirSecciones(boton.secciones)
   if (boton.icono) salida.icon = boton.icono
   return salida
}
