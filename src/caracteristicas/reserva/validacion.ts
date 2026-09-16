export function validarNombre(v: string): string | null {
  const t = v.trim()
  if (t.length < 2) return 'Escribe tu nombre completo.'
  if (t.length > 80) return 'El nombre es demasiado largo.'
  return null
}

// Cuba: 8 digitos (movil empieza en 5). Acepta con o sin +53.
export function validarTelefono(v: string): string | null {
  const d = v.replace(/[^0-9]/g, '')
  if (d.length === 0) return 'Necesitamos tu número para confirmarte la cita.'
  const local = d.startsWith('53') && d.length > 8 ? d.slice(2) : d
  if (local.length !== 8) return 'Revisa el número, parece incompleto.'
  return null
}

export function validarEmail(v: string): string | null {
  if (!v.trim()) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'Revisa el correo.'
}
