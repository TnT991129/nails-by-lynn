// Reduce una foto en el móvil antes de subirla: menos datos para Lynn al subir
// y para las clientas al verla (una foto de 4 MB queda en ~150 KB).
//
// En el móvil hay menos memoria que en el PC: una foto de 50 MP abierta entera ocupa unos 200 MB y el navegador
// la rechaza. Por eso, cuando se puede, se abre ya reducida (createImageBitmap con resize).
import { esFirmaHeif, pareceHeif } from './subida'

type Dibujable = { fuente: CanvasImageSource; ancho: number; alto: number; cerrar: () => void }

function cargar(fuente: Blob): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(fuente)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolver(img) }
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('IMAGEN_INVALIDA')) }
    img.src = url
  })
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise(r => lienzo.toBlob(r, tipo, calidad))
}

async function esHeif(archivo: File): Promise<boolean> {
  if (pareceHeif(archivo.type, archivo.name)) return true
  try { return esFirmaHeif(new Uint8Array(await archivo.slice(0, 12).arrayBuffer())) } catch { return false }
}

// Abre la foto con el lado mayor ≤ maxLado: primero ya reducida (poca memoria); si no se puede, entera
async function abrir(fuente: Blob, maxLado: number): Promise<Dibujable> {
  let img: HTMLImageElement | null = null
  try { img = await cargar(fuente) } catch { /* se prueba abajo con createImageBitmap */ }
  const escala = (an: number, al: number) => Math.min(1, maxLado / Math.max(an, al))

  if (typeof createImageBitmap === 'function') {
    try {
      const opciones: ImageBitmapOptions = { imageOrientation: 'from-image' }
      if (img) {
        const e = escala(img.naturalWidth, img.naturalHeight)
        if (e < 1) Object.assign(opciones, {
          resizeWidth: Math.round(img.naturalWidth * e), resizeHeight: Math.round(img.naturalHeight * e), resizeQuality: 'high',
        })
      }
      const bmp = await createImageBitmap(fuente, opciones)
      const e = escala(bmp.width, bmp.height)
      return { fuente: bmp, ancho: Math.round(bmp.width * e), alto: Math.round(bmp.height * e), cerrar: () => bmp.close() }
    } catch { /* navegador sin resize o sin memoria: se usa la imagen normal */ }
  }
  if (!img) throw new Error('IMAGEN_INVALIDA')
  const e = escala(img.naturalWidth, img.naturalHeight)
  return { fuente: img, ancho: Math.round(img.naturalWidth * e), alto: Math.round(img.naturalHeight * e), cerrar: () => {} }
}

async function leerFoto(archivo: File, maxLado: number): Promise<Dibujable> {
  try {
    return await abrir(archivo, maxLado)
  } catch (e) {
    if (!(await esHeif(archivo))) throw e
    // Se convierte a JPEG en el móvil; la librería solo se descarga si hace falta
    const { default: heic2any } = await import('heic2any')
    const convertida = await heic2any({ blob: archivo, toType: 'image/jpeg', quality: 0.9 })
      .catch(() => { throw new Error('IMAGEN_INVALIDA') })
    return abrir(Array.isArray(convertida) ? convertida[0] : convertida, maxLado)
  }
}

/** Devuelve la foto con el lado mayor ≤ maxLado, en WebP (o JPEG si el navegador no sabe WebP) */
export async function reducirImagen(archivo: File, maxLado = 1600): Promise<File> {
  const foto = await leerFoto(archivo, maxLado)
  const lienzo = document.createElement('canvas')
  lienzo.width = foto.ancho; lienzo.height = foto.alto
  const ctx = lienzo.getContext('2d')
  if (!ctx) { foto.cerrar(); throw new Error('IMAGEN_INVALIDA') }
  ctx.drawImage(foto.fuente, 0, 0, foto.ancho, foto.alto)
  foto.cerrar()

  let blob = await aBlob(lienzo, 'image/webp', 0.82)
  let ext = 'webp'
  if (!blob || blob.type !== 'image/webp') {   // Safari antiguo devuelve PNG si no sabe WebP
    blob = await aBlob(lienzo, 'image/jpeg', 0.85)
    ext = 'jpg'
  }
  lienzo.width = lienzo.height = 0   // libera la memoria del lienzo enseguida (importante en iPhone)
  if (!blob) throw new Error('IMAGEN_INVALIDA')
  // Si sale más grande que la original y la original se puede ver en cualquier navegador, se sube la original
  if (blob.size >= archivo.size && /image\/(jpeg|png|webp)/.test(archivo.type)) return archivo
  return new File([blob], (archivo.name || 'foto').replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type })
}
