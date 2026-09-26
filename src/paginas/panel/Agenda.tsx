import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { citasEnRango } from '../../lib/panel/api-panel'
import { Tarjeta, Esqueleto, Aviso, Pildora, Boton } from '../../componentes/ui'
import { hora, duracion, fechaLarga, fechaISO } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

type Vista = 'dia' | 'semana'

function inicioSemana(d: Date) {
  const r = new Date(d); r.setHours(0,0,0,0)
  const dow = r.getDay() // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow  // lunes como primer dia
  r.setDate(r.getDate() + diff)
  return r
}

export default function Agenda() {
  const [vista, setVista] = useState<Vista>('dia')
  const [ref, setRef] = useState<Date>(new Date())

  const { desde, hasta, titulo } = useMemo(() => {
    if (vista === 'dia') {
      const d = new Date(ref); d.setHours(0,0,0,0)
      const f = new Date(d); f.setDate(f.getDate() + 1)
      return { desde: d.toISOString(), hasta: f.toISOString(), titulo: fechaLarga(d.toISOString()) }
    }
    const d = inicioSemana(ref); const f = new Date(d); f.setDate(f.getDate() + 7)
    return { desde: d.toISOString(), hasta: f.toISOString(),
             titulo: `Semana del ${d.getDate()}` }
  }, [vista, ref])

  const q = useQuery({
    queryKey: ['agenda', desde, hasta],
    queryFn: () => citasEnRango(desde, hasta),
  })

  function mover(dir: -1 | 1) {
    const d = new Date(ref)
    if (vista === 'dia') d.setDate(d.getDate() + dir)
    else d.setDate(d.getDate() + dir * 7)
    setRef(d)
  }

  const activas = (q.data ?? []).filter(c =>
    c.status !== 'CANCELADA_CLIENTA' && c.status !== 'CANCELADA_NEGOCIO')

  // Agrupar por dia para la vista semana
  const porDia: Record<string, typeof activas> = {}
  activas.forEach(c => {
    const clave = fechaISO(new Date(c.starts_at))
    ;(porDia[clave] ??= []).push(c)
  })

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[30px] leading-tight">Agenda</h1>
        <div className="flex gap-1 bg-white rounded border border-rosa-200 p-1">
          {(['dia','semana'] as Vista[]).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-3 py-1.5 rounded text-[14px] min-h-[36px]
                ${vista === v ? 'bg-rosa-600 text-white' : 'text-tinta-suave'}`}>
              {v === 'dia' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => mover(-1)}
          className="min-h-[44px] px-4 text-tinta-suave">←</button>
        <span className="text-[16px] first-letter:uppercase">{titulo}</span>
        <button onClick={() => mover(1)}
          className="min-h-[44px] px-4 text-tinta-suave">→</button>
      </div>

      {ref.toDateString() !== new Date().toDateString() && (
        <button onClick={() => setRef(new Date())}
          className="text-[14px] text-rosa-800 underline">Volver a hoy</button>
      )}

      <Link to="/panel/agenda/nueva"><Boton ancho>+ Cita manual</Boton></Link>

      {q.isLoading && <div className="space-y-2">
        {Array.from({length:4}).map((_,i) => <Esqueleto key={i} className="h-20" />)}
      </div>}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}

      {q.data && activas.length === 0 && (
        <Tarjeta className="text-center py-8 text-tinta-tenue">Sin citas</Tarjeta>
      )}

      {vista === 'dia' && (
        <div className="space-y-2">
          {activas.map(c => (
            <Link key={c.id} to={`/panel/cita/${c.id}`} className="block">
              <Tarjeta className="flex items-center gap-3">
                <div className="text-center min-w-[64px]">
                  <div className="font-display text-[19px]">{hora(c.starts_at)}</div>
                  <div className="text-[12px] text-tinta-tenue">{duracion(c.total_duration_minutes)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-medium truncate">{c.cliente_nombre}</div>
                  <div className="text-[14px] text-tinta-tenue truncate">{c.servicios}</div>
                </div>
                <Pildora estado={c.status} />
              </Tarjeta>
            </Link>
          ))}
        </div>
      )}

      {vista === 'semana' && (
        <div className="space-y-4">
          {Object.entries(porDia).sort(([a],[b]) => a.localeCompare(b)).map(([fecha, citas]) => (
            <section key={fecha}>
              <h3 className="text-[14px] font-medium first-letter:uppercase mb-2">
                {fechaLarga(new Date(fecha).toISOString())}
              </h3>
              <div className="space-y-2">
                {citas.sort((a,b) => a.starts_at.localeCompare(b.starts_at)).map(c => (
                  <Link key={c.id} to={`/panel/cita/${c.id}`} className="block">
                    <Tarjeta className="flex items-center gap-3">
                      <div className="min-w-[56px] font-display text-[16px]">{hora(c.starts_at)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium truncate">{c.cliente_nombre}</div>
                        <div className="text-[12px] text-tinta-tenue truncate">{c.servicios}</div>
                      </div>
                      <Pildora estado={c.status} />
                    </Tarjeta>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
