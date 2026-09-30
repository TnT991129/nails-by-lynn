import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { citasEnRango } from '../../lib/panel/api-panel'
import { Tarjeta, Esqueleto, Aviso, Pildora, Vacio } from '../../componentes/ui'
import { IconoFlecha } from '../../componentes/iconos'
import { hora, duracion, fechaLarga, fechaISO, instanteEnHabana, importe } from '../../lib/formato'
import TasaDolar from './TasaDolar'
import EnCup from '../../componentes/EnCup'
import { sumarDias } from '../../componentes/CalendarioMes'
import { mensajeDeError } from '../../lib/errores'
import { ListaServicios } from './comunes'

// Hoy de 00:00 a 24:00 en hora de La Habana, aunque el móvil esté en otra zona
function iniFin(fecha: Date) {
  const hoy = fechaISO(fecha)
  return { desde: instanteEnHabana(hoy, '00:00'), hasta: instanteEnHabana(sumarDias(hoy, 1), '00:00') }
}

export default function Hoy() {
  const { desde, hasta } = useMemo(() => iniFin(new Date()), [])
  const q = useQuery({
    queryKey: ['hoy', desde],
    queryFn: () => citasEnRango(desde, hasta),
    refetchInterval: 60_000,
  })

  const ahora = Date.now()
  const activas = (q.data ?? []).filter(c =>
    c.status !== 'CANCELADA_CLIENTA' && c.status !== 'CANCELADA_NEGOCIO')
  // Próxima = la primera que aún no ha terminado y sigue pendiente de atender
  const proxima = activas.find(c => ['PENDIENTE', 'CONFIRMADA', 'EN_CURSO'].includes(c.status)
    && new Date(c.ends_at).getTime() >= ahora)
  const ingresoDia = activas
    .filter(c => c.status === 'COMPLETADA')
    .reduce((t, c) => t + Number(c.total_amount), 0)

  return (
    <div className="p-5 space-y-5">
      <div>
        <p className="text-[14px] text-tinta-tenue first-letter:uppercase">{fechaLarga(new Date().toISOString())}</p>
        <h1 className="text-[30px] leading-tight mt-1">Hoy</h1>
      </div>

      <TasaDolar />

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta className="text-center py-4">
          <div className="text-[12px] tracking-wider uppercase text-tinta-tenue">Citas</div>
          <div className="font-display text-[30px] mt-1">{activas.length}</div>
        </Tarjeta>
        <Tarjeta className="text-center py-4">
          <div className="text-[12px] tracking-wider uppercase text-tinta-tenue">Completadas</div>
          <div className="font-display text-[30px] mt-1">
            {activas.filter(c => c.status === 'COMPLETADA').length}
          </div>
        </Tarjeta>
      </div>

      {proxima && (
        <Link to={`/panel/cita/${proxima.id}`}
          className="block rounded-xl bg-gradient-to-br from-rosa-600 to-[#8f0d47] text-white p-5 shadow-boton
                     active:scale-[0.99] transition">
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/75">Próxima cita</div>
          <div className="font-display text-[36px] leading-none mt-2">{hora(proxima.starts_at)}</div>
          <div className="text-[17px] font-medium mt-2">{proxima.cliente_nombre}</div>
          <ListaServicios texto={proxima.servicios} vineta="text-white/60" className="text-[14px] text-white/85 mt-1" />
          <div className="text-[13px] text-white/70 mt-1">{duracion(proxima.total_duration_minutes)}</div>
          <div className="mt-3 text-[13px] font-semibold inline-flex items-center gap-1.5">
            Ver detalle <IconoFlecha tam={15} />
          </div>
        </Link>
      )}

      <section>
        <h2 className="text-[19px] font-semibold mb-3">Citas de hoy</h2>
        {q.isLoading && <div className="space-y-2">
          {Array.from({length:3}).map((_,i) => <Esqueleto key={i} className="h-20" />)}
        </div>}
        {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
        {q.data && activas.length === 0 && (
          <Vacio titulo="Día libre" texto="No tienes citas para hoy." />
        )}
        <div className="space-y-2">
          {activas.map(c => (
            <Link key={c.id} to={`/panel/cita/${c.id}`} className="block">
              <Tarjeta className="flex items-start gap-3">
                <div className="text-center min-w-[64px] pt-0.5">
                  <div className="font-display text-[19px]">{hora(c.starts_at)}</div>
                  <div className="text-[12px] text-tinta-tenue">
                    {duracion(c.total_duration_minutes)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[16px] font-medium truncate">{c.cliente_nombre}</div>
                    <div className="shrink-0"><Pildora estado={c.status} /></div>
                  </div>
                  <ListaServicios texto={c.servicios} className="text-[14px] text-tinta-tenue mt-1" />
                </div>
              </Tarjeta>
            </Link>
          ))}
        </div>
      </section>

      {ingresoDia > 0 && (
        <Tarjeta className="text-center py-3">
          <div className="text-[12px] tracking-wider uppercase text-tinta-tenue">Ingreso del día</div>
          <div className="font-display text-[24px] mt-1">{importe(ingresoDia)}</div>
          <EnCup min={ingresoDia} className="!text-[13px]" />
        </Tarjeta>
      )}
    </div>
  )
}
