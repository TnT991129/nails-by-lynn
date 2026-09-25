import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listarClientas } from '../../lib/panel/api-panel'
import { Tarjeta, Esqueleto, Aviso, Vacio } from '../../componentes/ui'
import { fechaLarga } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

export default function Clientas() {
  const [busq, setBusq] = useState('')
  const q = useQuery({
    queryKey: ['clientas', busq],
    queryFn: () => listarClientas(busq || undefined),
  })

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-[30px]">Clientas</h1>
        <Link to="/panel/clientas/nueva"
          className="min-h-[44px] px-4 inline-flex items-center rounded-sm bg-rosa-600 text-white text-[14px] font-medium">
          + Nueva
        </Link>
      </div>
      <input value={busq} onChange={e => setBusq(e.target.value)}
        placeholder="Buscar por nombre, teléfono o @instagram"
        className="w-full min-h-[48px] px-4 rounded-sm border border-rosa-200 text-[16px]" />

      {q.isLoading && <div className="space-y-2">
        {Array.from({length:4}).map((_,i) => <Esqueleto key={i} className="h-20" />)}
      </div>}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
      {q.data && q.data.length === 0 && (
        busq ? <p className="text-tinta-tenue">Sin resultados.</p>
             : <Vacio titulo="Aún no tienes clientas registradas"
                 texto="Cuando alguien reserve o crees una cita manual aparecerá aquí." />
      )}

      <div className="space-y-2">
        {q.data?.map(c => (
          <Link key={c.id} to={`/panel/clientas/${c.id}`} className="block">
            <Tarjeta className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[16px] font-medium truncate">
                  {c.full_name}{c.is_blocked && <span className="text-[12px] text-estado-error"> · bloqueada</span>}
                </div>
                <div className="text-[14px] text-tinta-tenue shrink-0">
                  {c.total_appointments} {c.total_appointments === 1 ? 'cita' : 'citas'}
                </div>
              </div>
              <div className="text-[14px] text-tinta-tenue truncate">
                {c.phone}{c.last_appointment_at && ` · última: ${fechaLarga(c.last_appointment_at)}`}
              </div>
              {(c.total_no_shows > 0 || c.total_cancellations > 0) && (
                <div className="text-[12px] text-estado-error">
                  {c.total_no_shows > 0 && `${c.total_no_shows} no-show`}
                  {c.total_no_shows > 0 && c.total_cancellations > 0 && ' · '}
                  {c.total_cancellations > 0 && `${c.total_cancellations} cancelaciones`}
                </div>
              )}
            </Tarjeta>
          </Link>
        ))}
      </div>
    </div>
  )
}
