import { describe, expect, it } from 'vitest'
import { leerRecomendaciones, mensajeRecomendacion, RECOMENDACIONES_INICIAL } from './recomendaciones'

describe('leerRecomendaciones', () => {
  it('sin configuración o estropeada: apagada con los valores de siempre', () => {
    expect(leerRecomendaciones(null)).toEqual(RECOMENDACIONES_INICIAL)
    expect(leerRecomendaciones({ _recomendaciones: '{roto' })).toEqual(RECOMENDACIONES_INICIAL)
  })
  it('deja los porcentajes entre 0 y 100', () => {
    expect(leerRecomendaciones({ _recomendaciones: JSON.stringify({ activa: true, premio: 250, amiga: -5 }) }))
      .toEqual({ activa: true, premio: 100, amiga: 0 })
  })
})

describe('mensajeRecomendacion', () => {
  const url = 'https://ejemplo.cu/reservar'
  it('lleva el número de la clienta en el enlace, solo dígitos', () => {
    expect(mensajeRecomendacion(url, '+53 5234-5678', { activa: true, premio: 10, amiga: 0 }))
      .toContain('https://ejemplo.cu/reservar?amiga=5352345678')
  })
  it('menciona el regalo de la amiga solo si lo hay', () => {
    expect(mensajeRecomendacion(url, '52345678', { activa: true, premio: 10, amiga: 15 })).toContain('15% de descuento')
    expect(mensajeRecomendacion(url, '52345678', { activa: true, premio: 10, amiga: 0 })).not.toContain('descuento')
  })
})
