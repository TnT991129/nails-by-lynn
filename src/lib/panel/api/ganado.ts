// Cobros y lo que se ganó de verdad con cada cita. Sin Supabase: se prueba sola (ganado.test.ts).

// ================== COBROS ==================
// Cada cobro es una fila de payments ya pagada. Una cita puede tener varios (p. ej. parte en CUP y parte en USD).
export type MetodoCobro = 'EFECTIVO' | 'TRANSFERMOVIL' | 'ENZONA' | 'OTRO'
export type Cobro = {
  id: string; amount: number; currency: 'CUP' | 'USD'; method: MetodoCobro | null
  exchange_rate_used: number | null; created_at: string
  bono?: string | null   // código del bono regalo si se pagó con él (supabase/historial/recomendaciones_y_bonos.sql)
}

// Un cobro en dólares: los CUP se pasan con el dólar de ese día (o el actual si no se guardó)
export function cobroEnUsd(c: Pick<Cobro, 'amount' | 'currency' | 'exchange_rate_used'>, tasaActual: number | null) {
  if (c.currency === 'USD') return Number(c.amount)
  const tasa = Number(c.exchange_rate_used ?? tasaActual ?? 0)
  return tasa > 0 ? Number(c.amount) / tasa : 0
}

// ---------- Lo que se ganó de verdad con cada cita ----------
// El precio de los servicios es una estimación: al terminar, Lynn cobra según el largo, el diseño…
// En Estadísticas cuenta lo que apuntó en «Cobrar»; si no apuntó nada, el precio estimado.
export type CobroEmbebido = Pick<Cobro, 'amount' | 'currency' | 'exchange_rate_used'> & { status: string }
export type ConCobros = { total_amount: number; payments?: CobroEmbebido[] | null }
export const COBROS_EMBEBIDOS = 'payments(amount, currency, exchange_rate_used, status)'

export function cobrosValidos(c: ConCobros) {
  return (c.payments ?? []).filter(p => p.status === 'PAGADO_COMPLETO')
}

export type Ganado = { real: number; cobrado: number; estimado: number; cobrada: boolean }

export function ganadoCita(c: ConCobros, tasa: number | null): Ganado {
  const cobros = cobrosValidos(c)
  const estimado = Number(c.total_amount)
  // Un cobro en CUP sin precio del dólar no se puede pasar a dólares: mejor el estimado que un cero
  const convertible = cobros.every(p => p.currency === 'USD' || Number(p.exchange_rate_used ?? tasa ?? 0) > 0)
  const cobrado = cobros.reduce((t, p) => t + cobroEnUsd(p, tasa), 0)
  const cobrada = cobros.length > 0 && convertible
  return { real: cobrada ? cobrado : estimado, cobrado, estimado, cobrada }
}
