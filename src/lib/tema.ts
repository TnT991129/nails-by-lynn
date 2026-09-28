import { useEffect, useState } from 'react'

// Modo claro u oscuro. Sin elección guardada se sigue al móvil (prefers-color-scheme).
// index.html aplica la clase antes de pintar para que no haya destello blanco.
const CLAVE = 'nbl.tema'

function guardado(): 'claro' | 'oscuro' | null {
  try {
    const t = localStorage.getItem(CLAVE)
    return t === 'claro' || t === 'oscuro' ? t : null
  } catch { return null }
}

function aplicar(oscuro: boolean) {
  document.documentElement.classList.toggle('oscuro', oscuro)
}

export function useTema() {
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains('oscuro'))

  // Si la persona no eligió, acompañar los cambios del móvil (p. ej. modo oscuro automático de noche)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiar = () => { if (!guardado()) { aplicar(mq.matches); setOscuro(mq.matches) } }
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])

  return {
    oscuro,
    alternar() {
      const nuevo = !oscuro
      try { localStorage.setItem(CLAVE, nuevo ? 'oscuro' : 'claro') } catch { /* sin almacenamiento: solo esta visita */ }
      aplicar(nuevo)
      setOscuro(nuevo)
    },
  }
}
