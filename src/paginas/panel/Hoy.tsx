import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { citasEnRango, ganadoEnCitas } from '../../lib/panel/api-panel'
import { Esqueleto, Aviso, Vacio, estiloBoton } from '../../componentes/ui'
import { hora, fechaLarga, fechaISO, instanteEnHabana, importe } from '../../lib/formato'
import RecordatoriosManana from './RecordatoriosManana'
import Cumpleanos from './Cumpleanos'
import VolverAVenir from './VolverAVenir'
import EnCup from '../../componentes/EnCup'
import { sumarDias } from '../../componentes/CalendarioMes'
import { mensajeDeError } from '../../lib/errores'
import { Cabecera, Seccion, Cifras, FilaCita } from './piezas'

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

  const activas = (q.data ?? []).filter(c =>
    c.status !== 'CANCELADA_CLIENTA' && c.status !== 'CANCELADA_NEGOCIO')
  // Lo cobrado de verdad en las completadas (o su precio estimado si aún no se apuntó el cobro)
  const completadas = activas.filter(c => c.status === 'COMPLETADA')
  const qGanado = useQuery({
    queryKey: ['ganado-hoy', completadas.map(c => c.id).join(',')],
    queryFn: () => ganadoEnCitas(completadas),
    enabled: completadas.length > 0,
  })
  const ingresoDia = completadas.length > 0 ? qGanado.data ?? 0 : 0

  // La que toca ahora: la que está en curso o, si no, la siguiente sin empezar
  const siguiente = activas.find(c => c.status === 'EN_CURSO')
    ?? activas.find(c => ['CONFIRMADA', 'PENDIENTE'].includes(c.status) && new Date(c.ends_at).getTime() > Date.now())

  return (
    <div className="p-5 space-y-6">
      <Cabecera titulo="Hoy" sobre={fechaLarga(new Date().toISOString())}
        accion={<Link to="/panel/agenda/nueva" className={`${estiloBoton('secundario')} !min-h-[42px] !px-4 !text-[14px]`}>+ Cita</Link>} />

      <Cifras datos={[
        { etiqueta: 'Citas', valor: activas.length },
        { etiqueta: 'Completadas', valor: completadas.length },
        { etiqueta: 'Ganado hoy', valor: importe(ingresoDia), apoyo: ingresoDia > 0 ? <EnCup min={ingresoDia} className="!text-[11px]" /> : undefined },
      ]} />

      <Seccion titulo="Citas de hoy" extra={siguiente ? `Ahora: ${siguiente.cliente_nombre.trim().split(/\s+/)[0]} · ${hora(siguiente.starts_at)}` : undefined}>
        {q.isLoading && <div className="space-y-2">
          {Array.from({length:3}).map((_,i) => <Esqueleto key={i} className="h-20" />)}
        </div>}
        {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
        {q.data && activas.length === 0 && (
          <Vacio titulo="Día libre" texto="No tienes citas para hoy." />
        )}
        <div className="space-y-2">
          {activas.map(c => <FilaCita key={c.id} cita={c} />)}
        </div>
      </Seccion>

      {/* Lo que conviene hacer hoy: cada bloque solo sale si tiene algo */}
      <Seccion titulo="Por hacer">
        <div className="space-y-3 empty:hidden peer">
          <RecordatoriosManana />
          <Cumpleanos />
          <VolverAVenir />
        </div>
        <p className="hidden peer-empty:block text-[14px] text-tinta-tenue px-1">Nada pendiente por ahora ✨</p>
      </Seccion>
    </div>
  )
}
