import { useQuery } from '@tanstack/react-query'
import { rpc, NEGOCIO_ID } from './supabase'

// Precio del dólar (CUP por 1 USD) que Lynn pone cada día en el panel.
// Si aún no hay ninguno, o no hay conexión, se devuelve null y no se muestra el equivalente.
export type Tasa = { tasa: number; fecha: string }

export async function obtenerTasa(): Promise<Tasa | null> {
  try {
    const r = await rpc<{ tasa: number; fecha: string } | null>('obtener_tasa', { p_business_id: NEGOCIO_ID })
    return r && Number(r.tasa) > 0 ? { tasa: Number(r.tasa), fecha: r.fecha } : null
  } catch { return null }
}

export function useTasa(): Tasa | null {
  const q = useQuery({ queryKey: ['tasa'], queryFn: obtenerTasa, staleTime: 10 * 60_000 })
  return q.data ?? null
}
