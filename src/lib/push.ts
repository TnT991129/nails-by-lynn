import { rpc } from './supabase'

// Avisos en el móvil de la clienta (Web Push). El envío lo hace la Edge Function «enviar-push»
// cuando cambia una cita (supabase/notificaciones_push.sql). Esta es la clave PÚBLICA;
// la privada solo está en los secretos de Supabase.
const CLAVE_PUBLICA = 'BMyeUzzFMnPe18NIHJNCb2Wk6UBfFgX_U1mUXjvmEeZjDZuxnratQjJNLVqKjyZZEeiu7VI6HFcf8VH6FoiN98s'

export type EstadoPush = 'no-disponible' | 'instalar-ios' | 'bloqueado' | 'activo' | 'inactivo'

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

export async function estadoPush(): Promise<EstadoPush> {
  // En el iPhone solo hay avisos con la web añadida a la pantalla de inicio (iOS 16.4 o más)
  if (!('PushManager' in window) || !('Notification' in window)) return esIOS() && !enModoApp() ? 'instalar-ios' : 'no-disponible'
  const reg = await registro()
  if (!reg) return 'no-disponible'
  if (Notification.permission === 'denied') return 'bloqueado'
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'activo' : 'inactivo'
}

async function guardar(sub: PushSubscription, token: string) {
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  await rpc('guardar_suscripcion_push', { p_token: token, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
}

/** Pide permiso y deja este móvil apuntado para los avisos de la clienta de esa cita */
export async function activarPush(token: string) {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('PERMISO_DENEGADO')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDeClave(CLAVE_PUBLICA) })
  await guardar(sub, token)
}

export async function desactivarPush() {
  const sub = await (await registro())?.pushManager.getSubscription()
  if (!sub) return
  await rpc('quitar_suscripcion_push', { p_endpoint: sub.endpoint }).catch(() => {})
  await sub.unsubscribe()
}

/** Si el móvil ya tiene avisos activados, los une también a esta cita (sin preguntar nada) */
export async function vincularPush(token: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const sub = await (await registro())?.pushManager.getSubscription()
    if (sub) await guardar(sub, token)
  } catch { /* sin conexión o sin el SQL: ya se unirá la próxima vez */ }
}
