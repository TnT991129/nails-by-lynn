import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { obtenerServicios } from '../lib/api'
import { Boton, Tarjeta, Esqueleto, Aviso } from '../componentes/ui'
import { dinero, duracion } from '../lib/formato'
import { mensajeDeError } from '../lib/errores'

export default function Servicios() {
  const q = useQuery({ queryKey:['servicios'], queryFn: obtenerServicios })

  return (
    <div className="p-5 pb-24">
      <h1 className="text-[30px] mb-5">Servicios</h1>
      {q.isLoading && <div className="space-y-3">
        {Array.from({length:5}).map((_,i) => <Esqueleto key={i} className="h-28" />)}</div>}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
      <div className="space-y-4">
        {q.data?.map(s => (
          <Tarjeta key={s.id} className="space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h2 className="text-[19px] font-semibold font-sans">{s.name}</h2>
                <p className="text-[14px] text-tinta-tenue">{duracion(s.duration_minutes)}</p>
              </div>
              <span className="font-display text-[22px] shrink-0">
                {dinero(Number(s.price), s.currency)}
              </span>
            </div>
            {s.short_description && (
              <p className="text-[14px] text-tinta-suave">{s.short_description}</p>
            )}
            <Link to={`/reservar?servicio=${s.slug}`}><Boton ancho>Reservar</Boton></Link>
          </Tarjeta>
        ))}
      </div>
    </div>
  )
}
