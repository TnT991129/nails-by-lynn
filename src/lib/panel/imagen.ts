// Reduce una foto en el móvil antes de subirla: menos datos para Lynn al subir
// y para las clientas al verla (una foto de 4 MB queda en ~150 KB).

function cargar(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolver(img) }
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('IMAGEN_INVALIDA')) }
    img.src = url
  })
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise(r => lienzo.toBlob(r, tipo, calidad))
}

/** Devuelve la foto con el lado mayor ≤ maxLado, en WebP (o JPEG si el navegador no sabe WebP) */
export async function reducirImagen(archivo: File, maxLado = 1600): Promise<File> {
  const img = await cargar(archivo)
  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight))
  const ancho = Math.round(img.naturalWidth * escala)
  const alto = Math.round(img.naturalHeight * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho; lienzo.height = alto
  lienzo.getContext('2d')!.drawImage(img, 0, 0, ancho, alto)

  let blob = await aBlob(lienzo, 'image/webp', 0.82)
  let ext = 'webp'
  if (!blob || blob.type !== 'image/webp') {   // Safari antiguo devuelve PNG si no sabe WebP
    blob = await aBlob(lienzo, 'image/jpeg', 0.85)
    ext = 'jpg'
  }
  if (!blob) return archivo
  // Si por lo que sea sale más grande que la original, se sube la original
  if (blob.size >= archivo.size) return archivo
  return new File([blob], archivo.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type })
}
