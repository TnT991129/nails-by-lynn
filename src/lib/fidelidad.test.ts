import { describe, expect, it } from 'vitest'
import {
  FIDELIDAD_INICIAL, fidelidadParaGuardar, leerFidelidad, limpiarNiveles, limpiarTarjetas, premioAlLlegar,
  sellosEnTarjeta, siguientePremio, tarjetaDeClienta, type ConfigFidelidad, type ReglasTarjeta,
} from './fidelidad'

// 5.ª cita → 15 %, 10.ª → 20 %
const repite: ReglasTarjeta = { repetir: true, niveles: [{ citas: 5, premio: 15 }, { citas: 10, premio: 20 }] }
const unaVez: ReglasTarjeta = { ...repite, repetir: false }

describe('leerFidelidad', () => {
  it('sin configuración: la inicial, apagada', () => {
    expect(leerFidelidad(null)).toEqual(FIDELIDAD_INICIAL)
    expect(leerFidelidad({ _fidelidad: 'esto no es JSON' })).toEqual(FIDELIDAD_INICIAL)
  })
  it('lee la versión anterior de un solo premio', () => {
    expect(leerFidelidad({ _fidelidad: JSON.stringify({ activa: true, sellos: 8, premio: 25 }) }).tarjetas)
      .toEqual([{ id: 'principal', nombre: 'Normal', repetir: true, niveles: [{ citas: 8, premio: 25 }] }])
  })
  it('lee la configuración de una sola tarjeta (la que había hasta ahora)', () => {
    const c = leerFidelidad({ _fidelidad: JSON.stringify({ activa: true, repetir: false, niveles: [{ citas: 6, premio: 10 }] }) })
    expect(c.tarjetas).toEqual([{ id: 'principal', nombre: 'Normal', repetir: false, niveles: [{ citas: 6, premio: 10 }] }])
  })
  it('lee varias tarjetas', () => {
    const c = leerFidelidad({ _fidelidad: JSON.stringify({ activa: true, tarjetas: [
      { id: 'principal', nombre: 'Normal', niveles: [{ citas: 5, premio: 15 }] },
      { id: 'vip', nombre: 'VIP', repetir: false, niveles: [{ citas: 3, premio: 20 }] },
    ] }) })
    expect(c.tarjetas.map(t => t.nombre)).toEqual(['Normal', 'VIP'])
    expect(c.tarjetas[1].repetir).toBe(false)
  })
})

describe('limpiarNiveles y limpiarTarjetas', () => {
  it('ordena, quita repetidos y ajusta valores fuera de rango', () => {
    expect(limpiarNiveles([{ citas: 10, premio: 20 }, { citas: 5, premio: 15 }, { citas: 5, premio: 30 }, { citas: 99, premio: 500 }]))
      .toEqual([{ citas: 5, premio: 30 }, { citas: 10, premio: 20 }, { citas: 30, premio: 100 }])
  })
  it('quita tarjetas con el mismo id, pone nombre si falta y siempre deja al menos una', () => {
    const t = limpiarTarjetas([{ id: 'vip', nombre: '' }, { id: 'vip', nombre: 'Otra' }])
    expect(t).toHaveLength(1)
    expect(t[0].nombre).toBe('Normal')
    expect(limpiarTarjetas([])).toEqual(FIDELIDAD_INICIAL.tarjetas)
  })
  it('al guardar, los premios de la primera van también arriba (como antes)', () => {
    const g = fidelidadParaGuardar({ activa: true, modo: 'todas', tarjetas: [{ id: 'principal', nombre: 'N', repetir: false, niveles: [{ citas: 4, premio: 10 }] }] })
    expect(g.niveles).toEqual([{ citas: 4, premio: 10 }])
    expect(g.repetir).toBe(false)
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

describe('qué tarjeta tiene cada clienta (igual que la base de datos)', () => {
  const NORMAL = { id: 'principal', nombre: 'Normal', ...repite }
  const VIP = { id: 'vip', nombre: 'VIP', repetir: true, niveles: [{ citas: 3, premio: 20 }] }
  const todas: ConfigFidelidad = { activa: true, modo: 'todas', tarjetas: [NORMAL, VIP] }
  const elegidas: ConfigFidelidad = { ...todas, modo: 'elegidas' }

  it('para todas: sin tarjeta asignada, la primera; con una asignada, esa', () => {
    expect(tarjetaDeClienta(todas, {})?.nombre).toBe('Normal')
    expect(tarjetaDeClienta(todas, { loyalty_card: 'vip' })?.nombre).toBe('VIP')
    expect(tarjetaDeClienta(todas, { loyalty_card: 'borrada' })?.nombre).toBe('Normal')
  })
  it('para todas: la que Lynn saca no tiene ninguna', () => {
    expect(tarjetaDeClienta(todas, { loyalty_card: 'vip', loyalty_excluded: true })).toBeNull()
  })
  it('solo las elegidas: solo quien tiene una tarjeta dada', () => {
    expect(tarjetaDeClienta(elegidas, {})).toBeNull()
    expect(tarjetaDeClienta(elegidas, { loyalty_card: 'vip' })?.nombre).toBe('VIP')
    expect(tarjetaDeClienta(elegidas, { loyalty_card: 'borrada' })).toBeNull()
  })
  it('apagada: nadie', () => {
    expect(tarjetaDeClienta({ ...todas, activa: false }, { loyalty_card: 'vip' })).toBeNull()
  })
  it('sin «modo» guardado (como antes) es para todas', () => {
    expect(leerFidelidad({ _fidelidad: JSON.stringify({ activa: true }) }).modo).toBe('todas')
    expect(leerFidelidad({ _fidelidad: JSON.stringify({ activa: true, modo: 'otra-cosa' }) }).modo).toBe('todas')
  })
})
