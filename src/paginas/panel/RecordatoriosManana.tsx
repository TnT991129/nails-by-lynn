import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  citasEnRango, tokensDeCitas, recordatoriosEnviados, registrarEnvio, type CitaAgenda,
} from '../../lib/panel/api-panel'
import { armarMensaje, enlaceWhatsApp } from '../../lib/panel/whatsapp'
import { Tarjeta, Aviso } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'
import { fechaISO, hora, instanteEnHabana } from '../../lib/formato'
import { sumarDias } from '../../componentes/CalendarioMes'
import { mensajeDeError } from '../../lib/errores'

// Recordatorios de las citas de mañana: uno debajo de otro, cada uno a un toque.
// Al enviar uno, el siguiente queda resaltado para seguir sin buscar.
export default function RecordatoriosManana() {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const { desde, hasta } = useMemo(() => {
    const manana = sumarDias(fechaISO(new Date()), 1)
    return { desde: instanteEnHabana(manana, '00:00'), hasta: instanteEnHabana(sumarDias(manana, 1), '00:00') }
  }, [])

  const q = useQuery({
    queryKey: ['manana', desde],
    queryFn: async () => {
      const citas = (await citasEnRango(desde, hasta)).filter(c => ['PENDIENTE', 'CONFIRMADA'].includes(c.status))
      const ids = citas.map(c => c.id)
      const [tokens, enviados] = await Promise.all([tokensDeCitas(ids), recordatoriosEnviados(ids)])
      return { citas, tokens, enviados }
    },
  })

  if (!q.data || q.data.citas.length === 0) return null
  const { citas, tokens, enviados } = q.data
  const pendientes = citas.filter(c => !enviados.includes(c.id))
  const siguiente = pendientes[0]?.id

  async function enviar(c: CitaAgenda) {
    setError(null)
    const mensaje = armarMensaje('recordatorio', {
      cliente_nombre: c.cliente_nombre, starts_at: c.starts_at, servicios: c.servicios ?? '',
      total_amount: Number(c.total_amount), currency: c.currency, code: c.code, access_token: tokens[c.id] ?? '',
    })
    window.open(enlaceWhatsApp(c.cliente_telefono, mensaje), '_blank', 'noopener,noreferrer')
    try {
      await registrarEnvio(c.id, 'recordatorio', mensaje, c.cliente_telefono)
      qc.invalidateQueries({ queryKey: ['manana'] })
      qc.invalidateQueries({ queryKey: ['notifs', c.id] })
    } catch (e) { setError(mensajeDeError(e)) }
  }

  return (
    <Tarjeta className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[15px] font-semibold">🔔 Recordatorios de mañana</div>
        <div className="text-[13px] text-tinta-tenue">
          {pendientes.length === 0 ? '✓ Todos enviados' : `${citas.length - pendientes.length} de ${citas.length}`}
        </div>
      </div>
      <ul className="space-y-2">
        {citas.map(c => {
          const hecho = enviados.includes(c.id)
          return (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[15px] font-medium truncate">{hora(c.starts_at)} · {c.cliente_nombre}</div>
              </div>
              <button onClick={() => enviar(c)}
                className={`shrink-0 min-h-[40px] px-3 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5
                  active:scale-[0.97] transition
                  ${hecho ? 'border border-rosa-200 text-tinta-tenue'
                    : c.id === siguiente ? 'bg-whatsapp text-white shadow-[0_8px_20px_-8px_rgba(37,211,102,.8)]'
                    : 'bg-whatsapp/80 text-white'}`}>
                {hecho ? '✓ Enviado' : <><IconoWhatsApp tam={16} /> Enviar</>}
              </button>
            </li>
          )
        })}
      </ul>
      {error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  )
}
