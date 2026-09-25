// Service worker de Nails by Lynn.
// Objetivo: que la web abra al instante y siga funcionando con la conexión intermitente de Cuba.
//
// - Páginas (navegación): primero la red; sin conexión, la última copia guardada.
// - /assets/* (JS y CSS con hash en el nombre, nunca cambian): primero la copia guardada.
// - Imágenes propias y fotos de la galería: la copia guardada al momento y se actualiza por detrás.
// - Supabase: solo se guardan lecturas de datos públicos (negocio, servicios, extras, horario, galería)
//   como respaldo sin conexión. Disponibilidad, reservas y todo lo del panel van siempre a la red.

const VERSION = 'v1'
const CACHE_APP = `nbl-app-${VERSION}`
const CACHE_IMAGENES = `nbl-img-${VERSION}`
const CACHE_DATOS = `nbl-datos-${VERSION}`
const MAX_IMAGENES = 80
const MAX_ARCHIVOS_APP = 60   // cada versión publicada deja JS/CSS nuevos; los viejos se descartan

const BASE = new URL(self.registration.scope).pathname   // "/nails-by-lynn/"
const TABLAS_PUBLICAS = ['businesses', 'services', 'service_addons', 'schedule_rules', 'gallery_photos']

self.addEventListener('install', evento => {
  evento.waitUntil(caches.open(CACHE_APP).then(c => c.add(BASE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', evento => {
  const vigentes = [CACHE_APP, CACHE_IMAGENES, CACHE_DATOS]
  evento.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(c => c.startsWith('nbl-') && !vigentes.includes(c))
                                         .map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', evento => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return
  const url = new URL(peticion.url)

  if (peticion.mode === 'navigate' && url.origin === location.origin) {
    evento.respondWith(paginaConRespaldo(peticion))
    return
  }

  if (url.origin === location.origin) {
    if (url.pathname.startsWith(`${BASE}assets/`)) {
      evento.respondWith(primeroGuardado(peticion, CACHE_APP))
    } else if (/\.(webp|png|jpe?g|svg|ico)$/i.test(url.pathname)) {
      evento.respondWith(guardadoYActualizar(peticion, CACHE_IMAGENES, evento))
    }
    return
  }

  // Supabase
  if (url.pathname.includes('/storage/v1/object/public/')) {
    evento.respondWith(guardadoYActualizar(peticion, CACHE_IMAGENES, evento))
    return
  }
  const tabla = url.pathname.match(/\/rest\/v1\/([a-z_]+)$/)?.[1]
  if (tabla && TABLAS_PUBLICAS.includes(tabla) && !tieneSesion(peticion)) {
    evento.respondWith(primeroRed(peticion, CACHE_DATOS))
  }
})

// El panel manda el token de sesión de Lynn; esas lecturas no se guardan
function tieneSesion(peticion) {
  const auth = peticion.headers.get('Authorization') ?? ''
  const clave = peticion.headers.get('apikey') ?? ''
  return auth !== '' && auth !== `Bearer ${clave}`
}

async function paginaConRespaldo(peticion) {
  try {
    const respuesta = await fetch(peticion)
    // GitHub Pages responde 404 (con la app dentro) en rutas como /reservar; se sirve igual
    if (respuesta.ok && new URL(peticion.url).pathname === BASE) {
      const cache = await caches.open(CACHE_APP)
      cache.put(BASE, respuesta.clone())
    }
    return respuesta
  } catch {
    const guardada = await caches.match(BASE)
    return guardada ?? Response.error()
  }
}

async function primeroGuardado(peticion, nombreCache) {
  const guardada = await caches.match(peticion)
  if (guardada) return guardada
  const respuesta = await fetch(peticion)
  if (respuesta.ok) {
    const cache = await caches.open(nombreCache)
    await cache.put(peticion, respuesta.clone())
    await recortar(cache, MAX_ARCHIVOS_APP)
  }
  return respuesta
}

async function guardadoYActualizar(peticion, nombreCache, evento) {
  const cache = await caches.open(nombreCache)
  const guardada = await cache.match(peticion)
  const deRed = fetch(peticion).then(async respuesta => {
    // Solo respuestas normales: las opacas ocupan mucho espacio en el móvil
    if (respuesta.ok) {
      await cache.put(peticion, respuesta.clone())
      await recortar(cache, MAX_IMAGENES)
    }
    return respuesta
  }).catch(() => guardada ?? Response.error())
  if (guardada) {
    evento.waitUntil(deRed)
    return guardada
  }
  return deRed
}

async function primeroRed(peticion, nombreCache) {
  const cache = await caches.open(nombreCache)
  try {
    const respuesta = await fetch(peticion)
    if (respuesta.ok) cache.put(peticion, respuesta.clone())
    return respuesta
  } catch {
    return (await cache.match(peticion)) ?? Response.error()
  }
}

// Borra las entradas más antiguas para no llenar el móvil
async function recortar(cache, maximo) {
  const claves = await cache.keys()
  for (let i = 0; i < claves.length - maximo; i++) await cache.delete(claves[i])
}
