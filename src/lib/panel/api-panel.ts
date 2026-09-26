import { sb, NEGOCIO_ID } from './supabase-panel'
import { fechaISO, instanteEnHabana } from '../formato'
import { reducirImagen } from './imagen'

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

export type DatosClienta = {
  full_name: string; phone: string; email: string | null; instagram: string | null
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
  const filas = await ejecutar<{ status: string; total_amount: number; blocked_until: string }[]>(
    sb.from('appointments').select('status, total_amount, blocked_until').eq('client_id', id))
  const ahora = Date.now()
  const completadas = filas.filter(f => f.status === 'COMPLETADA')
  return {
    citas: filas.length,
    // Mismo criterio que la función SQL: citas activas que aún no han terminado
    activas: filas.filter(f => ['PENDIENTE','CONFIRMADA','EN_CURSO'].includes(f.status)
      && new Date(f.blocked_until).getTime() > ahora).length,
    completadas: completadas.length,
    ingresos: completadas.reduce((t, f) => t + Number(f.total_amount), 0),
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

// ================== GALERÍA (panel) ==================
export type FotoPanel = {
  id: string; image_url: string; thumbnail_url: string | null;
  alt_text: string | null; caption: string | null;
  service_id: string | null;
  has_consent: boolean; is_featured: boolean; is_published: boolean;
  sort_order: number; created_at: string;
}

// Subir un archivo al bucket 'galeria' y devolver su URL pública.
// Antes se reduce en el móvil (maxLado px, WebP) para ahorrar datos al subir y al ver.
export async function subirImagen(original: File, maxLado = 1600): Promise<{ url: string; path: string }> {
  const archivo = await reducirImagen(original, maxLado)
  const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const nombre = `${crypto.randomUUID()}.${ext}`
  const path = `${NEGOCIO_ID}/${nombre}`

  const { error } = await sb.storage.from('galeria').upload(path, archivo, {
    cacheControl: '31536000',
    upsert: false,
    contentType: archivo.type,
  })
  if (error) throw error

  const { data } = sb.storage.from('galeria').getPublicUrl(path)
  return { url: data.publicUrl, path }
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
  name: string; extra_price: number; extra_minutes: number;
}) {
  const { data: max } = await sb.from('service_addons').select('sort_order')
    .eq('business_id', NEGOCIO_ID).order('sort_order', { ascending: false }).limit(1)
  const nextOrder = (max?.[0]?.sort_order ?? 0) + 10

  return ejecutar(
    sb.from('service_addons').insert({
      business_id: NEGOCIO_ID, name: args.name,
      extra_price: args.extra_price, extra_minutes: args.extra_minutes,
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

// ================== LISTA DE ESPERA ==================
export type EnEspera = {
  id: string; preferred_date_from: string; created_at: string; notified_at: string | null
  clients: { full_name: string; phone: string } | null
  services: { name: string } | null
}

// Las relaciones muchos-a-uno llegan como objeto; sin tipos de la BD, supabase-js las declara como lista
const unaFila = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

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
