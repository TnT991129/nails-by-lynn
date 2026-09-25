export type Servicio = {
  id: string
  name: string
  slug: string
  short_description: string | null
  description: string | null
  duration_minutes: number
  buffer_after_minutes: number
  price: number
  currency: 'CUP' | 'USD'
  cover_image_url: string | null
  sort_order: number
}

export type Addon = {
  id: string
  service_id: string | null
  name: string
  extra_minutes: number
  extra_price: number
}

export type Negocio = {
  id: string
  name: string
  tagline: string | null
  description: string | null
  phone_whatsapp: string | null
  instagram_url: string | null
  location_label: string | null
  timezone: string
  default_currency: 'CUP' | 'USD'
  is_accepting_bookings: boolean
  closed_message: string | null
}

export type CitaCreada = {
  id: string
  code: string
  access_token: string
  inicio: string
  fin: string
  duracion_minutos: number
  total: number
  anticipo: number
  saldo: number
}

export type CitaDetalle = {
  code: string
  inicio: string
  fin: string
  estado: string
  duracion_minutos: number
  total: number
  moneda: string
  anticipo: number
  saldo: number
  nota: string | null
  reprogramaciones: number
  // Opcionales: llegan desde que se aplicó supabase/reprogramar_clienta.sql
  margen_minutos?: number
  max_reprogramaciones?: number
  horas_minimas_reprogramar?: number
  cliente: { nombre: string; telefono: string }
  negocio: { nombre: string; ubicacion: string | null; whatsapp: string | null; zona: string }
  servicios: { nombre: string; precio: number }[]
}

export type ItemReserva = { service_id: string; addons: string[] }

export type Politicas = {
  cancelar_minimo_horas: number
  cancelar_gratis_horas: number
  cambiar_minimo_horas: number
  max_cambios: number
  max_citas_activas: number
  max_dias_antelacion: number
  anticipo: boolean
  textos: Record<'cancelacion' | 'cambios' | 'anticipo' | 'no_show' | 'retrasos' | 'reembolsos' | 'espera' | 'privacidad', string | null>
}
