import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { obtenerCita } from '../lib/api'
import { tokensGuardados } from '../lib/almacenamiento'
import { Boton, Tarjeta, Pildora, Esqueleto, Vacio } from '../componentes/ui'
import { fechaLarga, hora } from '../lib/formato'

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

  if (tokens.length === 0) {
    return (
      <Vacio titulo="Aún no tienes citas" texto="Reserva la primera y aparecerá aquí.">
        <Link to="/reservar"><Boton>Reservar cita</Boton></Link>
      </Vacio>
    )
  }

  if (cargando) {
    return <div className="p-5 space-y-3">
      {Array.from({length:2}).map((_,i) => <Esqueleto key={i} className="h-28" />)}
    </div>
  }

  const Fila = ({ c }: { c: typeof citas[number] }) => (
    <Link to={`/cita/${c.token}`}>
      <Tarjeta className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[19px] font-semibold">
            {c.servicios?.map(s => s.nombre).join(' + ')}
          </span>
          <Pildora estado={c.estado} />
        </div>
        <div className="text-[14px] text-tinta-tenue capitalize">
          {fechaLarga(c.inicio)} · <span className="normal-case">{hora(c.inicio)}</span>
        </div>
      </Tarjeta>
    </Link>
  )

  return (
    <div className="p-5 pb-24 space-y-8">
      <section>
        <h1 className="text-[30px] mb-4">Mis citas</h1>
        {proximas.length === 0
          ? <Vacio titulo="Sin citas próximas" texto="Reserva cuando quieras.">
              <Link to="/reservar"><Boton>Reservar cita</Boton></Link>
            </Vacio>
          : <div className="space-y-3">{proximas.map(c => <Fila key={c.token} c={c} />)}</div>}
      </section>
      {pasadas.length > 0 && (
        <section>
          <h2 className="text-[24px] mb-4">Historial</h2>
          <div className="space-y-3">{pasadas.map(c => <Fila key={c.token} c={c} />)}</div>
        </section>
      )}
    </div>
  )
}
