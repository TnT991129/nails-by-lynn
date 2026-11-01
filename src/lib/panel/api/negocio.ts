// Servicios, complementos, horarios, días cerrados, turnos, orden, políticas y respaldo.
import { sb, NEGOCIO_ID } from '../supabase-panel'
import { fechaISO, instanteEnHabana } from '../../formato'
import { ejecutar, todasLasFilas } from './base'

// ================== EDITAR SERVICIOS ==================
export type ServicioEdit = {
  id: string; name: string; slug: string;
  description: string | null;
  short_description: string | null;   // la que ve la clienta en la web
  cover_image_url: string | null;
  price: number; currency: string;
  duration_minutes: number; buffer_after_minutes: number;
  is_active: boolean; sort_order: number;
}

export function listarServiciosPanel() {
  return ejecutar<ServicioEdit[]>(
    sb.from('services').select('*')
      .eq('business_id', NEGOCIO_ID).order('sort_order')
  )
}

export function actualizarServicio(id: string, cambios: Partial<ServicioEdit>) {
  return ejecutar(
    sb.from('services').update({ ...cambios, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
  )
}

// ================== EDITAR COMPLEMENTOS ==================
export type ComplementoEdit = {
  id: string; name: string;
  extra_price: number; extra_price_max?: number | null; extra_minutes: number;
  is_active: boolean; sort_order: number;
}

export function listarComplementos() {
  return ejecutar<ComplementoEdit[]>(
    sb.from('service_addons').select('*')
      .eq('business_id', NEGOCIO_ID).order('sort_order')
  )
}

export function actualizarComplemento(id: string, cambios: Partial<ComplementoEdit>) {
  return ejecutar(
    sb.from('service_addons').update(cambios).eq('id', id).select().single()
  )
}

// ================== EDITAR HORARIOS ==================
export type ReglaHorario = {
  id: string; weekday: number;
  start_time: string; end_time: string;
  is_active: boolean;
}

export function listarHorarios() {
  return ejecutar<ReglaHorario[]>(
    sb.from('schedule_rules').select('*')
      .eq('business_id', NEGOCIO_ID).order('weekday')
  )
}

// Reemplaza todas las reglas de un dia por las nuevas (permite dias con varios turnos)
export async function guardarHorariosDia(
  weekday: number,
  turnos: { start_time: string; end_time: string }[]
) {
  // 1) Apuntar las reglas actuales del dia
  const { data: viejas, error: e1 } = await sb.from('schedule_rules').select('id')
    .eq('business_id', NEGOCIO_ID).eq('weekday', weekday)
  if (e1) throw e1

  // 2) Insertar las nuevas primero (sin turnos = dia cerrado): si se corta la conexión aquí,
  //    el día conserva su horario anterior en vez de quedarse cerrado
  if (turnos.length > 0) {
    const filas = turnos.map(t => ({
      business_id: NEGOCIO_ID, weekday,
      start_time: t.start_time, end_time: t.end_time, is_active: true,
    }))
    const { error: e2 } = await sb.from('schedule_rules').insert(filas)
    if (e2) throw e2
  }

  // 3) Borrar las anteriores
  const ids = (viejas ?? []).map(v => v.id as string)
  if (ids.length > 0) {
    const { error: e3 } = await sb.from('schedule_rules').delete().in('id', ids)
    if (e3) throw e3
  }
}

// ================== RESPALDO ==================
export async function exportarRespaldoCompleto() {
  const { data, error } = await sb.rpc('exportar_respaldo', { p_business_id: NEGOCIO_ID })
  if (error) throw error
  return data as Record<string, unknown>
}

// Descargas rápidas por tabla (para abrir en Excel)
export function citasParaCsv() {
  return todasLasFilas<Record<string, unknown>>((desde, hasta) => sb.from('v_agenda').select('*')
    .eq('business_id', NEGOCIO_ID).order('starts_at', { ascending: false }).order('id').range(desde, hasta))
}

export function clientasParaCsv() {
  return todasLasFilas<Record<string, unknown>>((desde, hasta) => sb.from('clients').select(
    'full_name, phone, email, instagram, total_appointments, total_no_shows, total_cancellations, total_spent_cup, first_seen_at, last_appointment_at'
  ).eq('business_id', NEGOCIO_ID)
    .order('total_spent_cup', { ascending: false }).order('id').range(desde, hasta))
}

export function gastosParaCsv() {
  return todasLasFilas<Record<string, unknown>>((desde, hasta) => sb.from('expenses')
    .select('date, category, description, amount, currency')
    .eq('business_id', NEGOCIO_ID).order('date', { ascending: false }).order('id').range(desde, hasta))
}

// ================== CREAR / ELIMINAR SERVICIOS ==================
function slugificar(texto: string): string {
  return texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 60) || 'servicio'
}

export async function crearServicio(args: {
  name: string; description: string | null; short_description?: string | null;
  price: number; duration_minutes: number; buffer_after_minutes: number;
}) {
  // Calcular un sort_order al final
  const { data: max } = await sb.from('services').select('sort_order')
    .eq('business_id', NEGOCIO_ID).order('sort_order', { ascending: false }).limit(1)
  const nextOrder = (max?.[0]?.sort_order ?? 0) + 10

  // Slug único
  const base = slugificar(args.name)
  let slug = base; let intento = 1
  while (intento < 10) {
    const { data } = await sb.from('services').select('id')
      .eq('business_id', NEGOCIO_ID).eq('slug', slug).limit(1)
    if (!data || data.length === 0) break
    intento++; slug = `${base}-${intento}`
  }

  return ejecutar(
    sb.from('services').insert({
      business_id: NEGOCIO_ID, name: args.name, slug,
      description: args.description,
      short_description: args.short_description ?? args.description,
      price: args.price,
      duration_minutes: args.duration_minutes,
      buffer_after_minutes: args.buffer_after_minutes,
      is_active: true, sort_order: nextOrder,
    }).select().single()
  )
}

export async function eliminarServicio(id: string) {
  // Comprobar si tiene citas asociadas
  const { count, error: eCount } = await sb.from('appointment_items')
    .select('*', { count: 'exact', head: true })
    .eq('service_id', id)
  if (eCount) throw eCount

  if ((count ?? 0) > 0) {
    // No lo borramos: solo desactivamos, para no romper historial
    return ejecutar(
      sb.from('services').update({ is_active: false }).eq('id', id).select().single()
    )
  }

  // Sin citas: borrado real
  const { error } = await sb.from('services').delete().eq('id', id)
  if (error) throw error
  return { deleted: true }
}

// ================== CREAR / ELIMINAR COMPLEMENTOS ==================
export async function crearComplemento(args: {
  name: string; extra_price: number; extra_price_max: number | null; extra_minutes: number;
}) {
  const { data: max } = await sb.from('service_addons').select('sort_order')
    .eq('business_id', NEGOCIO_ID).order('sort_order', { ascending: false }).limit(1)
  const nextOrder = (max?.[0]?.sort_order ?? 0) + 10

  return ejecutar(
    sb.from('service_addons').insert({
      business_id: NEGOCIO_ID, name: args.name,
      extra_price: args.extra_price, extra_minutes: args.extra_minutes,
      // Solo se envía si hay rango: así funciona aunque aún no se haya ejecutado el SQL
      ...(args.extra_price_max !== null ? { extra_price_max: args.extra_price_max } : {}),
      is_active: true, sort_order: nextOrder,
    }).select().single()
  )
}

export async function eliminarComplemento(id: string) {
  const { count } = await sb.from('appointment_item_addons')
    .select('*', { count: 'exact', head: true })
    .eq('addon_id', id)
  if ((count ?? 0) > 0) {
    return ejecutar(
      sb.from('service_addons').update({ is_active: false }).eq('id', id).select().single()
    )
  }
  const { error } = await sb.from('service_addons').delete().eq('id', id)
  if (error) throw error
  return { deleted: true }
}

// ================== DÍAS CERRADOS (vacaciones) ==================
// Se guardan en schedule_exceptions tipo CERRADO; intervalos_trabajo ya los respeta.
export type DiaCerrado = { id: string; date_from: string; date_to: string; reason: string | null }

export function listarDiasCerrados() {
  return ejecutar<DiaCerrado[]>(
    sb.from('schedule_exceptions').select('id, date_from, date_to, reason')
      .eq('business_id', NEGOCIO_ID).eq('type', 'CERRADO')
      .gte('date_to', fechaISO(new Date()))
      .order('date_from')
  )
}

export function crearDiasCerrados(desde: string, hasta: string, motivo: string) {
  return ejecutar(sb.from('schedule_exceptions').insert({
    business_id: NEGOCIO_ID, type: 'CERRADO', date_from: desde, date_to: hasta, reason: motivo || null,
  }).select('id').single())
}

export function eliminarDiasCerrados(id: string) {
  return ejecutar(sb.from('schedule_exceptions').delete().eq('id', id))
}

/** Citas activas entre dos fechas (inclusive), en hora de La Habana */
export async function citasActivasEntre(desde: string, hasta: string): Promise<number> {
  const [y, m, d] = hasta.split('-').map(Number)
  const diaSiguiente = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  const { count, error } = await sb.from('appointments').select('id', { count: 'exact', head: true })
    .eq('business_id', NEGOCIO_ID).in('status', ['PENDIENTE', 'CONFIRMADA', 'EN_CURSO'])
    .gte('starts_at', instanteEnHabana(desde, '00:00'))
    .lt('starts_at', instanteEnHabana(diaSiguiente, '00:00'))
  if (error) throw error
  return count ?? 0
}

// ================== TURNOS FIJOS (horas de inicio que ven las clientas) ==================
export async function obtenerTurnosFijos(): Promise<string[]> {
  const { data, error } = await sb.from('settings').select('fixed_slot_times')
    .eq('business_id', NEGOCIO_ID).single()
  if (error) throw error
  return ((data?.fixed_slot_times ?? []) as string[]).map(t => t.slice(0, 5)).sort()
}

export function guardarTurnosFijos(turnos: string[]) {
  const limpios = [...new Set(turnos.filter(Boolean))].sort()
  return ejecutar(sb.from('settings').update({ fixed_slot_times: limpios, updated_at: new Date().toISOString() })
    .eq('business_id', NEGOCIO_ID).select('business_id').single())
}

/** Turnos que caen dentro del horario de apertura de un día */
export function turnosDelDia(reglas: { start_time: string; end_time: string; is_active?: boolean }[], turnos: string[]) {
  return turnos.filter(t => reglas.some(r => r.is_active !== false
    && t >= r.start_time.slice(0, 5) && t < r.end_time.slice(0, 5)))
}

// ================== ORDEN (arrastrar y soltar) ==================
// sort_order = 10, 20, 30… según la posición; solo se actualizan las filas que cambian.
// La web muestra servicios, complementos y fotos ordenados por sort_order.
export async function guardarOrden(
  tabla: 'services' | 'service_addons' | 'gallery_photos',
  filas: { id: string; sort_order: number }[],
) {
  const cambios = filas
    .map((f, i) => ({ id: f.id, antes: f.sort_order, ahora: (i + 1) * 10 }))
    .filter(c => c.antes !== c.ahora)
  const respuestas = await Promise.all(
    cambios.map(c => sb.from(tabla).update({ sort_order: c.ahora }).eq('id', c.id)))
  const fallo = respuestas.find(r => r.error)?.error
  if (fallo) throw fallo
}

// ================== POLÍTICAS (textos y reglas que ve la clienta) ==================
export type AjustesPoliticas = {
  cancel_blocked_hours: number; reschedule_min_hours: number; max_reschedules: number
  max_active_appointments_per_phone: number; max_advance_days: number; min_advance_hours: number
  // Textos libres: [{ titulo, texto }] (supabase/historial/panel_editar_y_politicas.sql); null = textos de siempre
  policy_sections: { titulo: string; texto: string }[] | null
}
const CAMPOS_POLITICAS = 'cancel_blocked_hours, reschedule_min_hours, max_reschedules, ' +
  'max_active_appointments_per_phone, max_advance_days, min_advance_hours, policy_sections'

export function obtenerAjustesPoliticas() {
  return ejecutar<AjustesPoliticas>(sb.from('settings').select(CAMPOS_POLITICAS).eq('business_id', NEGOCIO_ID).single())
}

export function guardarAjustesPoliticas(a: AjustesPoliticas) {
  return ejecutar(sb.from('settings').update({ ...a, updated_at: new Date().toISOString() })
    .eq('business_id', NEGOCIO_ID).select('business_id').single())
}
