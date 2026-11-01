// Clientas: fichas, contadores, descuentos, fidelidad, cumpleaños, lista de espera y las que tocan volver.
import { sb, NEGOCIO_ID } from '../supabase-panel'
import { fechaISO } from '../../formato'
import { CitaAgenda, Cliente, ejecutar, todasLasFilas } from './base'
import { COBROS_EMBEBIDOS, ConCobros, ganadoCita } from './ganado'
import { tasaParaCobros } from './dinero'

// ---------- CLIENTAS ----------
export function listarClientas(busqueda?: string) {
  let q = sb.from('clients').select('*').eq('business_id', NEGOCIO_ID)
  // Comas, paréntesis y comodines romperían el filtro .or() de PostgREST
  const t = (busqueda ?? '').replace(/[,()*%\\:"]/g, ' ').trim()
  if (t) {
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

export type DatosClienta = {
  full_name: string; phone: string; email: string | null; instagram: string | null
  allergies?: string | null; birthday?: string | null
}

// Mismo formato que usa crear_cita, para que la clienta se reconozca si luego reserva por la web
async function normalizarTelefono(telefono: string): Promise<string> {
  const { data, error } = await sb.rpc('normalizar_telefono', { p: telefono })
  if (error) throw error
  if (!data) throw new Error('TELEFONO_INVALIDO')
  return data as string
}

function errorDeClienta(error: unknown): never {
  if ((error as { code?: string }).code === '23505') throw new Error('TELEFONO_DUPLICADO')
  throw error
}

export async function crearClienta(d: DatosClienta) {
  const phone = await normalizarTelefono(d.phone)
  const { data, error } = await sb.from('clients')
    .insert({ ...d, phone, business_id: NEGOCIO_ID }).select('id').single()
  if (error) errorDeClienta(error)
  return data as { id: string }
}

export async function actualizarClienta(id: string, d: DatosClienta) {
  const phone = await normalizarTelefono(d.phone)
  const { error } = await sb.from('clients').update({ ...d, phone }).eq('id', id).select('id').single()
  if (error) errorDeClienta(error)
}

export function bloquearClienta(id: string, bloqueada: boolean) {
  return ejecutar(sb.from('clients').update({ is_blocked: bloqueada }).eq('id', id).select('id').single())
}

export type ResumenHistorial = { citas: number; activas: number; completadas: number; ingresos: number }

// Lo que se perdería al eliminar a la clienta (se muestra antes de confirmar)
export async function resumenHistorialClienta(id: string): Promise<ResumenHistorial> {
  const filas = await ejecutar<(ConCobros & { status: string; blocked_until: string })[]>(
    sb.from('appointments').select(`status, total_amount, blocked_until, ${COBROS_EMBEBIDOS}`).eq('client_id', id))
  const ahora = Date.now()
  const completadas = filas.filter(f => f.status === 'COMPLETADA')
  const tasa = await tasaParaCobros(completadas)
  return {
    citas: filas.length,
    // Mismo criterio que la función SQL: citas activas que aún no han terminado
    activas: filas.filter(f => ['PENDIENTE','CONFIRMADA','EN_CURSO'].includes(f.status)
      && new Date(f.blocked_until).getTime() > ahora).length,
    completadas: completadas.length,
    ingresos: completadas.reduce((t, f) => t + ganadoCita(f, tasa).real, 0),
  }
}

// Borra la clienta y todo su historial (función eliminar_clienta_con_historial en Supabase)
export async function eliminarClientaConHistorial(id: string) {
  const { error } = await sb.rpc('eliminar_clienta_con_historial', { p_client_id: id })
  if (error) throw error
}

export function citasDeClienta(id: string) {
  return ejecutar<CitaAgenda[]>(
    sb.from('v_agenda').select('*')
      .eq('business_id', NEGOCIO_ID).eq('client_id', id)
      .order('starts_at', { ascending: false }).limit(50)
  )
}

// ================== LISTA DE ESPERA ==================
export type EnEspera = {
  id: string; preferred_date_from: string; created_at: string; notified_at: string | null
  clients: { full_name: string; phone: string } | null
  services: { name: string } | null
}

// Las relaciones muchos-a-uno llegan como objeto; sin tipos de la BD, supabase-js las declara como lista
export const unaFila = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export async function listarListaEspera(): Promise<EnEspera[]> {
  const { data, error } = await sb.from('waitlist')
    .select('id, preferred_date_from, created_at, notified_at, clients(full_name, phone), services(name)')
    .eq('business_id', NEGOCIO_ID).eq('status', 'ACTIVA')
    .gte('preferred_date_from', fechaISO(new Date()))
    .order('preferred_date_from').order('created_at')
  if (error) throw error
  return (data ?? []).map(f => ({ ...f, clients: unaFila(f.clients), services: unaFila(f.services) }))
}

export function marcarAvisoEspera(id: string) {
  return ejecutar(sb.from('waitlist').update({ notified_at: new Date().toISOString() }).eq('id', id))
}

export function quitarDeEspera(id: string) {
  return ejecutar(sb.from('waitlist').update({ status: 'CERRADA' }).eq('id', id))
}

// ================== CONTADORES POR CLIENTA ==================
// Calculados desde sus citas: cancelaciones hechas por ella y cambios de fecha que hizo ella misma.
export type ContadoresClienta = {
  citas: number       // todas las que no se cancelaron (reservadas, hechas, faltas)
  proximas: number    // reservadas que aún no han pasado
  canceladas: number; reagendadas: number; noAsistio: number
}

export async function contadoresClientas(): Promise<Record<string, ContadoresClienta>> {
  const data = await todasLasFilas((desde, hasta) => sb.from('appointments')
    .select('client_id, status, reschedule_count, starts_at')
    .eq('business_id', NEGOCIO_ID).order('id').range(desde, hasta))
  const r: Record<string, ContadoresClienta> = {}
  const ahora = Date.now()
  for (const f of data as { client_id: string; status: string; reschedule_count: number; starts_at: string }[]) {
    const c = (r[f.client_id] ??= { citas: 0, proximas: 0, canceladas: 0, reagendadas: 0, noAsistio: 0 })
    const cancelada = f.status === 'CANCELADA_CLIENTA' || f.status === 'CANCELADA_NEGOCIO'
    if (!cancelada) c.citas++
    if (['PENDIENTE', 'CONFIRMADA'].includes(f.status) && new Date(f.starts_at).getTime() > ahora) c.proximas++
    if (f.status === 'CANCELADA_CLIENTA') c.canceladas++
    if (f.status === 'NO_SHOW') c.noAsistio++
    c.reagendadas += f.reschedule_count ?? 0
  }
  return r
}

// ================== DESCUENTO PARA LA PRÓXIMA CITA ==================
export function aplicarDescuento(id: string, porcentaje: number, nota: string | null) {
  return ejecutar(sb.from('clients').update({
    next_discount_percent: porcentaje, next_discount_note: nota, next_discount_at: new Date().toISOString(),
  }).eq('id', id).select('id').single())
}

export function quitarDescuento(id: string) {
  return ejecutar(sb.from('clients').update({
    next_discount_percent: null, next_discount_note: null, next_discount_at: null,
  }).eq('id', id).select('id').single())
}

// ================== TARJETA DE FIDELIDAD DE UNA CLIENTA ==================
/** Sellos de más (o de menos) que Lynn le pone a mano: se suman a sus citas completadas */
export function ajustarSellos(id: string, ajuste: number) {
  return ejecutar(sb.from('clients').update({ loyalty_adjustment: Math.round(ajuste) }).eq('id', id).select('id').single())
}

/** Sacar a una clienta de la tarjeta (o volver a meterla) */
export function excluirDeFidelidad(id: string, fuera: boolean) {
  return ejecutar(sb.from('clients').update({ loyalty_excluded: fuera }).eq('id', id).select('id').single())
}

// ================== CUMPLEAÑOS ==================
export type Cumple = { id: string; full_name: string; phone: string; birthday: string; dias: number }

// Clientas que cumplen años en los próximos `dias` días (0 = hoy)
export async function cumpleanosProximos(dias = 7): Promise<Cumple[]> {
  const { data, error } = await sb.from('clients').select('id, full_name, phone, birthday')
    .eq('business_id', NEGOCIO_ID).not('birthday', 'is', null)
  if (error) {
    if (String(error.message).includes('birthday')) return []   // aún sin el SQL de mejoras
    throw error
  }
  const hoy = new Date(fechaISO(new Date()) + 'T12:00:00Z')
  return (data ?? []).filter(c => typeof c.birthday === 'string' && c.birthday.length >= 10).map(c => {
    const [, m, d] = (c.birthday as string).split('-').map(Number)
    let prox = new Date(Date.UTC(hoy.getUTCFullYear(), m - 1, d, 12))
    if (prox < hoy) prox = new Date(Date.UTC(hoy.getUTCFullYear() + 1, m - 1, d, 12))
    return {
      id: c.id as string, full_name: c.full_name as string, phone: c.phone as string,
      birthday: c.birthday as string, dias: Math.round((prox.getTime() - hoy.getTime()) / 86_400_000),
    }
  }).filter(c => c.dias <= dias).sort((a, b) => a.dias - b.dias)
}

// ================== CLIENTAS PARA VOLVER ==================
export type ParaVolver = { id: string; full_name: string; phone: string; dias: number }

// Clientas cuya última cita completada fue hace entre `desde` y `hasta` días y que no tienen otra reservada
export async function clientasParaVolver(desde = 21, hasta = 56): Promise<ParaVolver[]> {
  const ahora = Date.now(), dia = 86_400_000
  const clientas = await ejecutar<{ id: string; full_name: string; phone: string; last_appointment_at: string }[]>(
    sb.from('clients').select('id, full_name, phone, last_appointment_at')
      .eq('business_id', NEGOCIO_ID).eq('is_blocked', false)
      .lte('last_appointment_at', new Date(ahora - desde * dia).toISOString())
      .gte('last_appointment_at', new Date(ahora - hasta * dia).toISOString()))
  if (clientas.length === 0) return []
  const conCita = await ejecutar<{ client_id: string }[]>(sb.from('appointments').select('client_id')
    .eq('business_id', NEGOCIO_ID).in('status', ['PENDIENTE', 'CONFIRMADA', 'EN_CURSO'])
    .gte('starts_at', new Date(ahora).toISOString()))
  const reservadas = new Set(conCita.map(c => c.client_id))
  return clientas.filter(c => !reservadas.has(c.id))
    .map(c => ({ id: c.id, full_name: c.full_name, phone: c.phone,
                 dias: Math.floor((ahora - Date.parse(c.last_appointment_at)) / dia) }))
    .sort((a, b) => a.dias - b.dias)
}

// ================== RECOMENDACIONES (supabase/recomendaciones_y_bonos.sql) ==================
/** ¿Está ejecutado el SQL? (columna referred_by en las clientas) */
export async function recomendacionesInstaladas(): Promise<boolean> {
  const { error } = await sb.from('clients').select('referred_by').limit(1)
  return !(error && /referred_by/.test(error.message))
}

export type Recomendacion = {
  id: string; nombre: string; quien_id: string; quien_nombre: string
  premiada: boolean; vino: boolean; desde: string
}

// Todas las clientas que vinieron recomendadas, con quién las trajo; las más recientes primero
export async function listaRecomendaciones(): Promise<Recomendacion[]> {
  const filas = await ejecutar<{ id: string; full_name: string; referred_by: string; referral_rewarded_at: string | null;
                                 total_appointments: number; first_seen_at: string }[]>(
    sb.from('clients').select('id, full_name, referred_by, referral_rewarded_at, total_appointments, first_seen_at')
      .eq('business_id', NEGOCIO_ID).not('referred_by', 'is', null).order('first_seen_at', { ascending: false }))
  if (filas.length === 0) return []
  const quienes = await ejecutar<{ id: string; full_name: string }[]>(
    sb.from('clients').select('id, full_name').in('id', [...new Set(filas.map(f => f.referred_by))]))
  const nombre = new Map(quienes.map(q => [q.id, q.full_name]))
  return filas.map(f => ({
    id: f.id, nombre: f.full_name, quien_id: f.referred_by, quien_nombre: nombre.get(f.referred_by) ?? '—',
    premiada: !!f.referral_rewarded_at, vino: f.total_appointments > 0, desde: f.first_seen_at,
  }))
}

/** Lynn apunta a mano quién la recomendó (por teléfono) o lo quita (null) */
export async function ponerRecomendacion(id: string, telefono: string | null) {
  let quien: string | null = null
  if (telefono) {
    const phone = await normalizarTelefono(telefono)
    const c = await ejecutar<{ id: string } | null>(sb.from('clients').select('id')
      .eq('business_id', NEGOCIO_ID).eq('phone', phone).neq('id', id).maybeSingle())
    if (!c) throw new Error('CLIENTA_NO_ENCONTRADA')
    quien = c.id
  }
  return ejecutar(sb.from('clients').update({ referred_by: quien }).eq('id', id).select('id').single())
}

export function recomendadasPor(id: string) {
  return ejecutar<{ id: string; full_name: string; referral_rewarded_at: string | null }[]>(
    sb.from('clients').select('id, full_name, referral_rewarded_at').eq('referred_by', id).order('first_seen_at'))
}
