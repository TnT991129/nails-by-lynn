import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tarjetaFidelidad } from '../../lib/api'
import { obtenerTextosGuardados, leerTextosLocales } from '../../lib/textos'
import { leerFidelidad } from '../../lib/fidelidad'
import { useVisto } from '../../componentes/Movimiento'

// Sellos de la clienta (citas completadas). Solo sale si Lynn activó la tarjeta y la base de datos la tiene.
export default function TarjetaSellos({ token, className = '' }: { token: string; className?: string }) {
  const qTextos = useQuery({ queryKey: ['textos'], queryFn: obtenerTextosGuardados, staleTime: 10 * 60_000, placeholderData: leerTextosLocales })
  const cfg = leerFidelidad(qTextos.data)
  const q = useQuery({ queryKey: ['fidelidad', token], queryFn: () => tarjetaFidelidad(token), enabled: cfg.activa })
  const [ref, visto] = useVisto<HTMLDivElement>()
  if (!cfg.activa || !q.data) return null

  const hechas = Number(q.data.completadas) || 0
  const premioListo = !!q.data.descuento_pendiente && hechas > 0 && hechas % cfg.sellos === 0
  const llenos = premioListo ? cfg.sellos : hechas % cfg.sellos
  const faltan = cfg.sellos - llenos

  return (
    <div ref={ref} className={`${className} relative overflow-hidden rounded-xl bg-gradient-to-br from-rosa-500 via-rosa-600 to-vino text-white p-5 shadow-boton`}>
      <div className="aurora opacity-60" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/80">Tarjeta de fidelidad</div>
          <div className="font-display text-[22px] leading-tight mt-1">
            {premioListo ? `¡${cfg.premio}% de regalo en tu próxima cita!` : `${faltan} ${faltan === 1 ? 'cita' : 'citas'} para tu ${cfg.premio}% de descuento`}
          </div>
        </div>
        <span aria-hidden className="text-[28px]">{premioListo ? '🎁' : '💅'}</span>
      </div>
      <div className="relative grid grid-cols-5 gap-2 mt-4" role="img" aria-label={`${llenos} de ${cfg.sellos} sellos`}>
        {Array.from({ length: cfg.sellos }).map((_, i) => (
          <span key={i}
            className={`aspect-square rounded-full flex items-center justify-center text-[15px] border-2
              ${i < llenos ? 'bg-white text-rosa-700 border-white' : 'border-white/40 border-dashed'}
              ${i < llenos && visto ? 'animate-pop' : ''}`}
            style={{ animationDelay: `${i * 90}ms` } as CSSProperties}>
            {i < llenos ? '★' : ''}
          </span>
        ))}
      </div>
      {premioListo && <p className="relative text-[13px] text-white/85 mt-3">Se aplica solo al reservar con tu mismo teléfono.</p>}
    </div>
  )
}
