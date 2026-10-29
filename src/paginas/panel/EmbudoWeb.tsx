import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { embudoWeb } from '../../lib/panel/api-panel'
import { Tarjeta, Esqueleto, Aviso } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'

// Visitas y reservas de la web: cuánta gente entra, hasta qué paso llega y cuántas reservan.
// Anónimo (supabase/inspiracion_fidelidad_visitas.sql): un número al azar por visita, sin datos de nadie.
const PASOS: { evento: string; titulo: string }[] = [
  { evento: 'visita', titulo: 'Entraron a la web' },
  { evento: 'reserva_inicio', titulo: 'Empezaron a reservar' },
  { evento: 'reserva_fecha', titulo: 'Eligieron servicio' },
  { evento: 'reserva_hora', titulo: 'Eligieron día' },
  { evento: 'reserva_datos', titulo: 'Eligieron hora' },
  { evento: 'reserva_resumen', titulo: 'Pusieron sus datos' },
  { evento: 'reserva_hecha', titulo: 'Reservaron' },
]

export default function EmbudoWeb() {
  const [dias, setDias] = useState(30)
  const q = useQuery({ queryKey: ['embudo', dias], queryFn: () => embudoWeb(dias) })

  return (
    <Tarjeta className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sans text-[17px] font-semibold">Visitas y reservas</h2>
        <div className="flex gap-1 bg-rosa-50 rounded-full p-1 border border-rosa-100">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDias(d)}
              className={`px-3 min-h-[32px] rounded-full text-[13px] font-medium transition ${dias === d ? 'bg-papel text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
              {d} días
            </button>
          ))}
        </div>
      </div>

      {q.isLoading && <Esqueleto className="h-48" />}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
      {q.data === null && (
        <Aviso tipo="aviso">Falta ejecutar en Supabase el SQL <b>inspiracion_fidelidad_visitas.sql</b> para empezar a contar las visitas.</Aviso>
      )}
      {q.data && <Contenido datos={q.data} />}
    </Tarjeta>
  )
}

function Contenido({ datos }: { datos: NonNullable<Awaited<ReturnType<typeof embudoWeb>>> }) {
  const n = (e: string) => datos.eventos[e] ?? 0
  const visitas = n('visita')
  if (visitas === 0) return <p className="text-[14px] text-tinta-tenue">Aún no hay visitas contadas en estos días.</p>
  const hechas = n('reserva_hecha')
  const maxDia = Math.max(1, ...datos.por_dia.map(d => d.visitas))
  // El paso donde más gente se va (sin contar la visita)
  let peor: { titulo: string; perdida: number } | null = null
  for (let i = 2; i < PASOS.length; i++) {
    const antes = n(PASOS[i - 1].evento), ahora = n(PASOS[i].evento)
    const perdida = antes > 0 ? (antes - ahora) / antes : 0
    if (antes >= 3 && (!peor || perdida > peor.perdida)) peor = { titulo: PASOS[i].titulo, perdida }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Dato valor={visitas} texto="visitas" />
        <Dato valor={hechas} texto="reservas" />
        <Dato valor={`${Math.round(hechas / visitas * 1000) / 10}%`} texto="reservan" />
      </div>

      <ol className="space-y-2">
        {PASOS.map((p, i) => {
          const v = n(p.evento)
          return (
            <li key={p.evento}>
              <div className="flex justify-between text-[13px]">
                <span className="text-tinta-suave">{p.titulo}</span>
                <span className="font-semibold tabular-nums">{v}</span>
              </div>
              <div className="h-2.5 rounded-full bg-rosa-50 overflow-hidden mt-1">
                <div className="h-full rounded-full bg-gradient-to-r from-rosa-400 to-rosa-600 origin-left animate-[crecer_.9s_cubic-bezier(.22,1,.36,1)_backwards]"
                     style={{ width: `${Math.max(2, v / visitas * 100)}%`, animationDelay: `${i * 80}ms` }} />
              </div>
            </li>
          )
        })}
      </ol>

      {peor && peor.perdida > 0.3 && (
        <p className="text-[13px] bg-estado-aviso-fondo text-estado-aviso rounded-lg px-3 py-2">
          Donde más gente se va: <b>antes de «{peor.titulo.toLowerCase()}»</b> ({Math.round(peor.perdida * 100)}% no sigue).
        </p>
      )}

      {datos.por_dia.length > 1 && (
        <div>
          <div className="text-[13px] text-tinta-tenue mb-1.5">Visitas por día</div>
          <div className="flex items-end gap-[2px] h-20" role="img" aria-label="Visitas por día">
            {datos.por_dia.map(d => (
              <div key={d.dia} title={`${d.dia}: ${d.visitas}`}
                   className="flex-1 rounded-t bg-rosa-300 hover:bg-rosa-600 transition-colors origin-bottom animate-[subir-barra_.8s_cubic-bezier(.22,1,.36,1)_backwards]"
                   style={{ height: `${Math.max(4, d.visitas / maxDia * 100)}%` }} />
            ))}
          </div>
        </div>
      )}
      <p className="text-[12px] text-tinta-tenue">Cada visita se cuenta una vez. No se guarda nada de quién es.</p>
    </>
  )
}

function Dato({ valor, texto }: { valor: number | string; texto: string }) {
  return (
    <div className="rounded-lg bg-rosa-50/70 border border-rosa-100 py-2.5">
      <div className="font-display text-[24px] leading-none text-rosa-700">{valor}</div>
      <div className="text-[12px] text-tinta-tenue mt-1">{texto}</div>
    </div>
  )
}
