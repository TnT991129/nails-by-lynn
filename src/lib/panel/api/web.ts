// Web de las clientas: galería, portada, logo, diseño, textos, opiniones, fotos e inspiración.
import { sb, NEGOCIO_ID } from '../supabase-panel'
import { reducirImagen } from '../imagen'
import { codigoDeFalloSubida, esFalloDeRed, esFalloDeSesion } from '../subida'
import { idAleatorio } from '../../almacenamiento'
import { CLAVE_DISENO, type Diseno } from '../../diseno'
import { ejecutar } from './base'
import { unaFila } from './clientas'
import { actualizarServicio, ServicioEdit } from './negocio'

// ================== GALERÍA (panel) ==================
export type FotoPanel = {
  id: string; image_url: string; thumbnail_url: string | null;
  alt_text: string | null; caption: string | null;
  service_id: string | null;
  has_consent: boolean; is_featured: boolean; is_published: boolean;
  sort_order: number; created_at: string;
}

/** Error al subir una foto: el código da el mensaje para Lynn; paso y detalle dicen qué falló exactamente */
export class ErrorSubida extends Error {
  constructor(codigo: string, public paso: string, public detalle: string) { super(codigo) }
}

const textoDeError = (e: unknown) =>
  `${(e as { message?: string })?.message ?? String(e)} ${(e as { statusCode?: string })?.statusCode ?? ''}`.trim()

// En el móvil el panel pasa horas en segundo plano: el permiso de la sesión (dura una hora) puede haber caducado
// y, con datos móviles, no haberse renovado. Se renueva antes de subir para que Supabase no rechace la foto.
async function sesionAlDia(forzar = false) {
  const { data: { session } } = await sb.auth.getSession()
  if (forzar || !session || (session.expires_at ?? 0) * 1000 - Date.now() < 5 * 60_000) await sb.auth.refreshSession()
}

// Fotos JPEG/PNG/WebP de hasta 4 MB se pueden subir tal cual si el móvil no consigue reducirlas
const MAX_ORIGINAL = 4 * 1024 * 1024

async function subirUnaVez(path: string, archivo: File, espera: number): Promise<unknown> {
  // Con la conexión de Cuba una subida puede quedarse colgada: se avisa en vez de girar para siempre
  let reloj: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<never>((_, rechazar) => { reloj = setTimeout(() => rechazar(new Error('SUBIDA_LENTA')), espera) })
  try {
    const { error } = await Promise.race([
      sb.storage.from('galeria').upload(path, archivo, {
        cacheControl: '31536000', upsert: false, contentType: archivo.type || 'image/jpeg',
      }),
      limite,
    ])
    return error
  } catch (e) {
    return e
  } finally {
    clearTimeout(reloj)
  }
}

// Subir un archivo al bucket 'galeria' y devolver su URL pública.
// Antes se reduce en el móvil (maxLado px, WebP) para ahorrar datos al subir y al ver.
export async function subirImagen(original: File, maxLado = 1600): Promise<{ url: string; path: string }> {
  let archivo: File
  try {
    archivo = await reducirImagen(original, maxLado)
  } catch (e) {
    const m = textoDeError(e)
    if (/fetch|network|import/i.test(m)) throw new ErrorSubida('SIN_CONEXION_FOTO', 'preparar la foto', m)
    // El móvil no pudo abrirla (poca memoria, formato raro): si es una foto normal y no muy grande, va tal cual
    if (!/image\/(jpeg|png|webp)/.test(original.type) || original.size > MAX_ORIGINAL) {
      throw new ErrorSubida('IMAGEN_INVALIDA', `preparar la foto (${original.type || 'sin tipo'}, ${Math.round(original.size / 1024)} KB)`, m)
    }
    archivo = original
  }
  const ext = archivo.type === 'image/webp' ? 'webp' : archivo.type === 'image/png' ? 'png' : 'jpg'
  const path = `${NEGOCIO_ID}/${idAleatorio()}.${ext}`

  try { await sesionAlDia() } catch { /* sin conexión para renovar: se intenta igual */ }
  let error = await subirUnaVez(path, archivo, 90_000)
  // Un segundo intento si falló por la sesión (se renueva a la fuerza) o por un corte de la red
  if (error) {
    const m = textoDeError(error)
    if (esFalloDeSesion(m) || esFalloDeRed(m)) {
      try { await sesionAlDia(esFalloDeSesion(m)) } catch { /* se intenta igual */ }
      error = await subirUnaVez(path, archivo, 90_000)
    }
  }
  if (error) {
    const m = textoDeError(error)
    throw new ErrorSubida(codigoDeFalloSubida(m), `subir a Supabase (${archivo.type || 'sin tipo'}, ${Math.round(archivo.size / 1024)} KB)`, m)
  }

  const { data } = sb.storage.from('galeria').getPublicUrl(path)
  return { url: data.publicUrl, path }
}

/** Deja constancia en Supabase de un fallo al subir una foto (para poder revisarlo luego); nunca falla */
export function registrarErrorSubida(origen: string, e: unknown, archivo: File | null) {
  const detalle = {
    paso: e instanceof ErrorSubida ? e.paso : 'guardar la foto en la galería',
    detalle: e instanceof ErrorSubida ? e.detalle : textoDeError(e),
    tipo: archivo?.type || null,
    kb: archivo ? Math.round(archivo.size / 1024) : null,
    extension: archivo?.name.split('.').pop()?.toLowerCase() ?? null,
    navegador: navigator.userAgent.slice(0, 250),
  }
  sb.rpc('registrar_error_panel', {
    p_origen: origen, p_mensaje: textoDeError(e).slice(0, 500), p_detalle: detalle,
  }).then(() => {}, () => {})
}

// Registrar la foto en la tabla
export async function crearFoto(args: {
  image_url: string
  service_id: string | null
  caption: string | null
  alt_text: string | null
  has_consent: boolean
  is_featured: boolean
  is_published: boolean
  client_id?: string | null
}) {
  return ejecutar(
    sb.from('gallery_photos').insert({
      business_id: NEGOCIO_ID,
      image_url: args.image_url,
      thumbnail_url: args.image_url,   // sin generación de thumbnail: usamos la misma
      service_id: args.service_id,
      caption: args.caption,
      alt_text: args.alt_text,
      has_consent: args.has_consent,
      is_featured: args.is_featured,
      is_published: args.is_published,
      client_id: args.client_id ?? null,
    }).select().single()
  )
}

export function listarFotosPanel() {
  return ejecutar<FotoPanel[]>(
    sb.from('gallery_photos').select(
      'id, image_url, thumbnail_url, alt_text, caption, service_id, has_consent, is_featured, is_published, sort_order, created_at'
    ).eq('business_id', NEGOCIO_ID)
     // Mismo orden que ve la clienta en la galería pública
     .order('sort_order', { ascending: true })
     .order('created_at', { ascending: false })
     .limit(300)
  )
}

export function actualizarFoto(id: string, cambios: Partial<FotoPanel>) {
  return ejecutar(
    sb.from('gallery_photos').update(cambios).eq('id', id).select().single()
  )
}

export async function eliminarFoto(id: string, imageUrl: string) {
  // Borrar la fila
  const { error: e1 } = await sb.from('gallery_photos').delete().eq('id', id)
  if (e1) throw e1

  await borrarArchivoGaleria(imageUrl)
}

// Borra el archivo del bucket a partir de su URL pública (si falla, no es crítico)
async function borrarArchivoGaleria(url: string) {
  // La URL viene como https://xxx.supabase.co/storage/v1/object/public/galeria/PATH
  const match = url.match(/\/galeria\/(.+)$/)
  if (match) await sb.storage.from('galeria').remove([match[1]])
}

// Foto de portada de un servicio: se sube, se guarda en el servicio y se borra la anterior
export async function cambiarFotoServicio(servicio: ServicioEdit, archivo: File | null): Promise<string | null> {
  let url: string | null = null
  if (archivo) url = (await subirImagen(archivo, 900)).url
  await actualizarServicio(servicio.id, { cover_image_url: url })
  if (servicio.cover_image_url) await borrarArchivoGaleria(servicio.cover_image_url).catch(() => {})
  return url
}

// ================== FOTO DE PORTADA DE LA WEB ==================
// businesses.hero_image_url: null = la foto de siempre (la que viene con la web)
export async function obtenerPortada(): Promise<string | null> {
  const { data, error } = await sb.from('businesses').select('hero_image_url').eq('id', NEGOCIO_ID).single()
  if (error) throw error
  return (data?.hero_image_url as string | null) ?? null
}

/** Sube la foto nueva (o null para volver a la de siempre) y borra la anterior que puso Lynn */
export async function cambiarPortada(archivo: File | null): Promise<string | null> {
  const anterior = await obtenerPortada()
  const url = archivo ? (await subirImagen(archivo, 1800)).url : null
  const { error } = await sb.from('businesses').update({ hero_image_url: url }).eq('id', NEGOCIO_ID)
  if (error) throw error
  if (anterior) await borrarArchivoGaleria(anterior).catch(() => {})
  return url
}

// ================== LOGO DE LA WEB ==================
// businesses.logo_url: null = el logo de siempre (el que viene con la web)
export async function obtenerLogo(): Promise<string | null> {
  const { data, error } = await sb.from('businesses').select('logo_url').eq('id', NEGOCIO_ID).single()
  if (error) throw error
  return (data?.logo_url as string | null) ?? null
}

/** Sube el logo nuevo (WebP conserva la transparencia) o null para volver al de siempre */
export async function cambiarLogo(archivo: File | null): Promise<string | null> {
  const anterior = await obtenerLogo()
  const url = archivo ? (await subirImagen(archivo, 600)).url : null
  const { error } = await sb.from('businesses').update({ logo_url: url }).eq('id', NEGOCIO_ID)
  if (error) throw error
  if (anterior) await borrarArchivoGaleria(anterior).catch(() => {})
  return url
}

// ================== DISEÑO DE LA WEB ==================
// Va dentro de settings.site_texts (clave CLAVE_DISENO de lib/diseno.ts) para no tocar la base de datos.
// Se lee lo guardado justo antes para no pisar los textos que Lynn haya cambiado.
export async function guardarDiseno(diseno: Diseno) {
  return guardarAjusteWeb(CLAVE_DISENO, diseno)
}

/** Guarda un ajuste de la web (diseño, tarjeta de fidelidad…) junto a los textos, sin tocar lo demás */
export async function guardarAjusteWeb(clave: `_${string}`, valor: unknown) {
  const textos = await obtenerTextosPanel()
  return guardarTextosPanel({ ...textos, [clave]: JSON.stringify(valor) })
}

// ================== FOTOS DEL TRABAJO (ficha de clienta) ==================
export type FotoTrabajo = { id: string; image_url: string; created_at: string; is_published: boolean }

export function fotosDeClienta(clientId: string) {
  return ejecutar<FotoTrabajo[]>(sb.from('gallery_photos')
    .select('id, image_url, created_at, is_published')
    .eq('business_id', NEGOCIO_ID).eq('client_id', clientId)
    .order('created_at', { ascending: false }).limit(6))
}

// Foto privada del diseño: no sale en la galería pública hasta que Lynn la publique (con permiso)
export async function subirFotoTrabajo(clientId: string, archivo: File) {
  const { url } = await subirImagen(archivo, 1200)
  return crearFoto({
    image_url: url, service_id: null, caption: null, alt_text: 'Trabajo de Nails by Lynn',
    has_consent: false, is_featured: false, is_published: false, client_id: clientId,
  })
}

// ================== TEXTOS DE LA WEB ==================
// Solo se guardan los que Lynn cambió (supabase/historial/textos_web.sql)
export async function obtenerTextosPanel(): Promise<Record<string, string>> {
  const { data, error } = await sb.from('settings').select('site_texts').eq('business_id', NEGOCIO_ID).single()
  if (error) throw error
  return (data?.site_texts ?? {}) as Record<string, string>
}

export function guardarTextosPanel(textos: Record<string, string>) {
  return ejecutar(sb.from('settings').update({ site_texts: textos, updated_at: new Date().toISOString() })
    .eq('business_id', NEGOCIO_ID).select('business_id').single())
}

// ================== RESEÑAS ==================
export type Resena = {
  id: string; rating: number; comment: string | null; is_published: boolean; created_at: string
  appointment_id: string; clients: { full_name: string } | null
}

export async function listarResenas(): Promise<Resena[]> {
  const { data, error } = await sb.from('reviews')
    .select('id, rating, comment, is_published, created_at, appointment_id, clients(full_name)')
    .eq('business_id', NEGOCIO_ID).order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data ?? []).map(f => ({ ...f, clients: unaFila(f.clients) })) as Resena[]
}

export function publicarResena(id: string, publicar: boolean) {
  return ejecutar(sb.from('reviews')
    .update({ is_published: publicar, published_at: publicar ? new Date().toISOString() : null })
    .eq('id', id).select('id').single())
}

export function eliminarResena(id: string) {
  return ejecutar(sb.from('reviews').delete().eq('id', id))
}

// ================== INSPIRACIÓN, FIDELIDAD Y VISITAS (supabase/historial/inspiracion_fidelidad_visitas.sql) ==================
/** ¿Está ejecutado el SQL nuevo? (false = falta; las pantallas lo avisan) */
export async function funcionesNuevasInstaladas(): Promise<boolean> {
  const { error } = await sb.rpc('embudo_web', { p_dias: 1 })
  return !(error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message)))
}

export type Embudo = { eventos: Partial<Record<string, number>>; por_dia: { dia: string; visitas: number }[] }
export async function embudoWeb(dias: number): Promise<Embudo | null> {
  const { data, error } = await sb.rpc('embudo_web', { p_dias: dias })
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) return null
    throw error
  }
  return data as Embudo
}

/** Fotos de inspiración de una cita, con enlaces que caducan en una hora (el almacén es privado) */
export async function inspiracionDeCita(citaId: string): Promise<{ id: string; url: string }[]> {
  const { data, error } = await sb.from('appointment_references').select('id, path').eq('appointment_id', citaId).order('created_at')
  if (error || !data?.length) return []   // sin el SQL o sin fotos
  const { data: firmadas } = await sb.storage.from('referencias').createSignedUrls(data.map(r => r.path), 3600)
  return data.map((r, i) => ({ id: r.id, url: firmadas?.[i]?.signedUrl ?? '' })).filter(r => r.url)
}

/** ¿Está ejecutado fidelidad_niveles.sql? (columnas nuevas de la tarjeta en las clientas) */
export async function fidelidadInstalada(): Promise<boolean> {
  const { error } = await sb.from('clients').select('loyalty_adjustment').limit(1)
  return !(error && /loyalty_/.test(error.message))
}
