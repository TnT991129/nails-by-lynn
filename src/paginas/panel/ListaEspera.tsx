import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { listarListaEspera, marcarAvisoEspera, quitarDeEspera, disponibilidad, type EnEspera } from '../../lib/panel/api-panel'
import { enlaceWhatsApp, mensajeListaEspera } from '../../lib/panel/whatsapp'
import { Tarjeta, Esqueleto, Aviso, Vacio } from '../../componentes/ui'
import { fechaLarga, hora } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

// Clientas que pidieron que las avisen si se libera un turno en un día concreto
export default function ListaEspera() {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['lista-espera'], queryFn: listarListaEspera })

  // Agrupar por día
  const porDia = new Map<string, EnEspera[]>()
  q.data?.forEach(e => porDia.set(e.preferred_date_from, [...(porDia.get(e.preferred_date_from) ?? []), e]))
  const dias = [...porDia.keys()]

  // ¿Hay algún turno libre ahora mismo ese día? (con una cita estándar de 1 hora)
  const libres = useQueries({
    queries: dias.map(d => ({ queryKey: ['disp-espera', d], queryFn: () => disponibilidad(d, 60) })),
  })

  async function avisar(e: EnEspera) {
    if (!e.clients) return
    window.open(enlaceWhatsApp(e.clients.phone, mensajeListaEspera(e.clients.full_name, e.preferred_date_from)),
                '_blank', 'noopener,noreferrer')
    try {
      await marcarAvisoEspera(e.id)
      qc.invalidateQueries({ queryKey: ['lista-espera'] })
    } catch (err) { setError(mensajeDeError(err)) }
  }

  async function quitar(id: string) {
    if (!confirm('¿Quitar a esta clienta de la lista de espera?')) return
    try {
      await quitarDeEspera(id)
      qc.invalidateQueries({ queryKey: ['lista-espera'] })
    } catch (err) { setError(mensajeDeError(err)) }
  }

  return (
    <div className="p-5 space-y-4">
      <button onClick={() => navegar(-1)} className="text-tinta-suave min-h-[44px]">← Volver</button>
      <div>
        <h1 className="font-display text-[30px]">Lista de espera</h1>
        <p className="text-[14px] text-tinta-tenue mt-1">
          Clientas que quieren un turno en un día que estaba lleno. Si alguien cancela, avísalas.
        </p>
      </div>

      {error && <Aviso>{error}</Aviso>}
      {q.isLoading && <Esqueleto className="h-32" />}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
      {q.data && q.data.length === 0 && (
        <Vacio titulo="Nadie en espera" texto="Cuando un día esté lleno, las clientas podrán apuntarse aquí." />
      )}

      {dias.map((dia, i) => {
        const turnos = libres[i]?.data ?? []
        return (
          <section key={dia} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-semibold capitalize">{fechaLarga(`${dia}T16:00:00Z`)}</h2>
              {turnos.length > 0 ? (
                <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#E6F4EF] text-estado-exito">
                  Libre: {turnos.map(hora).join(' y ')}
                </span>
              ) : libres[i]?.isSuccess && (
                <span className="text-[12px] text-tinta-tenue">Lleno</span>
              )}
            </div>
            {porDia.get(dia)!.map(e => (
              <Tarjeta key={e.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[16px] font-medium truncate">{e.clients?.full_name ?? 'Clienta'}</div>
                    <div className="text-[13px] text-tinta-tenue">
                      {e.clients?.phone}{e.services && ` · ${e.services.name}`}
                    </div>
                  </div>
                  <button onClick={() => quitar(e.id)} className="text-estado-error text-[13px] min-h-[44px] px-2 shrink-0">
                    Quitar
                  </button>
                </div>
                {e.notified_at && (
                  <div className="text-[12px] text-estado-exito">✓ Avisada el {fechaLarga(e.notified_at)}, {hora(e.notified_at)}</div>
                )}
                <button onClick={() => avisar(e)} disabled={!e.clients}
                  className="w-full min-h-[44px] rounded-full bg-[#25D366] text-white font-semibold text-[14px]
                             disabled:opacity-50 active:scale-[0.98] transition">
                  {e.notified_at ? 'Avisar otra vez por WhatsApp' : 'Avisar por WhatsApp'}
                </button>
              </Tarjeta>
            ))}
          </section>
        )
      })}
    </div>
  )
}
