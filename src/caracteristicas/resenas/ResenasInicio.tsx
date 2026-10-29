import { useQuery } from '@tanstack/react-query'
import { obtenerResenas } from '../../lib/api'
import { TituloSeccion } from '../../componentes/ui'
import Estrellas from '../../componentes/Estrellas'
import { useTextos } from '../../lib/textos'
import { Revelar, Contador } from '../../componentes/Movimiento'

type Resena = { estrellas: number; comentario: string | null; nombre: string }

function TarjetaResena({ x, oculta = false }: { x: Resena; oculta?: boolean }) {
  return (
    <figure aria-hidden={oculta || undefined}
      className="shrink-0 w-[280px] bg-papel rounded-xl border border-rosa-100/80 shadow-suave p-4 relative overflow-hidden">
      {/* Comillas grandes de adorno */}
      <span aria-hidden className="absolute -top-3 right-3 font-display text-[84px] leading-none text-rosa-100 select-none">&rdquo;</span>
      <div className="relative">
        <Estrellas valor={x.estrellas} tam={16} />
        {x.comentario && <blockquote className="text-[15px] text-tinta-suave mt-2 line-clamp-5">«{x.comentario}»</blockquote>}
        <figcaption className="flex items-center gap-2 text-[13px] font-semibold mt-3">
          <span aria-hidden className="w-7 h-7 rounded-full bg-gradient-to-br from-rosa-400 to-vino text-white text-[12px]
                                       flex items-center justify-center">{x.nombre.charAt(0).toUpperCase()}</span>
          {x.nombre}
        </figcaption>
      </div>
    </figure>
  )
}

// Reseñas publicadas por Lynn. Si no hay ninguna, la sección no aparece.
export default function ResenasInicio() {
  const q = useQuery({ queryKey: ['resenas'], queryFn: obtenerResenas, staleTime: 30 * 60_000 })
  const t = useTextos()
  const r = q.data
  if (!r || r.total === 0) return null
  const media = Number(r.media)

  return (
    <section className="mt-14">
      <TituloSeccion etiqueta={t('inicio.resenas_etiqueta')} titulo={t('inicio.resenas_titulo')} className="px-4"
        extra={
          <div className="text-right shrink-0">
            <div className="font-display text-[28px] leading-none texto-degradado">
              <Contador valor={media} decimales={Number.isInteger(media) ? 0 : 1} />
            </div>
            <div className="text-[12px] text-tinta-tenue">{r.total} {r.total === 1 ? 'opinión' : 'opiniones'}</div>
          </div>
        } />

      {r.lista.length >= 3 ? (
        // Pasan solas sin parar (se detienen al tocarlas); la segunda copia es solo para que no haya salto
        <div className="resenas mt-5 overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          {/* Cada tarjeta lleva su propio espacio a la derecha: así las dos copias miden lo mismo y no hay salto */}
          <div className="resenas-pista">
            {r.lista.map((x, i) => <div key={i} className="pr-3"><TarjetaResena x={x} /></div>)}
            {r.lista.map((x, i) => <div key={`b${i}`} className="pr-3"><TarjetaResena x={x} oculta /></div>)}
          </div>
        </div>
      ) : (
        <div className="mt-5 px-4 flex gap-3 overflow-x-auto sin-scrollbar snap-x snap-mandatory pb-3 pt-1">
          {r.lista.map((x, i) => (
            <Revelar key={i} efecto="derecha" retraso={i * 110} className="snap-start"><TarjetaResena x={x} /></Revelar>
          ))}
        </div>
      )}
    </section>
  )
}
