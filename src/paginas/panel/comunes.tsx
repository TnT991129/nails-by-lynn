import { useNavigate } from 'react-router-dom'
import { IconoAtras } from '../../componentes/iconos'

/** Botón "Volver" común a las pantallas del panel */
export function Volver() {
  const navegar = useNavigate()
  return (
    <button onClick={() => navegar(-1)}
      className="-ml-2 min-h-[44px] pl-1 pr-3 rounded-full inline-flex items-center gap-1 text-[15px] text-tinta-suave hover:bg-rosa-50">
      <IconoAtras tam={20} /> Volver
    </button>
  )
}

/** Servicios y complementos de una cita, uno debajo de otro ("A + B + C" → lista) */
export function ListaServicios({ texto, className = '', vineta = 'text-rosa-600' }: {
  texto: string | null | undefined; className?: string; vineta?: string
}) {
  const items = (texto ?? '').split(' + ').map(s => s.trim()).filter(Boolean)
  return (
    <ul className={`space-y-0.5 ${className}`}>
      {items.map((s, i) => (
        <li key={i} className="flex gap-1.5">
          <span className={`shrink-0 ${vineta}`}>•</span>
          <span className="min-w-0 break-words">{s}</span>
        </li>
      ))}
    </ul>
  )
}

/** Interruptor de encendido/apagado (Tarjeta de fidelidad, Recomendaciones) */
export function Interruptor({ activo, onChange, etiqueta }: { activo: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return (
    <button role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => onChange(!activo)}
      className={`relative w-14 h-8 rounded-full transition-colors duration-300 shrink-0 ${activo ? 'bg-rosa-600' : 'bg-rosa-200'}`}>
      <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-300
                        ease-[cubic-bezier(.34,1.56,.64,1)] ${activo ? 'translate-x-6' : ''}`} />
    </button>
  )
}
