import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { obtenerCita } from '../lib/api'
import { tokensGuardados } from '../lib/almacenamiento'
import { Pildora, Esqueleto, Vacio, Etiqueta, estiloBoton } from '../componentes/ui'
import { IconoReloj } from '../componentes/iconos'
import { hora, ZONA } from '../lib/formato'

export default function MisCitas() {
  const tokens = tokensGuardados()

  const resultados = useQueries({
    queries: tokens.map(t => ({
      queryKey: ['cita', t],
      queryFn: () => obtenerCita(t),
      retry: false,
    })),
  })

  const cargando = resultados.some(r => r.isLoading)
  const citas = resultados
    .map((r, i) => r.data ? { ...r.data, token: tokens[i] } : null)
    .filter(Boolean) as (Awaited<ReturnType<typeof obtenerCita>> & { token: string })[]

  const ahora = Date.now()
  const proximas = citas.filter(c => new Date(c.inicio).getTime() >= ahora)
    .sort((a,b) => +new Date(a.inicio) - +new Date(b.inicio))
  const pasadas = citas.filter(c => new Date(c.inicio).getTime() < ahora)
    .sort((a,b) => +new Date(b.inicio) - +new Date(a.inicio))

  const Encabezado = (
    <section className="px-4 pt-8 pb-5">
      <Etiqueta>Tus reservas</Etiqueta>
      <h1 className="text-[34px] leading-tight mt-1">Mis citas</h1>
    </section>
  )

  if (tokens.length === 0) {
    return (
      <div className="pb-28">
        {Encabezado}
        <Vacio titulo="Aún no tienes citas" texto="Reserva la primera y aparecerá aquí.">
          <Link to="/reservar" className={estiloBoton()}>Reservar cita</Link>
        </Vacio>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="pb-28">
        {Encabezado}
        <div className="px-4 space-y-3">
          {Array.from({length:2}).map((_,i) => <Esqueleto key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  const Fila = ({ c, pasada }: { c: typeof citas[number]; pasada?: boolean }) => {
    const d = new Date(c.inicio)
    const dia = new Intl.DateTimeFormat('es', { timeZone: ZONA, day: 'numeric' }).format(d)
    const mes = new Intl.DateTimeFormat('es', { timeZone: ZONA, month: 'short' }).format(d).replace('.', '')
    const semana = new Intl.DateTimeFormat('es', { timeZone: ZONA, weekday: 'long' }).format(d)
    return (
      <Link to={`/cita/${c.token}`}
        className={`block bg-white rounded-xl border border-rosa-100/80 shadow-suave p-3.5
                    active:scale-[0.99] transition ${pasada ? 'opacity-75' : ''}`}>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center shrink-0
                           ${pasada ? 'bg-superficie-base text-tinta-suave' : 'bg-rosa-600 text-white'}`}>
            <span className="text-[22px] font-semibold leading-none">{dia}</span>
            <span className="text-[11px] uppercase tracking-wider mt-1 opacity-90">{mes}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold truncate">
              {c.servicios?.map(s => s.nombre).join(' + ')}
            </div>
            <div className="flex items-center gap-1.5 text-[13px] text-tinta-tenue mt-0.5">
              <IconoReloj tam={14} />
              <span className="capitalize">{semana}</span> · {hora(c.inicio)}
            </div>
            <div className="mt-2"><Pildora estado={c.estado} /></div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="pb-28">
      {Encabezado}
      <div className="px-4 space-y-8">
        <section>
          {proximas.length === 0
            ? <Vacio titulo="Sin citas próximas" texto="Reserva cuando quieras.">
                <Link to="/reservar" className={estiloBoton()}>Reservar cita</Link>
              </Vacio>
            : <div className="space-y-3">{proximas.map(c => <Fila key={c.token} c={c} />)}</div>}
        </section>
        {pasadas.length > 0 && (
          <section>
            <h2 className="text-[22px] mb-3">Historial</h2>
            <div className="space-y-3">{pasadas.map(c => <Fila key={c.token} c={c} pasada />)}</div>
          </section>
        )}
      </div>
    </div>
  )
}
