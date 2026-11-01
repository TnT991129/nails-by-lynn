import { describe, expect, it } from 'vitest'
import { validarEmail, validarNombre, validarTelefono } from './validacion'

describe('validarTelefono (Cuba)', () => {
  it('acepta un móvil de 8 dígitos, con o sin +53 y con espacios', () => {
    expect(validarTelefono('52345678')).toBeNull()
    expect(validarTelefono('+53 5234 5678')).toBeNull()
    expect(validarTelefono('53 52345678')).toBeNull()
  })
  it('rechaza vacío e incompleto', () => {
    expect(validarTelefono('')).toMatch(/número/)
    expect(validarTelefono('523456')).toMatch(/incompleto/)
  })
})

describe('validarNombre', () => {
  it('pide al menos 2 letras y como mucho 80', () => {
    expect(validarNombre(' A ')).not.toBeNull()
    expect(validarNombre('Ana')).toBeNull()
    expect(validarNombre('a'.repeat(81))).not.toBeNull()
  })
})

describe('validarEmail', () => {
  it('es opcional, pero si se escribe tiene que ser válido', () => {
    expect(validarEmail('')).toBeNull()
    expect(validarEmail('ana@correo.cu')).toBeNull()
    expect(validarEmail('ana@correo')).not.toBeNull()
  })
})
