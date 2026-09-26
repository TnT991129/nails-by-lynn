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
