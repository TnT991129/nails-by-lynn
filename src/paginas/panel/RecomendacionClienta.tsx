import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerClienta, ponerRecomendacion, recomendadasPor, recomendacionesInstaladas, type Cliente } from '../../lib/panel/api-panel'
import { Tarjeta, Aviso } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'

// En la ficha: quién la recomendó (se puede apuntar a mano si no lo puso al reservar) y a quién trajo ella
export default function RecomendacionClienta({ clienta }: { clienta: Cliente }) {
  const qc = useQueryClient()
  const qSql = useQuery({ queryKey: ['recomendaciones-instaladas'], queryFn: recomendacionesInstaladas })
  const qQuien = useQuery({
    queryKey: ['cli', clienta.referred_by], queryFn: () => obtenerClienta(clienta.referred_by!), enabled: !!clienta.referred_by,
  })
  const qTrajo = useQuery({ queryKey: ['recomendadas', clienta.id], queryFn: () => recomendadasPor(clienta.id), enabled: qSql.data === true })
  const [editando, setEditando] = useState(false)
  const [telefono, setTelefono] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!qSql.data) return null

  async function guardar(tel: string | null) {
    setTrabajando(true); setError(null)
    try {
      await ponerRecomendacion(clienta.id, tel)
      qc.invalidateQueries({ queryKey: ['cli', clienta.id] })
      qc.invalidateQueries({ queryKey: ['recomendaciones'] })
      setEditando(false); setTelefono('')
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  const trajo = qTrajo.data ?? []
  const premiada = !!clienta.referral_rewarded_at

  return (
    <Tarjeta className="space-y-2">
      <div className="text-[14px] text-tinta-tenue">Recomendaciones</div>
      {clienta.referred_by ? (
        <div className="flex items-center justify-between gap-2 text-[15px]">
          <span>
            La recomendó{' '}
            <Link to={`/panel/clientas/${clienta.referred_by}`} className="font-medium underline underline-offset-2">
              {qQuien.data?.full_name ?? '…'}
            </Link>
            {premiada && <span className="text-estado-exito text-[13px]"> · ✓ premiadas</span>}
          </span>
          {!premiada && (
            <button onClick={() => guardar(null)} disabled={trabajando} className="text-[12px] text-estado-error min-h-[36px] px-1">
              Quitar
            </button>
          )}
        </div>
      ) : editando ? (
        <div className="flex gap-2">
          <input value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" autoFocus
                 placeholder="Teléfono de quien la recomendó" aria-label="Teléfono de quien la recomendó"
                 className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-papel" />
          <button onClick={() => guardar(telefono)} disabled={trabajando || !telefono.trim()}
                  className="min-h-[44px] px-4 rounded-full bg-rosa-600 text-white text-[14px] font-semibold disabled:opacity-50">
            Guardar
          </button>
        </div>
      ) : clienta.total_appointments === 0 ? (
        <button onClick={() => setEditando(true)} className="min-h-[40px] text-[14px] font-semibold text-rosa-800">
          + ¿La recomendó alguna clienta?
        </button>
      ) : (
        <p className="text-[14px] text-tinta-tenue">No vino recomendada.</p>
      )}

      {trajo.length > 0 && (
        <div className="text-[14px] pt-1">
          Ha traído a{' '}
          {trajo.map((t, i) => (
            <span key={t.id}>
              {i > 0 && (i === trajo.length - 1 ? ' y ' : ', ')}
              <Link to={`/panel/clientas/${t.id}`} className="font-medium underline underline-offset-2">{t.full_name}</Link>
            </span>
          ))}
        </div>
      )}
      {error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  )
}
