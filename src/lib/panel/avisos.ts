import { sb } from './supabase-panel'

// Avisos en el móvil de Lynn (Web Push) cuando una clienta reserva, cancela, cambia su cita, etc.
// Los manda la Edge Function «enviar-push» (supabase/historial/avisos_lynn.sql). Esta es la clave PÚBLICA;
// la privada solo está en los secretos de Supabase.
const CLAVE_PUBLICA = 'BMyeUzzFMnPe18NIHJNCb2Wk6UBfFgX_U1mUXjvmEeZjDZuxnratQjJNLVqKjyZZEeiu7VI6HFcf8VH6FoiN98s'

export const EVENTOS = [
  { clave: 'nueva',      titulo: 'Reservas nuevas' },
  { clave: 'cancelada',  titulo: 'Cancelaciones' },
  { clave: 'reagendada', titulo: 'Cambios de fecha' },
  { clave: 'editada',    titulo: 'Cambios de servicios o nota' },
  { clave: 'espera',     titulo: 'Lista de espera' },
  { clave: 'opinion',    titulo: 'Opiniones' },
] as const
export type Evento = typeof EVENTOS[number]['clave']

export type EstadoAvisos =
  | { tipo: 'no-disponible' } | { tipo: 'instalar-ios' } | { tipo: 'bloqueado' }
  | { tipo: 'inactivo' } | { tipo: 'activo'; eventos: Evento[] }

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const enModoApp = () => window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true

function bytesDeClave(base64url: string): ArrayBuffer {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(b64)
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes.buffer
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)) ?? null
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
  // En el iPhone solo hay avisos con el panel añadido a la pantalla de inicio (iOS 16.4 o más)
  if (!('PushManager' in window) || !('Notification' in window)) {
    return { tipo: esIOS() && !enModoApp() ? 'instalar-ios' : 'no-disponible' }
  }
  const reg = await registro()
  if (!reg) return { tipo: 'no-disponible' }
  if (Notification.permission === 'denied') return { tipo: 'bloqueado' }
  const sub = await reg.pushManager.getSubscription()
  if (!sub || Notification.permission !== 'granted') return { tipo: 'inactivo' }
  const { data, error } = await sb.rpc('mis_avisos_movil', { p_endpoint: sub.endpoint })
  if (error) throw error
  // El móvil está suscrito pero Supabase no lo tiene (p. ej. se borró): cuenta como apagado
  return data ? { tipo: 'activo', eventos: data as Evento[] } : { tipo: 'inactivo' }
}

/** Pide permiso (si hace falta) y guarda este móvil con los avisos elegidos */
export async function activarAvisos(eventos: Evento[]) {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('PERMISO_DENEGADO')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDeClave(CLAVE_PUBLICA) })
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await sb.rpc('guardar_aviso_movil', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_eventos: eventos,
  })
  if (error) throw error
}

export async function desactivarAvisos() {
  const sub = await (await registro())?.pushManager.getSubscription()
  if (!sub) return
  await sb.rpc('quitar_aviso_movil', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}
