import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listarListaEspera, marcarAvisoEspera, type EnEspera } from '../../lib/panel/api-panel'
import { enlaceWhatsApp, mensajeListaEspera } from '../../lib/panel/whatsapp'
import { Tarjeta } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'
import { fechaISO } from '../../lib/formato'

// Al cancelarse una cita: quién estaba en la lista de espera ese día, con el WhatsApp listo
export default function EsperaDelDia({ inicio }: { inicio: string }) {
  const qc = useQueryClient()
  const dia = fechaISO(new Date(inicio))
  const q = useQuery({ queryKey: ['espera'], queryFn: listarListaEspera })
  const delDia = (q.data ?? []).filter(e => e.preferred_date_from === dia && e.clients)
  if (new Date(inicio).getTime() < Date.now() || delDia.length === 0) return null

  async function avisar(e: EnEspera) {
    window.open(enlaceWhatsApp(e.clients!.phone, mensajeListaEspera(e.clients!.full_name, e.preferred_date_from)),
      '_blank', 'noopener,noreferrer')
    try { await marcarAvisoEspera(e.id); qc.invalidateQueries({ queryKey: ['espera'] }) } catch { /* solo es una marca */ }
  }

  return (
    <Tarjeta className="space-y-3 border-2 border-rosa-300">
      <div>
        <div className="text-[15px] font-semibold">🔔 Se liberó este turno</div>
        <p className="text-[13px] text-tinta-tenue">
          {delDia.length === 1 ? 'Hay 1 clienta esperando' : `Hay ${delDia.length} clientas esperando`} un hueco ese día.
          Avisa primero a la que se apuntó antes.
        </p>
      </div>
      <ul className="space-y-2">
        {delDia.map(e => (
          <li key={e.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[15px] font-medium truncate">{e.clients!.full_name}</div>
              <div className="text-[12px] text-tinta-tenue">
                {e.services?.name ?? 'Cualquier servicio'}{e.notified_at && ' · ya avisada'}
              </div>
            </div>
            <button onClick={() => avisar(e)}
              className="shrink-0 min-h-[40px] px-3 rounded-full bg-whatsapp text-white text-[13px] font-semibold
                         inline-flex items-center gap-1.5 active:scale-[0.97] transition">
              <IconoWhatsApp tam={16} /> Avisar
            </button>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}
