import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { resumenMes, topServiciosMes, topClientasMes } from '../../lib/panel/api-panel'
import { Tarjeta, Esqueleto, Aviso, Etiqueta } from '../../componentes/ui'
import { dinero } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Estadisticas() {
  const navegar = useNavigate()
  const hoy = new Date()
  const [año, setAño] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())

  function mover(dir: -1 | 1) {
    let m = mes + dir; let a = año
    if (m < 0) { m = 11; a-- }
    if (m > 11) { m = 0; a++ }
    setMes(m); setAño(a)
  }

  const esMesActual = año === hoy.getFullYear() && mes === hoy.getMonth()

  const qResumen = useQuery({
    queryKey: ['resumen', año, mes],
    queryFn: () => resumenMes(año, mes),
  })
  const qServ = useQuery({
    queryKey: ['top-serv', año, mes],
    queryFn: () => topServiciosMes(año, mes),
  })
  const qCli = useQuery({
    queryKey: ['top-cli', año, mes],
    queryFn: () => topClientasMes(año, mes),
  })

  return (
    <div className="p-5 space-y-5">
      <button onClick={() => navegar(-1)} className="text-tinta-suave min-h-[44px]">← Volver</button>
      <h1 className="font-display text-[30px]">Estadísticas</h1>

      <div className="flex items-center justify-between">
        <button onClick={() => mover(-1)} className="min-h-[44px] px-4 text-tinta-suave">←</button>
        <span className="text-[16px] font-medium">{NOMBRES_MES[mes]} {año}</span>
        <button onClick={() => mover(1)} disabled={esMesActual}
          className="min-h-[44px] px-4 text-tinta-suave disabled:opacity-30">→</button>
      </div>

      {qResumen.isLoading && <Esqueleto className="h-40" />}
      {qResumen.isError && <Aviso>{mensajeDeError(qResumen.error)}</Aviso>}

      {qResumen.data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tarjeta className="text-center py-4">
              <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Ingresos</div>
              <div className="font-display text-[24px] mt-1">{dinero(qResumen.data.ingresos)}</div>
            </Tarjeta>
            <Tarjeta className="text-center py-4">
              <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Gastos</div>
              <div className="font-display text-[24px] mt-1">{dinero(qResumen.data.gastos)}</div>
            </Tarjeta>
          </div>

          <Tarjeta className={`text-center py-4 ${
            qResumen.data.neto >= 0 ? 'bg-rosa-50 border border-rosa-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Ingreso neto</div>
            <div className={`font-display text-[30px] mt-1 ${
              qResumen.data.neto >= 0 ? 'text-rosa-900' : 'text-red-700'
            }`}>{dinero(qResumen.data.neto)}</div>
          </Tarjeta>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Tarjeta className="py-3">
              <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Completadas</div>
              <div className="font-display text-[24px] mt-1">{qResumen.data.citas_completadas}</div>
            </Tarjeta>
            <Tarjeta className="py-3">
              <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">No-show</div>
              <div className="font-display text-[24px] mt-1">{qResumen.data.citas_no_show}</div>
            </Tarjeta>
            <Tarjeta className="py-3">
              <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Canceladas</div>
              <div className="font-display text-[24px] mt-1">{qResumen.data.citas_canceladas}</div>
            </Tarjeta>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Tarjeta className="py-3">
              <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Ticket promedio</div>
              <div className="font-display text-[19px] mt-1">{dinero(qResumen.data.ticket_promedio)}</div>
            </Tarjeta>
            <Tarjeta className="py-3">
              <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Clientas</div>
              <div className="font-display text-[19px] mt-1">{qResumen.data.clientas_atendidas}</div>
            </Tarjeta>
          </div>
        </>
      )}

      <section>
        <Etiqueta>Servicios más vendidos</Etiqueta>
        {qServ.isLoading && <Esqueleto className="h-24 mt-3" />}
        {qServ.data && qServ.data.length === 0 && (
          <p className="text-[13px] text-tinta-tenue mt-3">Sin datos este mes.</p>
        )}
        <div className="mt-3 space-y-2">
          {qServ.data?.map(s => (
            <Tarjeta key={s.nombre} className="flex justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-medium truncate">{s.nombre}</div>
                <div className="text-[12px] text-tinta-tenue">{s.cantidad} {s.cantidad === 1 ? 'cita' : 'citas'}</div>
              </div>
              <div className="text-[14px] font-display shrink-0">{dinero(s.ingresos)}</div>
            </Tarjeta>
          ))}
        </div>
      </section>

      <section>
        <Etiqueta>Clientas más frecuentes</Etiqueta>
        {qCli.isLoading && <Esqueleto className="h-24 mt-3" />}
        {qCli.data && qCli.data.length === 0 && (
          <p className="text-[13px] text-tinta-tenue mt-3">Sin datos este mes.</p>
        )}
        <div className="mt-3 space-y-2">
          {qCli.data?.map(c => (
            <Tarjeta key={c.id} className="flex justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-medium truncate">{c.nombre}</div>
                <div className="text-[12px] text-tinta-tenue">{c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'}</div>
              </div>
              <div className="text-[14px] font-display shrink-0">{dinero(c.gastado)}</div>
            </Tarjeta>
          ))}
        </div>
      </section>
    </div>
  )
}
