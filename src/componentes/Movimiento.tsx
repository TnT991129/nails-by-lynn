import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

// Animaciones sin librerías (la web se abre con datos móviles): solo CSS + IntersectionObserver.
// Si el móvil pide «reducir movimiento» o es muy antiguo, todo aparece quieto y visible.

// (o si Lynn eligió «sin animaciones» en Diseño de la web: index.html lo deja en <html data-animaciones>)
export const conMovimiento = typeof window !== 'undefined'
  && 'IntersectionObserver' in window
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  && document.documentElement.dataset.animaciones !== 'ninguna'

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
  efecto?: 'subir' | 'escala' | 'izquierda' | 'derecha' | 'cortina'
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

// ---------- Efectos del rediseño ----------

/** Onda que sale del dedo al tocar cualquier elemento con la clase .toque (un solo oyente para toda la web) */
if (conMovimiento) {
  document.addEventListener('pointerdown', e => {
    const el = (e.target as Element | null)?.closest?.('.toque') as HTMLElement | null
    if (!el || (el as HTMLButtonElement).disabled) return
    const caja = el.getBoundingClientRect()
    const lado = Math.max(caja.width, caja.height) * 2.2
    const onda = document.createElement('span')
    onda.className = 'ondita'
    onda.style.cssText = `width:${lado}px;height:${lado}px;left:${e.clientX - caja.left - lado / 2}px;top:${e.clientY - caja.top - lado / 2}px`
    el.appendChild(onda)
    onda.addEventListener('animationend', () => onda.remove(), { once: true })
  }, { passive: true })
}

const conRaton = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

/** Tarjeta que se inclina hacia el ratón con una luz que lo sigue (en el móvil, solo la luz al tocar) */
export function useInclinacion<T extends HTMLElement>(grados = 7) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !conMovimiento) return
    let marco = 0
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(marco)
      marco = requestAnimationFrame(() => {
        const c = el.getBoundingClientRect()
        const x = (e.clientX - c.left) / c.width, y = (e.clientY - c.top) / c.height
        el.style.setProperty('--mx', `${x * 100}%`)
        el.style.setProperty('--my', `${y * 100}%`)
        el.style.setProperty('--luz', '1')
        if (conRaton) {
          el.style.setProperty('--rx', `${(0.5 - y) * grados}deg`)
          el.style.setProperty('--ry', `${(x - 0.5) * grados}deg`)
        }
      })
    }
    const salir = () => {
      cancelAnimationFrame(marco)
      for (const v of ['--rx', '--ry']) el.style.setProperty(v, '0deg')
      el.style.setProperty('--luz', '0')
    }
    el.addEventListener('pointermove', mover)
    el.addEventListener('pointerdown', mover)
    el.addEventListener('pointerleave', salir)
    if (!conRaton) el.addEventListener('pointerup', salir)   // en el móvil la luz se apaga al soltar
    el.addEventListener('pointercancel', salir)
    return () => {
      cancelAnimationFrame(marco)
      el.removeEventListener('pointermove', mover)
      el.removeEventListener('pointerdown', mover)
      el.removeEventListener('pointerleave', salir)
      el.removeEventListener('pointerup', salir)
      el.removeEventListener('pointercancel', salir)
    }
  }, [grados])
  return ref
}

/** Texto cuyas letras entran una a una (las palabras no se parten; los lectores de pantalla leen la frase) */
export function TextoLetras({ texto, retraso = 250 }: { texto: string; retraso?: number }) {
  let i = 0
  return (
    <span aria-label={texto} role="text" style={{ '--retraso': `${retraso}ms` } as CSSProperties}>
      {texto.split(/(\s+)/).map((palabra, p) => /^\s+$/.test(palabra) ? palabra : (
        <span key={p} aria-hidden className="inline-block whitespace-nowrap">
          {[...palabra].map(letra => <span key={i} className="letra" style={{ '--i': i++ } as CSSProperties}>{letra}</span>)}
        </span>
      ))}
    </span>
  )
}

/** Trazo a mano bajo un título; se dibuja cuando el título entra en pantalla */
export function Subrayado({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 12" fill="none" aria-hidden className={`subrayado h-3 w-28 ${className}`}>
      <path pathLength={1} d="M3 8.5C22 3 38 11 60 6.5S98 2.5 117 7" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  )
}

/** Barra fina arriba que se llena según se baja por la página (no sale en la reserva ni en el panel) */
export function BarraProgreso() {
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  const oculta = pathname.startsWith('/panel') || pathname.startsWith('/reservar')
  useEffect(() => {
    const el = ref.current
    if (!el || oculta || !conMovimiento) return
    let pendiente = false
    const pintar = () => {
      pendiente = false
      const max = document.documentElement.scrollHeight - window.innerHeight
      el.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`
    }
    const alDesplazar = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(pintar) } }
    window.addEventListener('scroll', alDesplazar, { passive: true })
    window.addEventListener('resize', alDesplazar, { passive: true })
    pintar()
    return () => { window.removeEventListener('scroll', alDesplazar); window.removeEventListener('resize', alDesplazar) }
  }, [oculta, pathname])
  if (oculta || !conMovimiento) return null
  return <div ref={ref} className="progreso-lectura" aria-hidden />
}
