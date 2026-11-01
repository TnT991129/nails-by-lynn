import { describe, expect, it } from 'vitest'
import { COLOR_ORIGINAL, DISENO_INICIAL, normalizar } from './diseno'

// Lo guardado en la base de datos puede venir incompleto, viejo o estropeado: la web nunca debe romperse
describe('normalizar (Diseño de la web)', () => {
  it('sin nada guardado: el diseño de siempre', () => {
    expect(normalizar(null)).toEqual(DISENO_INICIAL)
    expect(normalizar('texto')).toEqual(DISENO_INICIAL)
  })

  it('descarta valores que no existen y colores mal escritos', () => {
    const d = normalizar({ color: 'rojo', fuenteTitulos: 'comic-sans', esquinas: 'redondas' })
    expect(d.color).toBe(COLOR_ORIGINAL)
    expect(d.fuenteTitulos).toBe(DISENO_INICIAL.fuenteTitulos)
    expect(d.esquinas).toBe('redondas')
  })

  it('no deja meter CSS por el color', () => {
    expect(normalizar({ color: '#fff;} body{display:none' }).color).toBe(COLOR_ORIGINAL)
    expect(normalizar({ color: '#AABBCC' }).color).toBe('#aabbcc')
  })

  it('quita secciones repetidas o desconocidas y añade al final las nuevas', () => {
    const d = normalizar({ secciones: [
      { id: 'resenas', visible: false }, { id: 'resenas', visible: true }, { id: 'inventada', visible: true },
    ] })
    expect(d.secciones[0]).toEqual({ id: 'resenas', visible: false })
    expect(d.secciones.map(s => s.id).sort()).toEqual(DISENO_INICIAL.secciones.map(s => s.id).sort())
    expect(d.secciones.filter(s => s.id === 'resenas')).toHaveLength(1)
  })
})
