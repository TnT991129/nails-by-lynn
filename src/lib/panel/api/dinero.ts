// Dinero: estadísticas, gastos, precio del dólar, cobros y resumen semanal.
import { sb, NEGOCIO_ID } from '../supabase-panel'
import { fechaISO, instanteEnHabana } from '../../formato'
import { CitaAgenda, ejecutar } from './base'
import { Cobro, CobroEmbebido, COBROS_EMBEBIDOS, cobrosValidos, ConCobros, ganadoCita, MetodoCobro } from './ganado'

// ================== ESTADÍSTICAS ==================
// Todas las estadísticas se computan sobre appointments completadas del mes, con lo que Lynn
// cobró de verdad (ganadoCita). Si no apuntó el cobro, cuenta el precio estimado de los servicios
// (price_snapshot: subir precios no distorsiona el histórico).

export type ResumenMes = {
  ingresos: number
  cobrado: number          // de las citas con cobro apuntado
  sin_cobro: number        // citas completadas sin cobro apuntado (cuentan por su precio estimado)
  sin_cobro_estimado: number
  sobre_estimado: number   // lo cobrado menos lo estimado en las citas con cobro (+ cobró más, − cobró menos)
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
  const p = (n: number) => String(n).padStart(2, '0')
  const sig = new Date(Date.UTC(año, mesCero + 1, 1))
  const diaIni = `${año}-${p(mesCero + 1)}-01`
  const diaFin = `${sig.getUTCFullYear()}-${p(sig.getUTCMonth() + 1)}-01`
  return { ini: instanteEnHabana(diaIni, '00:00'), fin: instanteEnHabana(diaFin, '00:00'), diaIni, diaFin }
}

export async function resumenMes(año: number, mesCero: number): Promise<ResumenMes> {
  const { ini, fin, diaIni, diaFin } = rangoMes(año, mesCero)

  // Traer todas las citas del mes (para contar completadas, no-shows, canceladas)
  const { data: citas, error: eCit } = await sb.from('appointments')
    .select(`id, status, client_id, total_amount, currency, starts_at, ${COBROS_EMBEBIDOS}`)
    .eq('business_id', NEGOCIO_ID)
    .gte('starts_at', ini).lt('starts_at', fin)
  if (eCit) throw eCit
  const filas = (citas ?? []) as unknown as (ConCobros & { status: string; client_id: string })[]

  // Traer gastos del mes
  const { data: gastos, error: eG } = await sb.from('expenses')
    .select('amount, currency, exchange_rate_used')
    .eq('business_id', NEGOCIO_ID)
    .gte('date', diaIni).lt('date', diaFin)
  if (eG) throw eG

  const completadas = filas.filter(c => c.status === 'COMPLETADA')
  const tasaCobros = await tasaParaCobros(completadas)
  const ganado = completadas.map(c => ganadoCita(c, tasaCobros))
  const ingresos = ganado.reduce((t, g) => t + g.real, 0)
  const conCobro = ganado.filter(g => g.cobrada), sinCobro = ganado.filter(g => !g.cobrada)
  // Todo en dólares: los gastos en CUP se convierten con el dólar del día en que se apuntaron
  // (los antiguos, que no lo guardaban, con el último precio del dólar)
  const tasa = (gastos ?? []).some(g => g.currency === 'CUP' && !g.exchange_rate_used)
    ? (await obtenerTasaPanel())?.tasa : undefined
  const totalGastos = (gastos ?? []).reduce((t, g) => {
    if (g.currency !== 'CUP') return t + Number(g.amount)
    const tg = Number(g.exchange_rate_used ?? tasa ?? 0)
    return t + (tg > 0 ? Number(g.amount) / tg : 0)
  }, 0)
  const clientasSet = new Set(completadas.map(c => c.client_id))

  return {
    ingresos,
    cobrado: conCobro.reduce((t, g) => t + g.cobrado, 0),
    sin_cobro: sinCobro.length,
    sin_cobro_estimado: sinCobro.reduce((t, g) => t + g.estimado, 0),
    sobre_estimado: conCobro.reduce((t, g) => t + g.cobrado - g.estimado, 0),
    gastos: totalGastos,
    neto: ingresos - totalGastos,
    citas_completadas: completadas.length,
    citas_no_show: filas.filter(c => c.status === 'NO_SHOW').length,
    citas_canceladas: filas.filter(c =>
      c.status === 'CANCELADA_CLIENTA' || c.status === 'CANCELADA_NEGOCIO').length,
    ticket_promedio: completadas.length > 0 ? ingresos / completadas.length : 0,
    clientas_atendidas: clientasSet.size,
    moneda: 'USD',
  }
}

// Top servicios del mes
export async function topServiciosMes(año: number, mesCero: number, limite = 5): Promise<FilaServicio[]> {
  const { ini, fin } = rangoMes(año, mesCero)
  const { data, error } = await sb.from('appointment_items')
    .select(`service_name_snapshot, price_snapshot, appointment_id,
             appointments!inner(status, starts_at, business_id, total_amount, ${COBROS_EMBEBIDOS})`)
    .eq('appointments.business_id', NEGOCIO_ID)
    .eq('appointments.status', 'COMPLETADA')
    .gte('appointments.starts_at', ini).lt('appointments.starts_at', fin)
  if (error) throw error
  type Fila = { service_name_snapshot: string; price_snapshot: number; appointment_id: string; appointments: ConCobros }
  const filas = (data ?? []) as unknown as Fila[]

  // Lo cobrado en cada cita se reparte entre sus servicios según lo que pesa cada uno en el precio
  const porCita = new Map<string, Fila[]>()
  for (const f of filas) porCita.set(f.appointment_id, [...(porCita.get(f.appointment_id) ?? []), f])
  const tasa = await tasaParaCobros(filas.map(f => f.appointments))

  const acc = new Map<string, { cantidad: number; ingresos: number }>()
  for (const items of porCita.values()) {
    const real = ganadoCita(items[0].appointments, tasa).real
    const suma = items.reduce((t, f) => t + Number(f.price_snapshot), 0)
    for (const f of items) {
      const parte = suma > 0 ? real * Number(f.price_snapshot) / suma : real / items.length
      const cur = acc.get(f.service_name_snapshot) ?? { cantidad: 0, ingresos: 0 }
      cur.cantidad++; cur.ingresos += parte
      acc.set(f.service_name_snapshot, cur)
    }
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
    .select(`client_id, total_amount, clients!inner(id, full_name), ${COBROS_EMBEBIDOS}`)
    .eq('business_id', NEGOCIO_ID)
    .eq('status', 'COMPLETADA')
    .gte('starts_at', ini).lt('starts_at', fin)
  if (error) throw error
  const filas = (data ?? []) as unknown as (ConCobros & { client_id: string; clients: { full_name: string } })[]
  const tasa = await tasaParaCobros(filas)

  const acc = new Map<string, { nombre: string; visitas: number; gastado: number }>()
  for (const fila of filas) {
    const id = fila.client_id
    const nombre = fila.clients.full_name
    const monto = ganadoCita(fila, tasa).real
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

export async function crearGasto(args: {
  date: string; category: CategoriaGasto; description: string;
  amount: number; currency: 'CUP' | 'USD';
}) {
  // Se guarda el dólar de ese momento para que las estadísticas no cambien al actualizarlo
  const tasa = args.currency === 'CUP' ? (await obtenerTasaPanel())?.tasa ?? null : null
  return ejecutar(
    sb.from('expenses').insert({
      business_id: NEGOCIO_ID, ...args, exchange_rate_used: tasa,
    }).select().single()
  )
}

export function eliminarGasto(id: string) {
  return ejecutar(sb.from('expenses').delete().eq('id', id))
}

// ================== PRECIO DEL DÓLAR ==================
// Lynn pone cada día cuántos CUP vale 1 USD; uno por día (se sobrescribe si lo cambia)

export async function obtenerTasaPanel(): Promise<{ tasa: number; fecha: string } | null> {
  const { data, error } = await sb.from('exchange_rates')
    .select('cup_per_usd, effective_date')
    .eq('business_id', NEGOCIO_ID)
    .order('effective_date', { ascending: false })
    .limit(1).maybeSingle()
  if (error) throw error
  return data ? { tasa: Number(data.cup_per_usd), fecha: data.effective_date } : null
}

export async function guardarTasa(cupPorUsd: number) {
  const { error } = await sb.from('exchange_rates').upsert({
    business_id: NEGOCIO_ID,
    effective_date: fechaISO(new Date()),   // hoy en La Habana
    cup_per_usd: cupPorUsd,
  }, { onConflict: 'business_id,effective_date' })
  if (error) throw error
}

// ================== COBROS ==================
// Tipos, paso a dólares y «lo que se ganó» de cada cita: en ganado.ts
export async function cobrosDeCita(citaId: string): Promise<Cobro[]> {
  const pedir = (campos: string) => sb.from('payments').select(campos)
    .eq('appointment_id', citaId).eq('status', 'PAGADO_COMPLETO').order('created_at')
  const base = 'id, amount, currency, method, exchange_rate_used, created_at'
  const { data, error } = await pedir(`${base}, gift_cards(code)`)
  if (error) {
    if (!/gift_card/.test(error.message)) throw error
    const sinBonos = await pedir(base)   // aún sin el SQL de bonos
    if (sinBonos.error) throw sinBonos.error
    return sinBonos.data as unknown as Cobro[]
  }
  return (data as unknown as (Cobro & { gift_cards: { code: string } | null })[])
    .map(({ gift_cards, ...c }) => ({ ...c, bono: gift_cards?.code ?? null }))
}

export async function registrarCobro(args: {
  citaId: string; monto: number; moneda: 'CUP' | 'USD'; metodo: MetodoCobro; tasa: number | null
  bonoId?: string | null   // pagado con un bono regalo
}) {
  // La base exige que un pago verificado diga quién lo verificó (regla pa_verificacion):
  // es Lynn, la usuaria con la sesión abierta en el panel.
  const { data: { session } } = await sb.auth.getSession()
  const yo = session?.user.id ?? null
  return ejecutar(sb.from('payments').insert({
    business_id: NEGOCIO_ID, appointment_id: args.citaId, type: 'PAGO_TOTAL',
    amount: args.monto, currency: args.moneda, method: args.metodo,
    exchange_rate_used: args.moneda === 'CUP' ? args.tasa : null,
    status: 'PAGADO_COMPLETO',
    verified_by: yo, verified_at: yo ? new Date().toISOString() : null,
    ...(args.bonoId ? { gift_card_id: args.bonoId, reference: 'Bono regalo' } : {}),
  }).select('id').single())
}

export function eliminarCobro(id: string) {
  return ejecutar(sb.from('payments').delete().eq('id', id))
}

// El dólar actual solo hace falta para cobros en CUP antiguos que no guardaron el suyo
export async function tasaParaCobros(citas: ConCobros[]): Promise<number | null> {
  return citas.some(c => cobrosValidos(c).some(p => p.currency === 'CUP' && !p.exchange_rate_used))
    ? (await obtenerTasaPanel())?.tasa ?? null : null
}

// Lo ganado en unas citas de la agenda (v_agenda no trae los cobros: se piden aparte)
export async function ganadoEnCitas(citas: Pick<CitaAgenda, 'id' | 'total_amount'>[]): Promise<number> {
  if (citas.length === 0) return 0
  const pagos = await ejecutar<(CobroEmbebido & { appointment_id: string })[]>(sb.from('payments')
    .select('appointment_id, amount, currency, exchange_rate_used, status')
    .in('appointment_id', citas.map(c => c.id)))
  const conCobros = citas.map(c => ({ total_amount: Number(c.total_amount), payments: pagos.filter(p => p.appointment_id === c.id) }))
  const tasa = await tasaParaCobros(conCobros)
  return conCobros.reduce((t, c) => t + ganadoCita(c, tasa).real, 0)
}

// ================== BONOS REGALO (supabase/historial/recomendaciones_y_bonos.sql) ==================
// Lynn los vende en dólares; cada canje es un cobro de una cita con gift_card_id. La base de datos impide
// gastar más del saldo (tg_canje_bono). Lo canjeado cuenta como ingreso de la cita, como cualquier cobro.
export type Bono = {
  id: string; code: string; amount: number; buyer_name: string | null; recipient_name: string | null
  note: string | null; expires_on: string | null; is_cancelled: boolean; created_at: string
  usado: number; saldo: number; usos: { fecha: string; monto: number; cita: string }[]
}
type FilaBono = Omit<Bono, 'usado' | 'saldo' | 'usos'> & {
  payments: { amount: number; status: string; created_at: string; appointment_id: string }[] | null
}

function armarBono(f: FilaBono): Bono {
  const usos = (f.payments ?? []).filter(p => p.status === 'PAGADO_COMPLETO')
    .map(p => ({ fecha: p.created_at, monto: Number(p.amount), cita: p.appointment_id }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const usado = usos.reduce((t, u) => t + u.monto, 0)
  const { payments: _pagos, ...resto } = f
  void _pagos
  return { ...resto, amount: Number(f.amount), usado, saldo: Math.max(0, Math.round((Number(f.amount) - usado) * 100) / 100), usos }
}

const CAMPOS_BONO = 'id, code, amount, buyer_name, recipient_name, note, expires_on, is_cancelled, created_at, '
  + 'payments(amount, status, created_at, appointment_id)'

/** ¿Está ejecutado el SQL de bonos? (CobroCita solo ofrece «Bono regalo» si lo está) */
export async function bonosInstalados(): Promise<boolean> {
  const { error } = await sb.from('gift_cards').select('id').limit(1)
  return !error
}

/** null = falta ejecutar el SQL de bonos */
export async function listarBonos(): Promise<Bono[] | null> {
  const { data, error } = await sb.from('gift_cards').select(CAMPOS_BONO)
    .eq('business_id', NEGOCIO_ID).order('created_at', { ascending: false })
  if (error) {
    if (/gift_cards/.test(error.message) || error.code === '42P01' || error.code === 'PGRST205') return null
    throw error
  }
  return (data as unknown as FilaBono[]).map(armarBono)
}

/** Lo que escribe Lynn («lynn ab12», «LYNN-AB12») → «LYNN-AB12» */
export function normalizarCodigoBono(texto: string): string {
  const t = texto.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return t.startsWith('LYNN') && t.length > 4 ? `LYNN-${t.slice(4)}` : t
}

export async function buscarBono(codigo: string): Promise<Bono | null> {
  const { data, error } = await sb.from('gift_cards').select(CAMPOS_BONO)
    .eq('business_id', NEGOCIO_ID).eq('code', normalizarCodigoBono(codigo)).maybeSingle()
  if (error) throw error
  return data ? armarBono(data as unknown as FilaBono) : null
}

// Sin letras que se confunden al dictarlas o escribirlas (O/0, I/1)
const ALFABETO_BONO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function codigoBono() {
  const n = crypto.getRandomValues(new Uint32Array(4))
  return 'LYNN-' + Array.from(n, x => ALFABETO_BONO[x % ALFABETO_BONO.length]).join('')
}

export async function crearBono(d: {
  amount: number; buyer_name: string | null; recipient_name: string | null; note: string | null; expires_on: string | null
}): Promise<Bono> {
  for (let intento = 0; ; intento++) {
    const { data, error } = await sb.from('gift_cards')
      .insert({ ...d, business_id: NEGOCIO_ID, code: codigoBono() }).select(CAMPOS_BONO).single()
    if (!error) return armarBono(data as unknown as FilaBono)
    if (error.code !== '23505' || intento >= 4) throw error   // código repetido: se prueba otro
  }
}

export function anularBono(id: string, anulado: boolean) {
  return ejecutar(sb.from('gift_cards').update({ is_cancelled: anulado }).eq('id', id).select('id').single())
}

// ================== RESUMEN SEMANAL ==================
export type ResumenSemana = {
  desde: string; hasta: string
  citas: number; ingresos: number; nuevas: number; noVino: number; canceladas: number
}

// Semana de lunes a domingo en hora de La Habana; desplazamiento 0 = esta semana, -1 = la anterior
export async function resumenSemana(desplazamiento: number): Promise<ResumenSemana> {
  const d = new Date(fechaISO(new Date()) + 'T12:00:00Z')
  const dia = 86_400_000
  const lunes = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * dia + desplazamiento * 7 * dia)
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  const desde = iso(lunes), hasta = iso(new Date(lunes.getTime() + 7 * dia))
  const ini = instanteEnHabana(desde, '00:00'), fin = instanteEnHabana(hasta, '00:00')

  const [rCitas, rNuevas] = await Promise.all([
    sb.from('appointments').select(`status, total_amount, ${COBROS_EMBEBIDOS}`).eq('business_id', NEGOCIO_ID)
      .gte('starts_at', ini).lt('starts_at', fin),
    sb.from('clients').select('id', { count: 'exact', head: true }).eq('business_id', NEGOCIO_ID)
      .gte('first_seen_at', ini).lt('first_seen_at', fin),
  ])
  if (rCitas.error) throw rCitas.error
  if (rNuevas.error) throw rNuevas.error
  const citas = (rCitas.data ?? []) as unknown as (ConCobros & { status: string })[]
  const completadas = citas.filter(c => c.status === 'COMPLETADA')
  const tasa = await tasaParaCobros(completadas)
  return {
    desde, hasta,
    citas: completadas.length,
    ingresos: completadas.reduce((t, c) => t + ganadoCita(c, tasa).real, 0),
    nuevas: rNuevas.count ?? 0,
    noVino: citas.filter(c => c.status === 'NO_SHOW').length,
    canceladas: citas.filter(c => c.status === 'CANCELADA_CLIENTA' || c.status === 'CANCELADA_NEGOCIO').length,
  }
}
