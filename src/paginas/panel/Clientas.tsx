import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listarClientas, contadoresClientas } from '../../lib/panel/api-panel'
import { Tarjeta, Esqueleto, Aviso, Vacio, estiloBoton } from '../../componentes/ui'
import { IconoMas } from '../../componentes/iconos'
import { fechaLarga } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

export default function Clientas() {
  const [busq, setBusq] = useState('')
  const q = useQuery({
    queryKey: ['clientas', busq],
    queryFn: () => listarClientas(busq || undefined),
  })
  const qCont = useQuery({ queryKey: ['contadores-clientas'], queryFn: contadoresClientas })

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[30px] leading-tight">Clientas</h1>
        <Link to="/panel/clientas/nueva" className={`${estiloBoton('primario')} !min-h-[44px] !px-4 !text-[14px]`}>
          <IconoMas tam={16} strokeWidth={2.4} /> Nueva
        </Link>
      </div>
      <input value={busq} onChange={e => setBusq(e.target.value)}
        placeholder="Buscar por nombre, teléfono o @instagram"
        className="w-full min-h-[48px] px-4 rounded-full border border-rosa-200 text-[16px] bg-white
                   focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />

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
        {q.data?.map(c => {
          const k = qCont.data?.[c.id]
          const marcas = [
            k?.canceladas ? `${k.canceladas} ${k.canceladas === 1 ? 'cancelación' : 'cancelaciones'}` : null,
            k?.reagendadas ? `${k.reagendadas} ${k.reagendadas === 1 ? 'cambio de fecha' : 'cambios de fecha'}` : null,
            k?.noAsistio ? `${k.noAsistio} ${k.noAsistio === 1 ? 'falta' : 'faltas'}` : null,
          ].filter(Boolean)
          return (
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
              {(marcas.length > 0 || c.next_discount_percent) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                  {c.next_discount_percent ? (
                    <span className="px-2 py-0.5 rounded-full bg-rosa-50 text-rosa-800 font-semibold">
                      🎁 {Number(c.next_discount_percent)}% próxima cita
                    </span>
                  ) : null}
                  {marcas.length > 0 && <span className="text-estado-aviso">{marcas.join(' · ')}</span>}
                </div>
              )}
            </Tarjeta>
          </Link>
          )
        })}
      </div>
    </div>
  )
}
