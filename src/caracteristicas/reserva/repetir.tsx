import { useNavigate } from 'react-router-dom'
import type { CitaDetalle } from '../../lib/tipos'

// "Reservar lo mismo otra vez": se abre la reserva con los mismos servicios y complementos marcados.
// Van por nombre porque la cita guarda una copia del nombre; si alguno ya no existe, simplemente no se marca.
export type Repetir = { servicios: string[]; complementos: string[]; nombre?: string; telefono?: string }

type CitaParaRepetir = Pick<CitaDetalle, 'servicios'> & { cliente?: CitaDetalle['cliente'] }

export function datosRepetir(c: CitaParaRepetir): Repetir {
  return {
    nombre: c.cliente?.nombre, telefono: c.cliente?.telefono,
    servicios: (c.servicios ?? []).map(s => s.nombre),
    complementos: [...new Set((c.servicios ?? []).flatMap(s => (s.complementos ?? []).map(a => a.nombre)))],
  }
}

export function BotonRepetir({ cita, compacto }: { cita: CitaParaRepetir; compacto?: boolean }) {
  const navegar = useNavigate()
  if (!cita.servicios?.length) return null
  const ir = () => navegar('/reservar', { state: { repetir: datosRepetir(cita) } })
  return compacto ? (
    <button onClick={ir} className="text-[13px] font-semibold text-rosa-800 min-h-[40px] px-1">
      ↻ Repetir esta cita
    </button>
  ) : (
    <button onClick={ir}
      className="w-full min-h-[52px] rounded-full border-2 border-rosa-200 bg-papel text-rosa-800
                 font-semibold text-[15px] active:scale-[0.98] transition">
      ↻ Reservar lo mismo otra vez
    </button>
  )
}
