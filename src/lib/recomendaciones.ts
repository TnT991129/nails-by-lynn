// Recomendaciones: una clienta trae a una amiga. Lynn las configura en Panel → Más → Recomendaciones;
// se guarda en settings.site_texts → «_recomendaciones» y la base de datos da los premios sola cuando la amiga
// completa su primera cita (tg_premio_recomendacion en supabase/historial/recomendaciones_y_bonos.sql).

export const CLAVE_RECOMENDACIONES = '_recomendaciones'

export type ConfigRecomendaciones = {
  activa: boolean
  premio: number   // % de descuento para quien recomendó, en su próxima cita
  amiga: number    // % para la amiga en su segunda cita (0 = nada)
}

export const RECOMENDACIONES_INICIAL: ConfigRecomendaciones = { activa: false, premio: 10, amiga: 10 }

const porcentaje = (v: unknown, defecto: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : defecto
}

export function leerRecomendaciones(textos: Record<string, string> | undefined | null): ConfigRecomendaciones {
  try {
    const c = JSON.parse(textos?.[CLAVE_RECOMENDACIONES] ?? '{}') as Partial<ConfigRecomendaciones>
    return {
      activa: c.activa === true,
      premio: porcentaje(c.premio, RECOMENDACIONES_INICIAL.premio),
      amiga: porcentaje(c.amiga, RECOMENDACIONES_INICIAL.amiga),
    }
  } catch { return RECOMENDACIONES_INICIAL }
}

/** Mensaje que la clienta manda a su amiga, con el enlace de reserva que ya trae su número */
export function mensajeRecomendacion(urlReserva: string, telefono: string, cfg: ConfigRecomendaciones): string {
  const enlace = `${urlReserva}?amiga=${encodeURIComponent(telefono.replace(/\D/g, ''))}`
  return `¡Hola! Me hago las uñas con Lynn y me encantan 💅`
    + (cfg.amiga > 0 ? ` Si reservas con este enlace, en tu segunda cita tienes un ${cfg.amiga}% de descuento.` : '')
    + `\n\nReserva aquí: ${enlace}`
}
