import { describe, expect, it } from 'vitest'
import {
  duracion, fechaISO, horaDeTurno, importe, dinero, instanteEnHabana, leerNumero, numeroWhatsApp,
  precioRango, textoDias, textoTurnos,
} from './formato'

describe('instanteEnHabana', () => {
  it('pasa la hora de La Habana a UTC, con y sin horario de verano', () => {
    expect(instanteEnHabana('2026-07-15', '10:00')).toBe('2026-07-15T14:00:00.000Z')   // UTC−4
    expect(instanteEnHabana('2026-01-15', '10:00')).toBe('2026-01-15T15:00:00.000Z')   // UTC−5
  })
  it('fechaISO da el día de La Habana aunque en UTC ya sea mañana', () => {
    expect(fechaISO(new Date('2026-07-16T02:00:00Z'))).toBe('2026-07-15')
  })
})

describe('leerNumero (lo que escribe Lynn al cobrar)', () => {
  it('entiende comas, puntos y puntos de miles', () => {
    expect(leerNumero('12,5')).toBe(12.5)
    expect(leerNumero('12.5')).toBe(12.5)
    expect(leerNumero('14.400')).toBe(14400)
    expect(leerNumero('1.440,50')).toBe(1440.5)
    expect(leerNumero(' 5 ')).toBe(5)
  })
})

describe('dinero e importe', () => {
  it('dinero sin precio dice «Por definir»; importe pone $0', () => {
    expect(dinero(0)).toBe('Por definir')
    expect(importe(0)).toBe('$0')
    expect(importe(5)).toBe('$5')
    expect(importe(300, 'CUP')).toBe('300 CUP')
  })
  it('precioRango', () => {
    expect(precioRango(2, 4)).toBe('$2–4')
    expect(precioRango(4, null)).toBe('$4')
    expect(precioRango(4, 4)).toBe('$4')
  })
})

describe('textos de horario', () => {
  it('duracion', () => {
    expect(duracion(45)).toBe('45 min')
    expect(duracion(60)).toBe('1 hora')
    expect(duracion(150)).toBe('2 h 30 min')
  })
  it('turnos y días', () => {
    expect(horaDeTurno('13:00')).toBe('1:00 PM')
    expect(horaDeTurno('00:30')).toBe('12:30 AM')
    expect(textoTurnos(['10:00', '13:00', '16:00'])).toBe('10:00 AM, 1:00 PM y 4:00 PM')
    expect(textoDias([1, 2, 3, 4, 5, 6])).toBe('lunes a sábado')
    expect(textoDias([5, 1, 3])).toBe('lunes, miércoles y viernes')
    expect(textoDias([0, 1, 2, 3, 4, 5, 6])).toBe('todos los días')
  })
})

describe('numeroWhatsApp', () => {
  it('añade el 53 a los móviles cubanos de 8 dígitos', () => {
    expect(numeroWhatsApp('5234 5678')).toBe('5352345678')
    expect(numeroWhatsApp('+53 52345678')).toBe('5352345678')
  })
})
