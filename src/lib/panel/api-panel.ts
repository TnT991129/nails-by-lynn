import { sb, NEGOCIO_ID } from './supabase-panel'

export type CitaAgenda = {
  id: string; code: string; starts_at: string; ends_at: string; blocked_until: string
  status: string; source: string; total_amount: number; currency: string
  deposit_amount: number; balance_due: number; total_duration_minutes: number
  client_note: string | null; internal_note: string | null
  cliente_nombre: string; cliente_telefono: string; client_id: string
  servicios: string | null
}

export type Cliente = {
  id: string; full_name: string; phone: string; email: string | null; instagram: string | null
  internal_notes: string | null
  total_appointments: number; total_no_shows: number; total_cancellations: number
  total_spent_cup: number; is_blocked: boolean
  last_appointment_at: string | null; first_seen_at: string
}

async function ejecutar<T>(op: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await op
  if (error) throw error
  return data as T
}

// ---------- AGENDA ----------
export function citasEnRango(desde: string, hasta: string) {
  return ejecutar<CitaAgenda[]>(
    sb.from('v_agenda').select('*')
      .eq('business_id', NEGOCIO_ID)
      .gte('starts_at', desde).lt('starts_at', hasta)
      .order('starts_at', { ascending: true })
  )
}

export function cambiarEstadoCita(id: string, nuevoEstado:
  'CONFIRMADA'|'EN_CURSO'|'COMPLETADA'|'NO_SHOW'|'CANCELADA_NEGOCIO') {
  const parche: Record<string, unknown> = { status: nuevoEstado, updated_at: new Date().toISOString() }
  if (nuevoEstado === 'COMPLETADA') parche.completed_at = new Date().toISOString()
  if (nuevoEstado === 'CANCELADA_NEGOCIO') {
    parche.cancelled_at = new Date().toISOString()
    parche.cancelled_by = 'PROFESIONAL'
  }
  return ejecutar(sb.from('appointments').update(parche).eq('id', id).select().single())
}

export function actualizarNotaInterna(id: string, nota: string) {
  return ejecutar(sb.from('appointments').update({ internal_note: nota }).eq('id', id))
}

// ---------- CITA MANUAL ----------
// Reutiliza la funcion crear_cita, pero con origen MANUAL (salta antelacion minima y hold)
export async function crearCitaManual(args: {
  inicio: string
  items: { service_id: string; addons: string[] }[]
  nombre: string; telefono: string; nota?: string
}) {
  const { data, error } = await sb.rpc('crear_cita', {
    p_business_id: NEGOCIO_ID,
    p_session_token: 'manual-' + crypto.randomUUID(),
    p_inicio: args.inicio,
    p_items: args.items,
    p_nombre: args.nombre,
    p_telefono: args.telefono,
    p_email: null, p_instagram: null,
    p_nota: args.nota ?? null,
    p_origen: 'MANUAL',
    p_device_id: null,
  })
  if (error) throw error
  return data as { id: string; code: string; access_token: string }
}

// ---------- BLOQUEOS ----------
export function crearBloqueo(inicio: string, fin: string, motivo: string) {
  return ejecutar(sb.from('blocks').insert({
    business_id: NEGOCIO_ID, starts_at: inicio, ends_at: fin, reason: motivo,
  }).select().single())
}

export function eliminarBloqueo(id: string) {
  return ejecutar(sb.from('blocks').delete().eq('id', id))
}

export function bloqueosEnRango(desde: string, hasta: string) {
  return ejecutar(
    sb.from('blocks').select('*')
      .eq('business_id', NEGOCIO_ID)
      .lt('starts_at', hasta).gt('ends_at', desde)
      .order('starts_at')
  )
}

// ---------- CLIENTAS ----------
export function listarClientas(busqueda?: string) {
  let q = sb.from('clients').select('*').eq('business_id', NEGOCIO_ID)
  if (busqueda) {
    const t = busqueda.trim()
    q = q.or(`full_name.ilike.%${t}%,phone.ilike.%${t}%,instagram.ilike.%${t}%`)
  }
  return ejecutar<Cliente[]>(q.order('last_appointment_at', { ascending: false, nullsFirst: false }).limit(200))
}

export function obtenerClienta(id: string) {
  return ejecutar<Cliente>(sb.from('clients').select('*').eq('id', id).single())
}

export function actualizarNotasInternas(id: string, notas: string) {
  return ejecutar(sb.from('clients').update({ internal_notes: notas }).eq('id', id))
}

export function citasDeClienta(id: string) {
  return ejecutar<CitaAgenda[]>(
    sb.from('v_agenda').select('*')
      .eq('business_id', NEGOCIO_ID).eq('client_id', id)
      .order('starts_at', { ascending: false }).limit(50)
  )
}

// ---------- CATALOGO (para el picker de la cita manual) ----------
export function catalogoServicios() {
  return ejecutar(
    sb.from('services').select('id, name, duration_minutes, price, currency, buffer_after_minutes')
      .eq('business_id', NEGOCIO_ID).eq('is_active', true).order('sort_order')
  )
}

// ---------- DISPONIBILIDAD (reutiliza la funcion publica) ----------
export async function disponibilidad(fecha: string, duracion: number, buffer?: number) {
  const { data, error } = await sb.rpc('obtener_disponibilidad', {
    p_business_id: NEGOCIO_ID, p_fecha: fecha,
    p_duracion_minutos: duracion, p_buffer_minutos: buffer ?? null,
  })
  if (error) throw error
  return ((data ?? []) as { hora: string }[]).map(f => f.hora)
}

// ================== EDITAR SERVICIOS ==================
export type ServicioEdit = {
  id: string; name: string; slug: string;
  description: string | null;
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
  extra_price: number; extra_minutes: number;
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
  // 1) Borrar las reglas actuales del dia
  const { error: e1 } = await sb.from('schedule_rules').delete()
    .eq('business_id', NEGOCIO_ID).eq('weekday', weekday)
  if (e1) throw e1

  // 2) Insertar las nuevas (si hay). Sin turnos = dia cerrado.
  if (turnos.length === 0) return
  const filas = turnos.map(t => ({
    business_id: NEGOCIO_ID, weekday,
    start_time: t.start_time, end_time: t.end_time, is_active: true,
  }))
  const { error: e2 } = await sb.from('schedule_rules').insert(filas)
  if (e2) throw e2
}

// ================== BLOQUEOS ==================
export type Bloqueo = {
  id: string; starts_at: string; ends_at: string; reason: string;
}

export function listarBloqueosFuturos() {
  return ejecutar<Bloqueo[]>(
    sb.from('blocks').select('id, starts_at, ends_at, reason')
      .eq('business_id', NEGOCIO_ID)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at')
  )
}
