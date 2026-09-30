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
