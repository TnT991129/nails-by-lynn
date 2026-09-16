// Identidad por dispositivo: sin cuenta, los tokens de cita viven aqui.
const CLAVE_CITAS = 'nbl.citas'
const CLAVE_SESION = 'nbl.sesion'
const CLAVE_DISPOSITIVO = 'nbl.dispositivo'

function leer<T>(clave: string, fallback: T): T {
  try {
    const v = localStorage.getItem(clave)
    return v ? (JSON.parse(v) as T) : fallback
  } catch { return fallback }
}

function escribir(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* modo privado */ }
}

export function tokensGuardados(): string[] {
  return leer<string[]>(CLAVE_CITAS, [])
}

export function guardarToken(token: string) {
  const actuales = tokensGuardados()
  if (!actuales.includes(token)) escribir(CLAVE_CITAS, [token, ...actuales].slice(0, 50))
}

export function olvidarToken(token: string) {
  escribir(CLAVE_CITAS, tokensGuardados().filter(t => t !== token))
}

function aleatorio(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
}

export function tokenSesion(): string {
  let t = leer<string | null>(CLAVE_SESION, null)
  if (!t) { t = aleatorio(); escribir(CLAVE_SESION, t) }
  return t
}

export function nuevoTokenSesion(): string {
  const t = aleatorio()
  escribir(CLAVE_SESION, t)
  return t
}

export function idDispositivo(): string {
  let t = leer<string | null>(CLAVE_DISPOSITIVO, null)
  if (!t) { t = aleatorio(); escribir(CLAVE_DISPOSITIVO, t) }
  return t
}
