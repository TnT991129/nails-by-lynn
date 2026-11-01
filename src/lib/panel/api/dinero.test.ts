import { describe, expect, it } from 'vitest'
import { normalizarCodigoBono } from './dinero'

describe('normalizarCodigoBono (lo que escribe Lynn al cobrar)', () => {
  it('acepta minúsculas, espacios y sin guion', () => {
    expect(normalizarCodigoBono('lynn ab12')).toBe('LYNN-AB12')
    expect(normalizarCodigoBono(' LYNN-AB12 ')).toBe('LYNN-AB12')
    expect(normalizarCodigoBono('lynnab12')).toBe('LYNN-AB12')
  })
  it('deja como está un código que no empieza por LYNN', () => {
    expect(normalizarCodigoBono('ab12')).toBe('AB12')
  })
})
