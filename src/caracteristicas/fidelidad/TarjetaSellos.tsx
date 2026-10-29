import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tarjetaFidelidad } from '../../lib/api'
import { obtenerTextosGuardados, leerTextosLocales } from '../../lib/textos'
import { leerFidelidad, tamanoTarjeta, sellosEnTarjeta, premioAlLlegar, siguientePremio } from '../../lib/fidelidad'
import { useVisto } from '../../componentes/Movimiento'

// Sellos de la clienta. Solo sale si Lynn activó la tarjeta, la clienta participa y la base de datos la tiene.
// Las casillas con premio muestran su porcentaje.
export default function TarjetaSellos({ token, className = '' }: { token: string; className?: string }) {
  const qTextos = useQuery({ queryKey: ['textos'], queryFn: obtenerTextosGuardados, staleTime: 10 * 60_000, placeholderData: leerTextosLocales })
  const cfg = leerFidelidad(qTextos.data)
  const q = useQuery({ queryKey: ['fidelidad', token], queryFn: () => tarjetaFidelidad(token), enabled: cfg.activa })
  const [ref, visto] = useVisto<HTMLDivElement>()
  if (!cfg.activa || !q.data || q.data.fuera) return null

  const sellos = Number(q.data.completadas) || 0
  const tamano = tamanoTarjeta(cfg)
  const llenos = sellosEnTarjeta(cfg, sellos)
  const ganado = premioAlLlegar(cfg, sellos)
  const premioListo = !!ganado && !!q.data.descuento_pendiente
  const siguiente = siguientePremio(cfg, sellos)
  const titulo = premioListo ? `¡${ganado!.premio}% de regalo en tu próxima cita!`
    : siguiente ? `${siguiente.faltan} ${siguiente.faltan === 1 ? 'cita' : 'citas'} para tu ${siguiente.nivel.premio}% de descuento`
    : '¡Completaste tu tarjeta!'

  return (
    <div ref={ref} className={`${className} relative overflow-hidden rounded-xl bg-gradient-to-br from-rosa-500 via-rosa-600 to-vino text-white p-5 shadow-boton`}>
      <div className="aurora opacity-60" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/80">Tarjeta de fidelidad</div>
          <div className="font-display text-[22px] leading-tight mt-1">{titulo}</div>
        </div>
        <span aria-hidden className="text-[28px]">{premioListo ? '🎁' : '💅'}</span>
      </div>
      <div className="relative grid grid-cols-5 gap-2 mt-4" role="img" aria-label={`${llenos} de ${tamano} sellos`}>
        {Array.from({ length: tamano }).map((_, i) => {
          const nivel = cfg.niveles.find(n => n.citas === i + 1)
          const lleno = i < llenos
          return (
            <span key={i}
              className={`aspect-square rounded-full flex items-center justify-center border-2
                ${lleno ? 'bg-white text-rosa-700 border-white' : nivel ? 'border-white/80 bg-white/15' : 'border-white/40 border-dashed'}
                ${lleno && visto ? 'animate-pop' : ''}`}
              style={{ animationDelay: `${i * 90}ms` } as CSSProperties}>
              {lleno ? <span className="text-[15px]">{nivel ? '🎁' : '★'}</span>
                : nivel ? <span className="text-[11px] font-bold leading-none">{nivel.premio}%</span> : null}
            </span>
          )
        })}
      </div>
      {cfg.niveles.length > 1 && (
        <p className="relative text-[12px] text-white/80 mt-3">
          Premios: {cfg.niveles.map(n => `${n.premio}% en la ${n.citas}.ª cita`).join(' · ')}
          {cfg.repetir ? ' · y vuelve a empezar' : ''}
        </p>
      )}
      {premioListo && <p className="relative text-[13px] text-white/85 mt-2">Se aplica solo al reservar con tu mismo teléfono.</p>}
    </div>
  )
}
