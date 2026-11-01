// Reglas de la subida de fotos que no dependen del navegador ni de Supabase (se prueban en subida.test.ts)

// Las fotos HEIC/HEIF (iPhone y muchos Android, p. ej. Samsung con «fotos de alta eficiencia») empiezan por
// «....ftyp» + una marca. Desde la galería del móvil a veces llegan sin tipo ni extensión: se mira la firma.
const MARCAS_HEIF = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']

export function esFirmaHeif(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const texto = String.fromCharCode(...bytes.slice(4, 12))
  return texto.startsWith('ftyp') && MARCAS_HEIF.includes(texto.slice(4, 8))
}

export function pareceHeif(tipo: string, nombre: string): boolean {
  return /image\/hei[cf]/i.test(tipo) || /\.hei[cf]$/i.test(nombre)
}

/** El permiso de la sesión caducó o no se pudo renovar (en el móvil, tras horas en segundo plano) */
export function esFalloDeSesion(mensaje: string): boolean {
  return /jwt|exp(ired)?\b|token|unauthori[sz]ed|invalid.?signature|row-level security|\b40[13]\b/i.test(mensaje)
}

/** Fallo de red que merece otro intento (la conexión de Cuba se corta a ratos) */
export function esFalloDeRed(mensaje: string): boolean {
  return /fetch|network|load failed|timed? ?out|aborted|SUBIDA_LENTA/i.test(mensaje)
}

/** Código del mensaje para Lynn según lo que respondió Supabase al subir */
export function codigoDeFalloSubida(mensaje: string): string {
  return /SUBIDA_LENTA/.test(mensaje) ? 'SUBIDA_LENTA'
    : /exceeded|too large|maximum allowed size|\b413\b/i.test(mensaje) ? 'FOTO_DEMASIADO_GRANDE'
    : /mime|content.?type|\b415\b/i.test(mensaje) ? 'TIPO_NO_ADMITIDO'
    : /bucket not found/i.test(mensaje) ? 'FALTA_BUCKET'
    : esFalloDeSesion(mensaje) ? 'SUBIDA_SIN_PERMISO'
    : esFalloDeRed(mensaje) ? 'SIN_CONEXION_FOTO'
    : 'SUBIDA_FALLIDA'
}
