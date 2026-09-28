import { useEffect, useRef, useState, type ReactNode } from 'react'

// Lista que Lynn ordena arrastrando el asa ⋮⋮ (dedo o ratón) o con las flechas ↑ ↓.
// Al soltar se llama a onCambio con el nuevo orden; el padre lo guarda.

type Props<T extends { id: string }> = {
  items: T[]
  onCambio: (ordenados: T[]) => void
  children: (item: T, asa: ReactNode) => ReactNode
  deshabilitado?: boolean
}

export default function ListaOrdenable<T extends { id: string }>({ items, onCambio, children, deshabilitado }: Props<T>) {
  const [orden, setOrden] = useState(items)
  const [arrastrado, setArrastrado] = useState<string | null>(null)
  const [desplazamiento, setDesplazamiento] = useState(0)
  const nodos = useRef(new Map<string, HTMLDivElement>())
  const inicioY = useRef(0)
  const ordenRef = useRef(items)

  // Si llegan datos nuevos del servidor y no se está arrastrando, se toman tal cual
  useEffect(() => {
    if (!arrastrado) { setOrden(items); ordenRef.current = items }
  }, [items, arrastrado])

  function mover(lista: T[], desde: number, hasta: number) {
    const nueva = [...lista]
    const [x] = nueva.splice(desde, 1)
    nueva.splice(hasta, 0, x)
    return nueva
  }

  const arrastradoRef = useRef<string | null>(null)

  function alPulsar(e: React.PointerEvent, id: string) {
    if (deshabilitado) return
    e.preventDefault()
    inicioY.current = e.clientY
    arrastradoRef.current = id
    setArrastrado(id)
    setDesplazamiento(0)
  }

  // Mientras se arrastra se escucha en toda la ventana: al reordenar, React mueve el elemento
  // dentro de la página y el navegador le quitaría el "agarre" del dedo (pointer capture).
  const manejadores = useRef({ mover: (_: PointerEvent) => {}, soltar: () => {} })
  manejadores.current = { mover: alMover, soltar: alSoltar }
  useEffect(() => {
    if (!arrastrado) return
    const mover = (e: PointerEvent) => manejadores.current.mover(e)
    const soltar = () => manejadores.current.soltar()
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
    }
  }, [arrastrado])

  function alMover(e: PointerEvent) {
    const idArrastrado = arrastradoRef.current
    if (!idArrastrado) return
    let dy = e.clientY - inicioY.current
    const lista = ordenRef.current
    const i = lista.findIndex(x => x.id === idArrastrado)
    // Posiciones de diseño (offsetTop), sin el desplazamiento visual de la tarjeta arrastrada
    const actual = nodos.current.get(idArrastrado)
    if (!actual) return
    const siguiente = lista[i + 1] && nodos.current.get(lista[i + 1].id)
    const anterior = lista[i - 1] && nodos.current.get(lista[i - 1].id)

    // Cruzó la mitad del vecino: se intercambian y se corrige el punto de partida
    if (siguiente && dy > siguiente.offsetHeight / 2) {
      const salto = (siguiente.offsetTop + siguiente.offsetHeight) - (actual.offsetTop + actual.offsetHeight)
      ordenRef.current = mover(lista, i, i + 1); setOrden(ordenRef.current)
      inicioY.current += salto; dy -= salto
    } else if (anterior && dy < -anterior.offsetHeight / 2) {
      const salto = actual.offsetTop - anterior.offsetTop
      ordenRef.current = mover(lista, i, i - 1); setOrden(ordenRef.current)
      inicioY.current -= salto; dy += salto
    }
    setDesplazamiento(dy)

    // Si el dedo llega al borde de la pantalla, la página se desplaza sola
    if (e.clientY < 90) window.scrollBy(0, -12)
    else if (e.clientY > window.innerHeight - 110) window.scrollBy(0, 12)
  }

  function alSoltar() {
    if (!arrastradoRef.current) return
    arrastradoRef.current = null
    setArrastrado(null); setDesplazamiento(0)
    const cambió = ordenRef.current.some((x, i) => x.id !== items[i]?.id)
    if (cambió) onCambio(ordenRef.current)
  }

  function flecha(id: string, dir: -1 | 1) {
    const i = orden.findIndex(x => x.id === id)
    const j = i + dir
    if (j < 0 || j >= orden.length) return
    const nuevo = mover(orden, i, j)
    setOrden(nuevo); ordenRef.current = nuevo
    onCambio(nuevo)
  }

  return (
    <div className="space-y-2">
      {orden.map((item, i) => {
        const activo = arrastrado === item.id
        const asa = (
          <div className="flex items-center shrink-0 -ml-1">
            <button type="button" aria-label="Mantén pulsado y arrastra para reordenar"
              onPointerDown={e => alPulsar(e, item.id)}
              disabled={deshabilitado}
              className="w-9 h-11 flex items-center justify-center text-tinta-tenue cursor-grab active:cursor-grabbing
                         touch-none select-none disabled:opacity-30">
              <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor" aria-hidden>
                <circle cx="5" cy="4" r="1.7" /><circle cx="11" cy="4" r="1.7" />
                <circle cx="5" cy="10" r="1.7" /><circle cx="11" cy="10" r="1.7" />
                <circle cx="5" cy="16" r="1.7" /><circle cx="11" cy="16" r="1.7" />
              </svg>
            </button>
            <div className="flex flex-col">
              <button type="button" onClick={() => flecha(item.id, -1)} disabled={deshabilitado || i === 0}
                aria-label="Subir" className="w-7 h-6 text-[12px] text-tinta-tenue disabled:opacity-25">▲</button>
              <button type="button" onClick={() => flecha(item.id, 1)} disabled={deshabilitado || i === orden.length - 1}
                aria-label="Bajar" className="w-7 h-6 text-[12px] text-tinta-tenue disabled:opacity-25">▼</button>
            </div>
          </div>
        )
        return (
          <div key={item.id}
            ref={el => { if (el) nodos.current.set(item.id, el); else nodos.current.delete(item.id) }}
            style={activo ? { transform: `translateY(${desplazamiento}px) scale(1.02)` } : undefined}
            className={`relative ${activo ? 'z-10 shadow-lg rounded-xl' : 'transition-transform'}`}>
            {children(item, asa)}
          </div>
        )
      })}
    </div>
  )
}
