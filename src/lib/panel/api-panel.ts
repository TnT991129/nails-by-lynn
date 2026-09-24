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

// ================== NOTIFICACIONES (wa.me asistido) ==================
export type NotifRegistro = {
  id: string; template_key: string;
  scheduled_for: string; status: string;
  sent_at: string | null;
}

// Ver que mensajes ya se enviaron para una cita
export function notifsDeCita(appointment_id: string) {
  return ejecutar<NotifRegistro[]>(
    sb.from('notifications').select('id, template_key, scheduled_for, status, sent_at')
      .eq('appointment_id', appointment_id)
      .order('scheduled_for')
  )
}

// Registrar que Lynn envió un mensaje (marca la fila existente o crea una nueva)
export async function registrarEnvio(
  appointment_id: string,
  template_key: string,
  rendered_message: string,
  recipient_phone: string,
) {
  // Buscar si ya existe una fila PENDIENTE con esta plantilla
  const { data: existentes } = await sb.from('notifications')
    .select('id')
    .eq('appointment_id', appointment_id)
    .eq('template_key', template_key)
    .eq('status', 'PENDIENTE')
    .limit(1)

  if (existentes && existentes.length > 0) {
    // Marcar la existente como enviada
    const { error } = await sb.from('notifications')
      .update({ status: 'ENVIADA', sent_at: new Date().toISOString(),
                sent_by: (await sb.auth.getUser()).data.user?.id })
      .eq('id', existentes[0].id)
    if (error) throw error
    return
  }

  // Crear una nueva fila ya enviada (para mensajes manuales como "retraso" o "gracias")
  const { error } = await sb.from('notifications').insert({
    business_id: NEGOCIO_ID,
    appointment_id,
    recipient_type: 'CLIENTA',
    recipient_phone,
    channel: 'WHATSAPP_ASISTIDO',
    template_key,
    rendered_message,
    scheduled_for: new Date().toISOString(),
    status: 'ENVIADA',
    sent_at: new Date().toISOString(),
    sent_by: (await sb.auth.getUser()).data.user?.id,
  })
  if (error) throw error
}

// ================== ESTADÍSTICAS ==================
// Todas las estadísticas se computan sobre appointments completadas del mes.
// Los precios están en price_snapshot para que subir precios no distorsione
// el histórico.

export type ResumenMes = {
  ingresos: number
  gastos: number
  neto: number
  citas_completadas: number
  citas_no_show: number
  citas_canceladas: number
  ticket_promedio: number
  clientas_atendidas: number
  moneda: string
}

export type FilaServicio = { nombre: string; cantidad: number; ingresos: number }
export type FilaClienta = { id: string; nombre: string; visitas: number; gastado: number }

// Devuelve un rango [ini, fin) que cubre un mes en hora local Havana
function rangoMes(año: number, mesCero: number) {
  const ini = new Date(Date.UTC(año, mesCero, 1, 4, 0, 0))  // Havana ~ UTC-4/-5
  const fin = new Date(Date.UTC(año, mesCero + 1, 1, 4, 0, 0))
  return { ini: ini.toISOString(), fin: fin.toISOString() }
}

export async function resumenMes(año: number, mesCero: number): Promise<ResumenMes> {
  const { ini, fin } = rangoMes(año, mesCero)

  // Traer todas las citas del mes (para contar completadas, no-shows, canceladas)
  const { data: citas, error: eCit } = await sb.from('appointments')
    .select('id, status, client_id, total_amount, currency, starts_at')
    .eq('business_id', NEGOCIO_ID)
    .gte('starts_at', ini).lt('starts_at', fin)
  if (eCit) throw eCit

  // Traer gastos del mes
  const iniFecha = ini.slice(0, 10), finFecha = fin.slice(0, 10)
  const { data: gastos, error: eG } = await sb.from('expenses')
    .select('amount, currency')
    .eq('business_id', NEGOCIO_ID)
    .gte('date', iniFecha).lt('date', finFecha)
  if (eG) throw eG

  const completadas = (citas ?? []).filter(c => c.status === 'COMPLETADA')
  const ingresos = completadas.reduce((t, c) => t + Number(c.total_amount), 0)
  const totalGastos = (gastos ?? []).reduce((t, g) => t + Number(g.amount), 0)
  const clientasSet = new Set(completadas.map(c => c.client_id))

  return {
    ingresos,
    gastos: totalGastos,
    neto: ingresos - totalGastos,
    citas_completadas: completadas.length,
    citas_no_show: (citas ?? []).filter(c => c.status === 'NO_SHOW').length,
    citas_canceladas: (citas ?? []).filter(c =>
      c.status === 'CANCELADA_CLIENTA' || c.status === 'CANCELADA_NEGOCIO').length,
    ticket_promedio: completadas.length > 0 ? ingresos / completadas.length : 0,
    clientas_atendidas: clientasSet.size,
    moneda: 'CUP',
  }
}

// Top servicios del mes
export async function topServiciosMes(año: number, mesCero: number, limite = 5): Promise<FilaServicio[]> {
  const { ini, fin } = rangoMes(año, mesCero)
  const { data, error } = await sb.from('appointment_items')
    .select('service_name_snapshot, price_snapshot, appointment_id, appointments!inner(status, starts_at, business_id)')
    .eq('appointments.business_id', NEGOCIO_ID)
    .eq('appointments.status', 'COMPLETADA')
    .gte('appointments.starts_at', ini).lt('appointments.starts_at', fin)
  if (error) throw error

  // Agrupar por nombre
  const acc = new Map<string, { cantidad: number; ingresos: number }>()
  for (const fila of (data ?? [])) {
    const nombre = fila.service_name_snapshot as string
    const precio = Number(fila.price_snapshot)
    const cur = acc.get(nombre) ?? { cantidad: 0, ingresos: 0 }
    cur.cantidad++; cur.ingresos += precio
    acc.set(nombre, cur)
  }

  return Array.from(acc.entries())
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, limite)
}

// Top clientas del mes
export async function topClientasMes(año: number, mesCero: number, limite = 5): Promise<FilaClienta[]> {
  const { ini, fin } = rangoMes(año, mesCero)
  const { data, error } = await sb.from('appointments')
    .select('client_id, total_amount, clients!inner(id, full_name)')
    .eq('business_id', NEGOCIO_ID)
    .eq('status', 'COMPLETADA')
    .gte('starts_at', ini).lt('starts_at', fin)
  if (error) throw error

  const acc = new Map<string, { nombre: string; visitas: number; gastado: number }>()
  for (const fila of (data ?? [])) {
    const id = fila.client_id as string
    const nombre = (fila.clients as unknown as { full_name: string }).full_name
    const monto = Number(fila.total_amount)
    const cur = acc.get(id) ?? { nombre, visitas: 0, gastado: 0 }
    cur.visitas++; cur.gastado += monto
    acc.set(id, cur)
  }

  return Array.from(acc.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.gastado - a.gastado)
    .slice(0, limite)
}

// ================== GASTOS ==================
export type Gasto = {
  id: string; date: string; category: string;
  description: string | null; amount: number; currency: string;
}

export type CategoriaGasto = 'MATERIAL'|'HERRAMIENTAS'|'LOCAL'|'TRANSPORTE'|'MARKETING'|'OTRO'

export function listarGastos(limite = 100) {
  return ejecutar<Gasto[]>(
    sb.from('expenses').select('id, date, category, description, amount, currency')
      .eq('business_id', NEGOCIO_ID)
      .order('date', { ascending: false }).limit(limite)
  )
}

export function crearGasto(args: {
  date: string; category: CategoriaGasto; description: string;
  amount: number; currency: 'CUP' | 'USD';
}) {
  return ejecutar(
    sb.from('expenses').insert({
      business_id: NEGOCIO_ID, ...args,
    }).select().single()
  )
}

export function eliminarGasto(id: string) {
  return ejecutar(sb.from('expenses').delete().eq('id', id))
}

// ================== RESPALDO ==================
export async function exportarRespaldoCompleto() {
  const { data, error } = await sb.rpc('exportar_respaldo', { p_business_id: NEGOCIO_ID })
  if (error) throw error
  return data as Record<string, unknown>
}

// Descargas rápidas por tabla (para abrir en Excel)
export async function citasParaCsv() {
  const { data, error } = await sb.from('v_agenda').select('*')
    .eq('business_id', NEGOCIO_ID).order('starts_at', { ascending: false })
  if (error) throw error
  return data as Record<string, unknown>[]
}

export async function clientasParaCsv() {
  const { data, error } = await sb.from('clients').select(
    'full_name, phone, email, instagram, total_appointments, total_no_shows, total_cancellations, total_spent_cup, first_seen_at, last_appointment_at'
  ).eq('business_id', NEGOCIO_ID)
    .order('total_spent_cup', { ascending: false })
  if (error) throw error
  return data as Record<string, unknown>[]
}

export async function gastosParaCsv() {
  const { data, error } = await sb.from('expenses').select('date, category, description, amount, currency')
    .eq('business_id', NEGOCIO_ID).order('date', { ascending: false })
  if (error) throw error
  return data as Record<string, unknown>[]
}
