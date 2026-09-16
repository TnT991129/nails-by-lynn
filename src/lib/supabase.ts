// Cliente minimo contra PostgREST. El sitio publico solo hace lecturas y RPC,
// asi que no cargamos @supabase/supabase-js (58 KB comprimidos) en el navegador
// de la clienta. El panel de Lynn si lo usara, cargado aparte.

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string
const CLAVE = import.meta.env.VITE_SUPABASE_KEY as string

if (!URL_BASE || !CLAVE) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY en .env.local')
}

export const NEGOCIO_ID = '1a115b41-0000-4000-8000-000000000001'

const CABECERAS: Record<string, string> = {
  apikey: CLAVE,
  Authorization: `Bearer ${CLAVE}`,
  'Content-Type': 'application/json',
}

type ErrorPostgrest = { message?: string; details?: string; hint?: string; code?: string }

async function procesar(res: Response) {
  if (!res.ok) {
    let cuerpo: ErrorPostgrest = {}
    try { cuerpo = await res.json() } catch { /* respuesta no JSON */ }
    throw new Error(cuerpo.message || cuerpo.details || `HTTP ${res.status}`)
  }
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

/** Lectura de tabla o vista. Filtros en sintaxis PostgREST: { id: 'eq.123' } */
export async function seleccionar<T>(
  tabla: string,
  opciones: { select?: string; filtros?: Record<string, string>; orden?: string; limite?: number } = {},
): Promise<T[]> {
  const p = new URLSearchParams()
  p.set('select', opciones.select ?? '*')
  for (const [k, v] of Object.entries(opciones.filtros ?? {})) p.set(k, v)
  if (opciones.orden) p.set('order', opciones.orden)
  if (opciones.limite) p.set('limit', String(opciones.limite))
  const res = await fetch(`${URL_BASE}/rest/v1/${tabla}?${p}`, { headers: CABECERAS })
  return (await procesar(res)) as T[]
}

/** Llama una funcion de PostgreSQL. */
export async function rpc<T>(nombre: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/${nombre}`, {
    method: 'POST', headers: CABECERAS, body: JSON.stringify(params),
  })
  return (await procesar(res)) as T
}
