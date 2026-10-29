// Tarjeta de fidelidad. Lynn la configura en Panel → Más → Tarjeta de fidelidad; se guarda en
// settings.site_texts → «_fidelidad» y la base de datos da el premio sola al completar la cita que toca
// (tg_premio_fidelidad en supabase/fidelidad_niveles.sql).
//
// Varios premios en la misma tarjeta: p. ej. 5.ª cita → 15 %, 10.ª → 20 %. La tarjeta mide lo que
// el premio más alto (10 sellos) y, si «repetir», al llenarse vuelve a empezar.
// Sellos de una clienta = citas completadas + los que Lynn sume o quite a mano en su ficha.

export const CLAVE_FIDELIDAD = '_fidelidad'

export type NivelFidelidad = { citas: number; premio: number }
export type ConfigFidelidad = { activa: boolean; niveles: NivelFidelidad[]; repetir: boolean }

export const MAX_NIVELES = 5
export const FIDELIDAD_INICIAL: ConfigFidelidad = {
  activa: false, repetir: true,
  niveles: [{ citas: 5, premio: 15 }, { citas: 10, premio: 20 }],
}

const entero = (v: unknown, min: number, max: number, defecto: number) =>
  Math.min(max, Math.max(min, Math.round(Number(v)) || defecto))

/** Ordena, quita repetidos y deja valores válidos (1–30 citas, 5–100 %) */
export function limpiarNiveles(niveles: NivelFidelidad[]): NivelFidelidad[] {
  const porCitas = new Map<number, number>()
  for (const n of niveles) porCitas.set(entero(n.citas, 1, 30, 5), entero(n.premio, 5, 100, 15))
  return [...porCitas].map(([citas, premio]) => ({ citas, premio })).sort((a, b) => a.citas - b.citas).slice(0, MAX_NIVELES)
}

export function leerFidelidad(textos: Record<string, string> | undefined | null): ConfigFidelidad {
  try {
    const c = JSON.parse(textos?.[CLAVE_FIDELIDAD] ?? '{}') as Partial<ConfigFidelidad> & { sellos?: number; premio?: number }
    // Versión anterior: un solo premio («sellos» y «premio»)
    const niveles = Array.isArray(c.niveles) && c.niveles.length
      ? limpiarNiveles(c.niveles)
      : c.sellos ? limpiarNiveles([{ citas: c.sellos, premio: c.premio ?? 20 }]) : FIDELIDAD_INICIAL.niveles
    return { activa: c.activa === true, repetir: c.repetir !== false, niveles }
  } catch { return FIDELIDAD_INICIAL }
}

/** Sellos que tiene la tarjeta (lo que pide el premio más alto) */
export const tamanoTarjeta = (cfg: ConfigFidelidad) => Math.max(...cfg.niveles.map(n => n.citas))

/** Sellos llenos en la tarjeta actual (0 = recién empezada) */
export function sellosEnTarjeta(cfg: ConfigFidelidad, sellos: number): number {
  const t = tamanoTarjeta(cfg)
  if (sellos <= 0) return 0
  return cfg.repetir ? ((sellos - 1) % t) + 1 : Math.min(sellos, t)
}

/** Premio que corresponde justo a ese número de sellos (o null) */
export function premioAlLlegar(cfg: ConfigFidelidad, sellos: number): NivelFidelidad | null {
  if (sellos <= 0 || (!cfg.repetir && sellos > tamanoTarjeta(cfg))) return null
  const pos = sellosEnTarjeta(cfg, sellos)
  return cfg.niveles.find(n => n.citas === pos) ?? null
}

/** El siguiente premio y cuántas citas faltan (null si la tarjeta ya se completó y no se repite) */
export function siguientePremio(cfg: ConfigFidelidad, sellos: number): { nivel: NivelFidelidad; faltan: number } | null {
  const t = tamanoTarjeta(cfg)
  if (!cfg.repetir && sellos >= t) return null
  const pos = sellos <= 0 ? 0 : sellosEnTarjeta(cfg, sellos) === t ? 0 : sellosEnTarjeta(cfg, sellos)   // llena: empieza otra
  const nivel = cfg.niveles.find(n => n.citas > pos)!
  return { nivel, faltan: nivel.citas - pos }
}
