import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react'

// Animaciones sin librerías (la web se abre con datos móviles): solo CSS + IntersectionObserver.
// Si el móvil pide «reducir movimiento» o es muy antiguo, todo aparece quieto y visible.

export const conMovimiento = typeof window !== 'undefined'
  && 'IntersectionObserver' in window
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

// index.css solo oculta lo que está por revelar cuando <html> tiene la clase «anima»
if (conMovimiento) document.documentElement.classList.add('anima')

// Un único observador para toda la página
let observador: IntersectionObserver | null = null
const alVer = new WeakMap<Element, () => void>()

function observar(el: Element, cb: () => void) {
  observador ??= new IntersectionObserver(entradas => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue
      alVer.get(e.target)?.()
      observador!.unobserve(e.target)
      alVer.delete(e.target)
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
  alVer.set(el, cb)
  observador.observe(el)
  return () => { observador?.unobserve(el); alVer.delete(el) }
}

/** true en cuanto el elemento entra en pantalla (una sola vez) */
export function useVisto<T extends Element>() {
  const ref = useRef<T>(null)
  const [visto, setVisto] = useState(!conMovimiento)
  useEffect(() => {
    if (!ref.current || visto) return
    return observar(ref.current, () => setVisto(true))
  }, [visto])
  return [ref, visto] as const
}

type PropsRevelar = {
  como?: ElementType
  /** Milisegundos de espera: para que una lista aparezca en cascada */
  retraso?: number
  /** Tipo de entrada (index.css): sube por defecto */
  efecto?: 'subir' | 'escala' | 'izquierda' | 'derecha'
  className?: string
  children?: ReactNode
}

/** Aparece con suavidad al llegar a él con el scroll */
export function Revelar({ como: Etiqueta = 'div', retraso = 0, efecto = 'subir', className = '', children }: PropsRevelar) {
  const [ref, visto] = useVisto<HTMLElement>()
  return (
    <Etiqueta ref={ref} data-revelar={efecto} className={`${visto ? 'visible' : ''} ${className}`}
              style={retraso ? { '--retraso': `${retraso}ms` } as CSSProperties : undefined}>
      {children}
    </Etiqueta>
  )
}

/** Desplaza el elemento más despacio que la página (efecto de profundidad) mientras se ve */
export function useParalaje<T extends HTMLElement>(factor = 0.12, maximo = 70) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !conMovimiento) return
    let pendiente = false
    const mover = () => {
      pendiente = false
      const y = window.scrollY
      if (y > window.innerHeight * 1.2) return   // ya no se ve: no gastar batería
      el.style.transform = `translate3d(0, ${Math.min(y * factor, maximo).toFixed(1)}px, 0)`
    }
    const alDesplazar = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(mover) } }
    window.addEventListener('scroll', alDesplazar, { passive: true })
    mover()
    return () => window.removeEventListener('scroll', alDesplazar)
  }, [factor, maximo])
  return ref
}

/** Cuenta desde 0 hasta el valor al aparecer en pantalla */
export function Contador({ valor, decimales = 0, duracion = 1100 }: { valor: number; decimales?: number; duracion?: number }) {
  const [ref, visto] = useVisto<HTMLSpanElement>()
  const [actual, setActual] = useState(conMovimiento ? 0 : valor)
  useEffect(() => {
    if (!visto || !conMovimiento) { setActual(valor); return }
    let marco = 0
    const inicio = performance.now()
    const paso = (t: number) => {
      const p = Math.min((t - inicio) / duracion, 1)
      setActual(valor * (1 - Math.pow(1 - p, 3)))   // frena al final
      if (p < 1) marco = requestAnimationFrame(paso)
    }
    marco = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(marco)
  }, [visto, valor, duracion])
  return <span ref={ref}>{actual.toLocaleString('es-CU', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}</span>
}

const COLORES_CONFETI = ['rgb(var(--rosa-600))', 'rgb(var(--rosa-400))', 'rgb(var(--rosa-200))', '#F5C26B', '#ffffff']

/** Lluvia de confeti (solo CSS) para celebrar una reserva */
export function Confeti({ piezas = 26 }: { piezas?: number }) {
  if (!conMovimiento) return null
  return (
    <div className="confeti" aria-hidden>
      {Array.from({ length: piezas }).map((_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`,
          background: COLORES_CONFETI[i % COLORES_CONFETI.length],
          animationDelay: `${(i % 9) * 90}ms`,
          animationDuration: `${2200 + (i % 5) * 320}ms`,
          '--giro': `${(i % 2 ? 1 : -1) * (240 + (i % 4) * 120)}deg`,
          '--deriva': `${((i * 53) % 120) - 60}px`,
        } as CSSProperties} />
      ))}
    </div>
  )
}
