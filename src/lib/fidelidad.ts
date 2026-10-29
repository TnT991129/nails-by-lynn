// Tarjeta de fidelidad. Lynn la configura en Panel → Más → Tarjeta de fidelidad; se guarda en
// settings.site_texts → «_fidelidad» y la base de datos da el premio sola al completar la cita que toca
// (tg_premio_fidelidad en supabase/inspiracion_fidelidad_visitas.sql).

export const CLAVE_FIDELIDAD = '_fidelidad'

export type ConfigFidelidad = { activa: boolean; sellos: number; premio: number }
export const FIDELIDAD_INICIAL: ConfigFidelidad = { activa: false, sellos: 8, premio: 20 }

export function leerFidelidad(textos: Record<string, string> | undefined | null): ConfigFidelidad {
  try {
    const c = JSON.parse(textos?.[CLAVE_FIDELIDAD] ?? '{}') as Partial<ConfigFidelidad>
    return {
      activa: c.activa === true,
      sellos: Math.min(20, Math.max(2, Math.round(Number(c.sellos) || FIDELIDAD_INICIAL.sellos))),
      premio: Math.min(100, Math.max(5, Math.round(Number(c.premio) || FIDELIDAD_INICIAL.premio))),
    }
  } catch { return FIDELIDAD_INICIAL }
}
