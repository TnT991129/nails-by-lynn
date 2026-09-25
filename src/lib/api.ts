import { seleccionar, rpc, NEGOCIO_ID } from './supabase'
import type { Servicio, Addon, Negocio, CitaCreada, CitaDetalle, ItemReserva } from './tipos'

export async function obtenerNegocio(): Promise<Negocio> {
  const filas = await seleccionar<Negocio>('businesses', {
    filtros: { id: `eq.${NEGOCIO_ID}` }, limite: 1,
  })
  if (!filas.length) throw new Error('NEGOCIO_NO_EXISTE')
  return filas[0]
}

export function obtenerServicios(): Promise<Servicio[]> {
  return seleccionar<Servicio>('services', {
    filtros: { business_id: `eq.${NEGOCIO_ID}`, is_active: 'is.true' },
    orden: 'sort_order.asc',
  })
}

export function obtenerAddons(): Promise<Addon[]> {
  return seleccionar<Addon>('service_addons', {
    filtros: { business_id: `eq.${NEGOCIO_ID}`, is_active: 'is.true' },
    orden: 'sort_order.asc',
  })
}

/** Días de la semana (0 = domingo) en que Lynn tiene horario activo */
export async function obtenerDiasLaborables(): Promise<number[]> {
  const filas = await seleccionar<{ weekday: number }>('schedule_rules', {
    select: 'weekday',
    filtros: { business_id: `eq.${NEGOCIO_ID}`, is_active: 'is.true' },
  })
  return [...new Set(filas.map(f => f.weekday))]
}

export async function obtenerDisponibilidad(
  fecha: string, duracionMinutos: number, bufferMinutos?: number,
): Promise<string[]> {
  const filas = await rpc<{ hora: string }[]>('obtener_disponibilidad', {
    p_business_id: NEGOCIO_ID,
    p_fecha: fecha,
    p_duracion_minutos: duracionMinutos,
    p_buffer_minutos: bufferMinutos ?? null,
  })
  return (filas ?? []).map(f => f.hora)
}

export async function crearHold(
  inicio: string, duracionMinutos: number, sesion: string, bufferMinutos?: number,
): Promise<{ hold_id: string; expira_en: string }> {
  const r = await rpc<{ hold_id: string; expira_en: string }[]>('crear_hold', {
    p_business_id: NEGOCIO_ID,
    p_inicio: inicio,
    p_duracion_minutos: duracionMinutos,
    p_session_token: sesion,
    p_buffer_minutos: bufferMinutos ?? null,
  })
  return Array.isArray(r) ? r[0] : r
}

export function crearCita(args: {
  sesion: string; inicio: string; items: ItemReserva[]
  nombre: string; telefono: string; email?: string | null
  instagram?: string | null; nota?: string | null; dispositivo?: string
}): Promise<CitaCreada> {
  return rpc<CitaCreada>('crear_cita', {
    p_business_id: NEGOCIO_ID,
    p_session_token: args.sesion,
    p_inicio: args.inicio,
    p_items: args.items,
    p_nombre: args.nombre,
    p_telefono: args.telefono,
    p_email: args.email ?? null,
    p_instagram: args.instagram ?? null,
    p_nota: args.nota ?? null,
    p_origen: 'WEB',
    p_device_id: args.dispositivo ?? null,
  })
}

export function obtenerCita(token: string): Promise<CitaDetalle> {
  return rpc<CitaDetalle>('obtener_cita_por_token', { p_token: token })
}

export function cancelarCita(token: string, motivo?: string) {
  return rpc<{ ok: boolean; horas_de_antelacion: number; anticipo_reembolsable: boolean }>(
    'cancelar_cita', { p_token: token, p_motivo: motivo ?? null, p_por: 'CLIENTA' })
}

export function reprogramarCita(token: string, nuevoInicio: string, sesion?: string) {
  return rpc<{ ok: boolean; reprogramaciones_usadas: number; maximo: number }>(
    'reprogramar_cita', { p_token: token, p_nuevo_inicio: nuevoInicio, p_session_token: sesion ?? null })
}

// ============ GALERÍA PÚBLICA ============
export type FotoPublica = {
  id: string
  image_url: string
  thumbnail_url: string | null
  alt_text: string | null
  caption: string | null
  service_id: string | null
  is_featured: boolean
  sort_order: number
}

export function obtenerFotosPublicas() {
  return seleccionar<FotoPublica>('gallery_photos', {
    select: 'id,image_url,thumbnail_url,alt_text,caption,service_id,is_featured,sort_order',
    filtros: { is_published: 'is.true' },
    orden: 'sort_order.asc,created_at.desc',
    limite: 200,
  })
}
