// Agenda: citas, reagendar, cita manual, bloqueos, disponibilidad y mensajes de WhatsApp.
import { sb, NEGOCIO_ID } from '../supabase-panel'
import { idAleatorio } from '../../almacenamiento'
import { CitaAgenda, ejecutar } from './base'

// ---------- AGENDA ----------
export function citasEnRango(desde: string, hasta: string) {
  return ejecutar<CitaAgenda[]>(
    sb.from('v_agenda').select('*')
      .eq('business_id', NEGOCIO_ID)
      .gte('starts_at', desde).lt('starts_at', hasta)
      .order('starts_at', { ascending: true })
  )
}

export async function obtenerCitaPanel(id: string): Promise<CitaAgenda> {
  const { data, error } = await sb.from('v_agenda').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('CITA_NO_ENCONTRADA')
  return data as CitaAgenda
}

export function cambiarEstadoCita(id: string, nuevoEstado:
  'CONFIRMADA'|'EN_CURSO'|'COMPLETADA'|'NO_SHOW'|'CANCELADA_NEGOCIO', motivo?: string) {
  const parche: Record<string, unknown> = { status: nuevoEstado, updated_at: new Date().toISOString() }
  // Deshacer «Completada» o «No asistió» (vuelve a CONFIRMADA) también borra la fecha de completada
  parche.completed_at = nuevoEstado === 'COMPLETADA' ? new Date().toISOString() : null
  if (nuevoEstado === 'CANCELADA_NEGOCIO') {
    parche.cancelled_at = new Date().toISOString()
    parche.cancelled_by = 'PROFESIONAL'
    if (motivo) parche.cancellation_reason = motivo
  }
  return ejecutar(sb.from('appointments').update(parche).eq('id', id).select().single())
}

export function actualizarNotaInterna(id: string, nota: string) {
  return ejecutar(sb.from('appointments').update({ internal_note: nota }).eq('id', id))
}

// ---------- REAGENDAR ----------
// Mueve la cita conservando su duración y su margen posterior.
// La restricción EXCLUDE de appointments impide que choque con otra cita.
export async function reagendarCita(cita: CitaAgenda, nuevoInicio: string) {
  const inicio = new Date(nuevoInicio).getTime()
  const margen = new Date(cita.blocked_until).getTime() - new Date(cita.ends_at).getTime()
  const fin = inicio + cita.total_duration_minutes * 60_000
  const { error } = await sb.from('appointments').update({
    starts_at: new Date(inicio).toISOString(),
    ends_at: new Date(fin).toISOString(),
    blocked_until: new Date(fin + margen).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', cita.id).select('id').single()
  if (error) {
    if ((error as { code?: string }).code === '23P01') throw new Error('HORARIO_OCUPADO')
    throw error
  }
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
    p_session_token: 'manual-' + idAleatorio(),
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

// ================== EDITAR SERVICIOS DE UNA CITA ==================
// Servicios y complementos que lleva ahora la cita (por id, para marcarlos al editar)
export async function serviciosDeCita(citaId: string): Promise<{ service_id: string | null; addons: string[] }[]> {
  const { data, error } = await sb.from('appointment_items')
    .select('service_id, sort_order, appointment_item_addons(addon_id)')
    .eq('appointment_id', citaId).order('sort_order')
  if (error) throw error
  return (data ?? []).map(f => ({
    service_id: f.service_id as string | null,
    addons: ((f.appointment_item_addons ?? []) as { addon_id: string | null }[])
      .map(a => a.addon_id).filter((x): x is string => !!x),
  }))
}

// Lynn cambia servicios y complementos (sin plazo). Precio y duración se recalculan en Supabase.
export async function editarCitaPanel(citaId: string, items: { service_id: string; addons: string[] }[], nota: string | null) {
  const { error } = await sb.rpc('editar_cita_panel', { p_appointment_id: citaId, p_items: items, p_nota: nota })
  if (error) throw error
}

// Descuento a una cita ya reservada (0 = quitarlo). Recalcula total y saldo en Supabase.
export async function aplicarDescuentoCita(id: string, porcentaje: number) {
  const { error } = await sb.rpc('aplicar_descuento_cita', { p_appointment_id: id, p_porcentaje: porcentaje })
  if (error) throw error
}

// ================== RECORDATORIOS ==================
// Enlace privado de cada cita (para el mensaje de WhatsApp)
export async function tokensDeCitas(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const { data, error } = await sb.from('appointments').select('id, access_token').in('id', ids)
  if (error) throw error
  return Object.fromEntries((data ?? []).map(f => [f.id as string, f.access_token as string]))
}

// Qué recordatorios ya se mandaron (tabla notifications)
export async function recordatoriosEnviados(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const { data, error } = await sb.from('notifications').select('appointment_id')
    .in('appointment_id', ids).eq('template_key', 'recordatorio').eq('status', 'ENVIADA')
  if (error) throw error
  return (data ?? []).map(f => f.appointment_id as string)
}
