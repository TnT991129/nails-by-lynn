import { describe, expect, it } from 'vitest'
import {
  FIDELIDAD_INICIAL, leerFidelidad, limpiarNiveles, participa, premioAlLlegar, sellosEnTarjeta, siguientePremio,
  type ConfigFidelidad,
} from './fidelidad'

// 5.ª cita → 15 %, 10.ª → 20 %
const repite: ConfigFidelidad = { activa: true, modo: 'todas', repetir: true, niveles: [{ citas: 5, premio: 15 }, { citas: 10, premio: 20 }] }
const unaVez: ConfigFidelidad = { ...repite, repetir: false }

describe('leerFidelidad', () => {
  it('sin configuración: la inicial, apagada', () => {
    expect(leerFidelidad(null)).toEqual(FIDELIDAD_INICIAL)
    expect(leerFidelidad({ _fidelidad: 'esto no es JSON' })).toEqual(FIDELIDAD_INICIAL)
  })
  it('lee la versión anterior de un solo premio', () => {
    expect(leerFidelidad({ _fidelidad: JSON.stringify({ activa: true, sellos: 8, premio: 25 }) }))
      .toEqual({ activa: true, modo: 'todas', repetir: true, niveles: [{ citas: 8, premio: 25 }] })
  })
})

describe('limpiarNiveles', () => {
  it('ordena, quita repetidos y ajusta valores fuera de rango', () => {
    expect(limpiarNiveles([{ citas: 10, premio: 20 }, { citas: 5, premio: 15 }, { citas: 5, premio: 30 }, { citas: 99, premio: 500 }]))
      .toEqual([{ citas: 5, premio: 30 }, { citas: 10, premio: 20 }, { citas: 30, premio: 100 }])
  })
})

describe('tarjeta que se repite', () => {
  it('cuenta los sellos de la tarjeta actual', () => {
    expect(sellosEnTarjeta(repite, 0)).toBe(0)
    expect(sellosEnTarjeta(repite, 7)).toBe(7)
    expect(sellosEnTarjeta(repite, 10)).toBe(10)
    expect(sellosEnTarjeta(repite, 11)).toBe(1)
  })
  it('da cada premio al llegar a su cita', () => {
    expect(premioAlLlegar(repite, 5)).toEqual({ citas: 5, premio: 15 })
    expect(premioAlLlegar(repite, 6)).toBeNull()
    expect(premioAlLlegar(repite, 10)).toEqual({ citas: 10, premio: 20 })
    expect(premioAlLlegar(repite, 15)).toEqual({ citas: 5, premio: 15 })
  })
  it('dice cuántas citas faltan para el siguiente premio', () => {
    expect(siguientePremio(repite, 0)).toEqual({ nivel: { citas: 5, premio: 15 }, faltan: 5 })
    expect(siguientePremio(repite, 7)).toEqual({ nivel: { citas: 10, premio: 20 }, faltan: 3 })
    expect(siguientePremio(repite, 10)).toEqual({ nivel: { citas: 5, premio: 15 }, faltan: 5 })
  })
})

describe('tarjeta de una sola vez', () => {
  it('después de llenarse no da más premios', () => {
    expect(premioAlLlegar(unaVez, 10)).toEqual({ citas: 10, premio: 20 })
    expect(premioAlLlegar(unaVez, 15)).toBeNull()
    expect(siguientePremio(unaVez, 10)).toBeNull()
    expect(sellosEnTarjeta(unaVez, 14)).toBe(10)
  })
})

describe('para quién es la tarjeta', () => {
  it('sin «modo» (como estaba guardada antes) es para todas', () => {
    expect(leerFidelidad({ _fidelidad: JSON.stringify({ activa: true }) }).modo).toBe('todas')
    expect(leerFidelidad({ _fidelidad: JSON.stringify({ activa: true, modo: 'elegidas' }) }).modo).toBe('elegidas')
    expect(leerFidelidad({ _fidelidad: JSON.stringify({ activa: true, modo: 'otra-cosa' }) }).modo).toBe('todas')
  })
  it('para todas: participan todas menos las que Lynn saca', () => {
    expect(participa(repite, {})).toBe(true)
    expect(participa(repite, { loyalty_excluded: true })).toBe(false)
  })
  it('solo las elegidas: participan las que tienen la tarjeta', () => {
    const elegidas = { ...repite, modo: 'elegidas' as const }
    expect(participa(elegidas, {})).toBe(false)
    expect(participa(elegidas, { loyalty_enrolled: true })).toBe(true)
    expect(participa(elegidas, { loyalty_enrolled: true, loyalty_excluded: true })).toBe(true)
  })
  it('apagada: nadie', () => {
    expect(participa({ ...repite, activa: false }, { loyalty_enrolled: true })).toBe(false)
  })
})
