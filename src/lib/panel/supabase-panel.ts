// Cliente completo solo para el panel: incluye Auth para el login de Lynn.
// Carga aparte del sitio publico (lazy chunk) para no engordar la clienta.
import { createClient, type Session } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

export const sb = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'nbl.panel.auth',  // clave propia, separada del sitio publico
  },
})

export type { Session }

export const NEGOCIO_ID = '1a115b41-0000-4000-8000-000000000001'
