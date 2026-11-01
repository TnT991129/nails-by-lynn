import { describe, expect, it } from 'vitest'
import { codigoDeFalloSubida, esFalloDeRed, esFalloDeSesion, esFirmaHeif, pareceHeif } from './subida'

const firma = (marca: string) => new Uint8Array([0, 0, 0, 24, ...Array.from('ftyp' + marca, c => c.charCodeAt(0))])

describe('fotos HEIC/HEIF', () => {
  it('se reconocen por la firma aunque lleguen sin tipo ni extensión', () => {
    expect(esFirmaHeif(firma('heic'))).toBe(true)
    expect(esFirmaHeif(firma('mif1'))).toBe(true)   // Samsung «fotos de alta eficiencia»
    expect(esFirmaHeif(firma('isom'))).toBe(false)  // un vídeo MP4
    expect(esFirmaHeif(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false)   // JPEG
  })
  it('y por el tipo o la extensión', () => {
    expect(pareceHeif('image/heif', 'x')).toBe(true)
    expect(pareceHeif('', 'IMG_0001.HEIC')).toBe(true)
    expect(pareceHeif('image/jpeg', 'foto.jpg')).toBe(false)
  })
})

describe('qué hacer cuando falla la subida', () => {
  it('la sesión caducada se reconoce (para renovarla y reintentar)', () => {
    expect(esFalloDeSesion('"exp" claim timestamp check failed')).toBe(true)
    expect(esFalloDeSesion('jwt expired')).toBe(true)
    expect(esFalloDeSesion('new row violates row-level security policy 403')).toBe(true)
    expect(esFalloDeSesion('Failed to fetch')).toBe(false)
  })
  it('los cortes de red se reintentan', () => {
    expect(esFalloDeRed('TypeError: Failed to fetch')).toBe(true)
    expect(esFalloDeRed('Load failed')).toBe(true)   // Safari del iPhone
    expect(esFalloDeRed('The object exceeded the maximum allowed size')).toBe(false)
  })
  it('cada fallo da su mensaje para Lynn', () => {
    expect(codigoDeFalloSubida('The object exceeded the maximum allowed size 413')).toBe('FOTO_DEMASIADO_GRANDE')
    expect(codigoDeFalloSubida('mime type image/heic is not supported')).toBe('TIPO_NO_ADMITIDO')
    expect(codigoDeFalloSubida('jwt expired')).toBe('SUBIDA_SIN_PERMISO')
    expect(codigoDeFalloSubida('Failed to fetch')).toBe('SIN_CONEXION_FOTO')
    expect(codigoDeFalloSubida('SUBIDA_LENTA')).toBe('SUBIDA_LENTA')
    expect(codigoDeFalloSubida('algo raro')).toBe('SUBIDA_FALLIDA')
  })
})
