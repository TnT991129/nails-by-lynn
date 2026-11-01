import { useQuery } from '@tanstack/react-query'
import { obtenerTextosGuardados, leerTextosLocales } from '../../lib/textos'
import { leerRecomendaciones, mensajeRecomendacion } from '../../lib/recomendaciones'
import { IconoWhatsApp } from '../../componentes/iconos'

// La clienta comparte por WhatsApp un enlace de reserva que ya lleva su número: si la amiga viene por primera vez,
// las dos ganan un descuento (Panel → Más → Recomendaciones). Solo sale si Lynn lo tiene activado.
export default function RecomiendaAmiga({ telefono, className = '' }: { telefono: string; className?: string }) {
  const qTextos = useQuery({ queryKey: ['textos'], queryFn: obtenerTextosGuardados, staleTime: 10 * 60_000, placeholderData: leerTextosLocales })
  const cfg = leerRecomendaciones(qTextos.data)
  if (!cfg.activa || cfg.premio <= 0 || !telefono) return null

  const urlReserva = `${location.origin}${import.meta.env.BASE_URL}reservar`
  // Sin número de destino: WhatsApp deja elegir a quién mandarlo
  const enlace = `https://wa.me/?text=${encodeURIComponent(mensajeRecomendacion(urlReserva, telefono, cfg))}`

  return (
    <div className={`${className} rounded-xl border border-rosa-200 bg-rosa-50/60 p-5 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-rosa-800">Recomienda a una amiga</div>
          <div className="font-display text-[20px] leading-tight mt-1">
            Tú ganas un {cfg.premio}% de descuento{cfg.amiga > 0 ? ` y ella un ${cfg.amiga}%` : ''}
          </div>
        </div>
        <span aria-hidden className="text-[28px]">💕</span>
      </div>
      <p className="text-[14px] text-tinta-suave">
        Mándale tu enlace. Cuando venga por primera vez, tienes el descuento en tu próxima cita
        {cfg.amiga > 0 ? ' y ella en su segunda' : ''}.
      </p>
      <a href={enlace} target="_blank" rel="noreferrer"
         className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-whatsapp px-5
                    font-semibold text-white transition hover:bg-whatsapp-oscuro active:scale-[0.98]">
        <IconoWhatsApp tam={19} /> Mandar por WhatsApp
      </a>
    </div>
  )
}
