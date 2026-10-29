import { rpc } from './supabase'
import { enVistaPrevia } from './diseno'

// Visitas y reservas para Estadísticas (supabase/inspiracion_fidelidad_visitas.sql).
// Anónimo: un número al azar que solo dura mientras la pestaña está abierta; ni IP ni datos de la clienta.
export type EventoWeb = 'visita' | 'reserva_inicio' | 'reserva_fecha' | 'reserva_hora' | 'reserva_datos'
  | 'reserva_resumen' | 'reserva_hecha' | 'whatsapp'

const CLAVE = 'nbl.visita'

function sesion(): string | null {
  try {
    let s = sessionStorage.getItem(CLAVE)
    if (!s) { s = crypto.getRandomValues(new Uint32Array(3)).join(''); sessionStorage.setItem(CLAVE, s) }
    return s
  } catch { return null }
}

/** Cuenta el evento una vez por visita. Nunca falla ni hace esperar: si no hay conexión, no cuenta */
export function registrarEvento(evento: EventoWeb) {
  if (enVistaPrevia || location.pathname.includes('/panel')) return
  const s = sesion()
  if (!s) return
  try {
    const marca = `${CLAVE}.${evento}`
    if (sessionStorage.getItem(marca)) return
    sessionStorage.setItem(marca, '1')
  } catch { return }
  rpc('registrar_evento', { p_evento: evento, p_sesion: s }).catch(() => {})
}
