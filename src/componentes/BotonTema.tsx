import { useTema } from '../lib/tema'
import { IconoLuna, IconoSol } from './iconos'

// Botón redondo para pasar de modo claro a oscuro y al revés
export default function BotonTema({ className = '' }: { className?: string }) {
  const { oscuro, alternar } = useTema()
  return (
    <button type="button" onClick={alternar}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
      className={`w-11 h-11 rounded-full flex items-center justify-center border border-rosa-100
                  bg-papel text-tinta-suave hover:bg-rosa-50 transition-colors ${className}`}>
      {oscuro ? <IconoSol tam={20} /> : <IconoLuna tam={20} />}
    </button>
  )
}
