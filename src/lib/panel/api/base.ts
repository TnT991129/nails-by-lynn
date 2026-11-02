// Tipos compartidos y ayudas para las consultas del panel.

export type CitaAgenda = {
  id: string; code: string; starts_at: string; ends_at: string; blocked_until: string
  status: string; source: string; total_amount: number; currency: string
  deposit_amount: number; balance_due: number; total_duration_minutes: number
  client_note: string | null; internal_note: string | null
  cliente_nombre: string; cliente_telefono: string; client_id: string
  servicios: string | null
  discount_percent?: number; discount_amount?: number   // desde supabase/historial/turnos_descuentos_cambios.sql
  total_amount_max?: number | null   // total con precios en rango (supabase/historial/rango_en_citas.sql)
}

export type Cliente = {
  id: string; full_name: string; phone: string; email: string | null; instagram: string | null
  internal_notes: string | null
  total_appointments: number; total_no_shows: number; total_cancellations: number
  total_spent_cup: number; is_blocked: boolean
  // Descuento para su próxima cita (columnas de supabase/historial/turnos_descuentos_cambios.sql)
  next_discount_percent?: number | null; next_discount_note?: string | null
  allergies?: string | null; birthday?: string | null   // supabase/historial/mejoras.sql
  // Tarjeta de fidelidad (supabase/historial/fidelidad_niveles.sql): sellos sumados o quitados a mano y si no participa
  loyalty_adjustment?: number; loyalty_excluded?: boolean
  loyalty_card?: string | null   // id de su tarjeta de fidelidad (supabase/fidelidad_varias_tarjetas.sql)
  // Recomendaciones (supabase/historial/recomendaciones_y_bonos.sql): quién la trajo y si ya se dieron los premios
  referred_by?: string | null; referral_rewarded_at?: string | null
  last_appointment_at: string | null; first_seen_at: string
}

export async function ejecutar<T>(op: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await op
  if (error) throw error
  return data as T
}

// Supabase devuelve como máximo 1000 filas por consulta: se piden por páginas hasta tenerlas todas
const PAGINA = 1000
export async function todasLasFilas<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await pedir(desde, desde + PAGINA - 1)
    if (error) throw error
    filas.push(...(data ?? []))
    if (!data || data.length < PAGINA) return filas
  }
}
