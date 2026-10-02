import { useQuery } from '@tanstack/react-query'
import { obtenerResenas } from '../../lib/api'
import { Etiqueta } from '../../componentes/ui'
import Estrellas from '../../componentes/Estrellas'

// Reseñas publicadas por Lynn. Si no hay ninguna, la sección no aparece.
export default function ResenasInicio() {
  const q = useQuery({ queryKey: ['resenas'], queryFn: obtenerResenas, staleTime: 30 * 60_000 })
  const r = q.data
  if (!r || r.total === 0) return null

  return (
    <section className="px-4 mt-12">
      <Etiqueta>Opiniones</Etiqueta>
      <div className="flex items-end justify-between gap-3 mt-1">
        <h2 className="text-[28px] leading-tight">Lo que dicen ellas</h2>
        <div className="text-right shrink-0">
          <div className="font-display text-[22px] leading-none">{Number(r.media).toLocaleString('es-CU')}</div>
          <div className="text-[12px] text-tinta-tenue">{r.total} {r.total === 1 ? 'opinión' : 'opiniones'}</div>
        </div>
      </div>
      <div className="mt-4 -mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
        {r.lista.map((x, i) => (
          <figure key={i} className="snap-start shrink-0 w-[78%] max-w-[320px] bg-papel rounded-xl border border-rosa-100/80 shadow-suave p-4">
            <Estrellas valor={x.estrellas} tam={16} />
            {x.comentario && <blockquote className="text-[15px] text-tinta-suave mt-2 line-clamp-5">«{x.comentario}»</blockquote>}
            <figcaption className="text-[13px] font-semibold mt-2">— {x.nombre}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
