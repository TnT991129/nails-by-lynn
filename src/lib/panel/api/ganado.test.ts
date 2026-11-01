import { describe, expect, it } from 'vitest'
import { cobroEnUsd, ganadoCita, type CobroEmbebido } from './ganado'

const usd = (amount: number): CobroEmbebido => ({ amount, currency: 'USD', exchange_rate_used: null, status: 'PAGADO_COMPLETO' })
const cup = (amount: number, tasa: number | null): CobroEmbebido => ({ amount, currency: 'CUP', exchange_rate_used: tasa, status: 'PAGADO_COMPLETO' })

describe('cobroEnUsd', () => {
  it('deja los dólares como están', () => expect(cobroEnUsd(usd(5), null)).toBe(5))
  it('pasa los CUP con el dólar guardado en el cobro', () => expect(cobroEnUsd(cup(1200, 400), 500)).toBe(3))
  it('si el cobro no guardó el dólar, usa el actual', () => expect(cobroEnUsd(cup(1000, null), 500)).toBe(2))
  it('sin ningún precio del dólar da 0', () => expect(cobroEnUsd(cup(1000, null), null)).toBe(0))
})

describe('ganadoCita: lo que cuenta en Estadísticas', () => {
  it('el servicio costaba 4 y Lynn cobró 5: cuenta 5', () => {
    expect(ganadoCita({ total_amount: 4, payments: [usd(5)] }, null))
      .toEqual({ real: 5, cobrado: 5, estimado: 4, cobrada: true })
  })

  it('cobró menos de lo estimado: cuenta lo cobrado', () => {
    expect(ganadoCita({ total_amount: 10, payments: [usd(8)] }, null).real).toBe(8)
  })

  it('sin cobro apuntado: cuenta el precio estimado', () => {
    expect(ganadoCita({ total_amount: 4, payments: [] }, null)).toEqual({ real: 4, cobrado: 0, estimado: 4, cobrada: false })
    expect(ganadoCita({ total_amount: 4 }, null).real).toBe(4)
  })

  it('suma un cobro en CUP y otro en USD', () => {
    expect(ganadoCita({ total_amount: 4, payments: [cup(800, 400), usd(3)] }, null).real).toBe(5)
  })

  it('no cuenta cobros que no están pagados', () => {
    const reembolso = { ...usd(5), status: 'REEMBOLSADO' }
    expect(ganadoCita({ total_amount: 4, payments: [reembolso] }, null)).toMatchObject({ real: 4, cobrada: false })
  })

  it('un cobro en CUP sin precio del dólar no deja la cita en cero', () => {
    expect(ganadoCita({ total_amount: 4, payments: [cup(2000, null)] }, null)).toMatchObject({ real: 4, cobrada: false })
    expect(ganadoCita({ total_amount: 4, payments: [cup(2000, null)] }, 400).real).toBe(5)
  })

  it('el precio puede llegar como texto desde la base de datos', () => {
    expect(ganadoCita({ total_amount: '4.50' as unknown as number }, null).real).toBe(4.5)
  })
})
