// Tarjeta de fidelidad. Lynn la configura en Panel → Más → Tarjeta de fidelidad; se guarda en
// settings.site_texts → «_fidelidad» y la base de datos da el premio sola al completar la cita que toca
// (tg_premio_fidelidad en supabase/fidelidad_varias_tarjetas.sql).
//
// Varios premios en la misma tarjeta: p. ej. 5.ª cita → 15 %, 10.ª → 20 %. La tarjeta mide lo que
// el premio más alto (10 sellos) y, si «repetir», al llenarse vuelve a empezar.
// Sellos de una clienta = citas completadas + los que Lynn sume o quite a mano en su ficha.
//
// Puede haber varias tarjetas (p. ej. «Normal» y «VIP») y cada clienta tiene la suya (clients.loyalty_card).
// Para quién es: «todas» (la primera para quien no tenga otra; menos las que Lynn saque) o solo las «elegidas»
// (las que tienen una tarjeta dada por Lynn). tarjetaDeClienta hace lo mismo que la base de datos.

export const CLAVE_FIDELIDAD = '_fidelidad'

export type NivelFidelidad = { citas: number; premio: number }
export type ModoFidelidad = 'todas' | 'elegidas'
/** Lo que decide los premios de una tarjeta */
export type ReglasTarjeta = { niveles: NivelFidelidad[]; repetir: boolean }
export type TarjetaFidelidad = ReglasTarjeta & { id: string; nombre: string }
export type ConfigFidelidad = { activa: boolean; modo: ModoFidelidad; tarjetas: TarjetaFidelidad[] }

export const MAX_NIVELES = 5
export const MAX_TARJETAS = 5
export const ID_PRINCIPAL = 'principal'
const NIVELES_INICIALES: NivelFidelidad[] = [{ citas: 5, premio: 15 }, { citas: 10, premio: 20 }]
export const FIDELIDAD_INICIAL: ConfigFidelidad = {
  activa: false, modo: 'todas',
  tarjetas: [{ id: ID_PRINCIPAL, nombre: 'Normal', repetir: true, niveles: NIVELES_INICIALES }],
}

const entero = (v: unknown, min: number, max: number, defecto: number) =>
  Math.min(max, Math.max(min, Math.round(Number(v)) || defecto))

/** Ordena, quita repetidos y deja valores válidos (1–30 citas, 5–100 %) */
export function limpiarNiveles(niveles: NivelFidelidad[]): NivelFidelidad[] {
  const porCitas = new Map<number, number>()
  for (const n of niveles) porCitas.set(entero(n.citas, 1, 30, 5), entero(n.premio, 5, 100, 15))
  return [...porCitas].map(([citas, premio]) => ({ citas, premio })).sort((a, b) => a.citas - b.citas).slice(0, MAX_NIVELES)
}

export function nuevoIdTarjeta(): string {
  return 't' + Math.random().toString(36).slice(2, 8)
}

/** Tarjeta válida: id sencillo, nombre corto, al menos un premio */
export function limpiarTarjeta(t: Partial<TarjetaFidelidad> | null | undefined, i = 0): TarjetaFidelidad {
  const id = String(t?.id ?? '').replace(/[^a-z0-9-]/gi, '').slice(0, 30) || (i === 0 ? ID_PRINCIPAL : nuevoIdTarjeta())
  const nombre = String(t?.nombre ?? '').trim().slice(0, 30) || (i === 0 ? 'Normal' : `Tarjeta ${i + 1}`)
  const niveles = Array.isArray(t?.niveles) && t.niveles.length ? limpiarNiveles(t.niveles) : NIVELES_INICIALES
  return { id, nombre, niveles, repetir: t?.repetir !== false }
}

/** Sin ids repetidos, como mucho MAX_TARJETAS y al menos una */
export function limpiarTarjetas(tarjetas: Partial<TarjetaFidelidad>[]): TarjetaFidelidad[] {
  const vistas = new Set<string>()
  const lista = tarjetas.map(limpiarTarjeta).filter(t => !vistas.has(t.id) && vistas.add(t.id)).slice(0, MAX_TARJETAS)
  return lista.length ? lista : FIDELIDAD_INICIAL.tarjetas
}

export function leerFidelidad(textos: Record<string, string> | undefined | null): ConfigFidelidad {
  try {
    const c = JSON.parse(textos?.[CLAVE_FIDELIDAD] ?? '{}') as Partial<ConfigFidelidad> & Partial<ReglasTarjeta>
      & { sellos?: number; premio?: number }
    const modo: ModoFidelidad = c.modo === 'elegidas' ? 'elegidas' : 'todas'
    if (Array.isArray(c.tarjetas) && c.tarjetas.length) {
      return { activa: c.activa === true, modo, tarjetas: limpiarTarjetas(c.tarjetas) }
    }
    // Versión anterior: una sola tarjeta con «niveles» y «repetir» (o, aún antes, «sellos» y «premio»)
    const niveles = Array.isArray(c.niveles) && c.niveles.length
      ? limpiarNiveles(c.niveles)
      : c.sellos ? limpiarNiveles([{ citas: c.sellos, premio: c.premio ?? 20 }]) : NIVELES_INICIALES
    return { activa: c.activa === true, modo, tarjetas: [{ id: ID_PRINCIPAL, nombre: 'Normal', repetir: c.repetir !== false, niveles }] }
  } catch { return FIDELIDAD_INICIAL }
}

/** Lo que se guarda: lleva también los premios de la primera arriba, como antes (por compatibilidad) */
export function fidelidadParaGuardar(cfg: ConfigFidelidad) {
  const tarjetas = limpiarTarjetas(cfg.tarjetas)
  return { activa: cfg.activa, modo: cfg.modo, tarjetas, niveles: tarjetas[0].niveles, repetir: tarjetas[0].repetir }
}

/** La tarjeta de una clienta, o null si no tiene (igual que tarjeta_de_clienta en la base de datos) */
export function tarjetaDeClienta(
  cfg: ConfigFidelidad, c: { loyalty_card?: string | null; loyalty_excluded?: boolean },
): TarjetaFidelidad | null {
  if (!cfg.activa) return null
  const suya = c.loyalty_card ? cfg.tarjetas.find(t => t.id === c.loyalty_card) ?? null : null
  if (cfg.modo === 'elegidas') return suya
  if (c.loyalty_excluded) return null
  return suya ?? cfg.tarjetas[0]
}

/** Sellos que tiene la tarjeta (lo que pide el premio más alto) */
export const tamanoTarjeta = (t: ReglasTarjeta) => Math.max(...t.niveles.map(n => n.citas))

/** Sellos llenos en la tarjeta actual (0 = recién empezada) */
export function sellosEnTarjeta(t: ReglasTarjeta, sellos: number): number {
  const tam = tamanoTarjeta(t)
  if (sellos <= 0) return 0
  return t.repetir ? ((sellos - 1) % tam) + 1 : Math.min(sellos, tam)
}

/** Premio que corresponde justo a ese número de sellos (o null) */
export function premioAlLlegar(t: ReglasTarjeta, sellos: number): NivelFidelidad | null {
  if (sellos <= 0 || (!t.repetir && sellos > tamanoTarjeta(t))) return null
  const pos = sellosEnTarjeta(t, sellos)
  return t.niveles.find(n => n.citas === pos) ?? null
}

/** El siguiente premio y cuántas citas faltan (null si la tarjeta ya se completó y no se repite) */
export function siguientePremio(t: ReglasTarjeta, sellos: number): { nivel: NivelFidelidad; faltan: number } | null {
  const tam = tamanoTarjeta(t)
  if (!t.repetir && sellos >= tam) return null
  const pos = sellos <= 0 ? 0 : sellosEnTarjeta(t, sellos) === tam ? 0 : sellosEnTarjeta(t, sellos)   // llena: empieza otra
  const nivel = t.niveles.find(n => n.citas > pos)!
  return { nivel, faltan: nivel.citas - pos }
}
