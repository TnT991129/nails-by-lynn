import { useQuery } from '@tanstack/react-query'
import { obtenerResenas } from '../../lib/api'
import { Etiqueta } from '../../componentes/ui'
import Estrellas from '../../componentes/Estrellas'
import { useTextos } from '../../lib/textos'
import { Revelar, Contador } from '../../componentes/Movimiento'

// Reseñas publicadas por Lynn. Si no hay ninguna, la sección no aparece.
export default function ResenasInicio() {
  const q = useQuery({ queryKey: ['resenas'], queryFn: obtenerResenas, staleTime: 30 * 60_000 })
  const t = useTextos()
  const r = q.data
  if (!r || r.total === 0) return null

  return (
    <section className="px-4 mt-14">
      <Revelar>
        <Etiqueta>{t('inicio.resenas_etiqueta')}</Etiqueta>
        <div className="flex items-end justify-between gap-3 mt-1">
          <h2 className="text-[28px] leading-tight">{t('inicio.resenas_titulo')}</h2>
          <div className="text-right shrink-0">
            <div className="font-display text-[26px] leading-none texto-degradado">
              <Contador valor={Number(r.media)} decimales={Number.isInteger(Number(r.media)) ? 0 : 1} />
            </div>
            <div className="text-[12px] text-tinta-tenue">{r.total} {r.total === 1 ? 'opinión' : 'opiniones'}</div>
          </div>
        </div>
      </Revelar>
      <div className="mt-4 -mx-4 px-4 flex gap-3 overflow-x-auto sin-scrollbar snap-x snap-mandatory pb-3 pt-1">
        {r.lista.map((x, i) => (
          <Revelar como="figure" key={i} efecto="derecha" retraso={Math.min(i, 3) * 110}
            className="snap-start shrink-0 w-[78%] max-w-[320px] bg-papel rounded-xl border border-rosa-100/80 shadow-suave p-4 relative overflow-hidden">
            {/* Comillas grandes de adorno */}
            <span aria-hidden className="absolute -top-3 right-3 font-display text-[84px] leading-none text-rosa-100 select-none">&rdquo;</span>
            <div className="relative">
              <Estrellas valor={x.estrellas} tam={16} />
              {x.comentario && <blockquote className="text-[15px] text-tinta-suave mt-2 line-clamp-5">«{x.comentario}»</blockquote>}
              <figcaption className="text-[13px] font-semibold mt-2">— {x.nombre}</figcaption>
            </div>
          </Revelar>
        ))}
      </div>
    </section>
  )
}
