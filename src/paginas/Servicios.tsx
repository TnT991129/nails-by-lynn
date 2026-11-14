import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { obtenerServicios } from '../lib/api'
import { Esqueleto, Aviso, Etiqueta } from '../componentes/ui'
import { IconoReloj, IconoFlecha } from '../componentes/iconos'
import { dinero, duracion, descripcionServicio } from '../lib/formato'
import { mensajeDeError } from '../lib/errores'
import EnCup from '../componentes/EnCup'
import { useTextos } from '../lib/textos'
import { Revelar } from '../componentes/Movimiento'

// La carta de servicios: cada uno es una tarjeta entera que lleva a reservarlo (sin un botón grande en cada una)
export default function Servicios() {
  const q = useQuery({ queryKey:['servicios'], queryFn: obtenerServicios })
  const t = useTextos()

  return (
    <div className="pb-24">
      <section className="px-4 pt-8 pb-5">
        <Etiqueta>Lo que hago</Etiqueta>
        <h1 className="text-[34px] leading-tight mt-1 linea-mascara"><span>{t('servicios.titulo')}</span></h1>
        <p className="text-[15px] text-tinta-suave mt-2">Toca un servicio para reservarlo.</p>
      </section>
      <div className="px-4">
        {q.isLoading && <div className="space-y-3">
          {Array.from({length:5}).map((_,i) => <Esqueleto key={i} className="h-28" />)}</div>}
        {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
        <div className="space-y-3">
          {q.data?.map((s, i) => (
            <Revelar key={s.id} retraso={Math.min(i, 4) * 90}>
              <Link to={`/reservar?servicio=${s.slug}`}
                className="group flex gap-3 bg-papel rounded-xl border border-rosa-100/80 shadow-suave p-4
                           transition duration-300 hover:shadow-lg hover:border-rosa-200 active:bg-rosa-50">
                {s.cover_image_url && (
                  <img src={s.cover_image_url} alt="" loading="lazy" crossOrigin="anonymous"
                       className="w-20 h-20 rounded-lg object-cover shrink-0 bg-rosa-50" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <h2 className="text-[17px] font-semibold font-sans leading-snug">{s.name}</h2>
                    <span className="font-display text-[21px] leading-none shrink-0 text-right text-rosa-700">
                      {dinero(Number(s.price))}
                      <EnCup min={Number(s.price)} />
                    </span>
                  </div>
                  {descripcionServicio(s.short_description) && (
                    <p className="text-[14px] text-tinta-suave mt-1.5 line-clamp-3">{descripcionServicio(s.short_description)}</p>
                  )}
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-tinta-tenue">
                      <IconoReloj tam={14} /> {duracion(s.duration_minutes)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-rosa-800">
                      {t('servicios.boton')}
                      <IconoFlecha tam={16} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </Revelar>
          ))}
        </div>
      </div>
    </div>
  )
}
