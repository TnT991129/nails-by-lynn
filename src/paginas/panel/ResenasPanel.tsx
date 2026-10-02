import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listarResenas, publicarResena, eliminarResena, type Resena } from '../../lib/panel/api-panel'
import { Tarjeta, Aviso, Esqueleto, Vacio } from '../../componentes/ui'
import Estrellas from '../../componentes/Estrellas'
import { fechaLarga } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

// Opiniones de las clientas: Lynn decide cuáles salen en la página de inicio
export default function ResenasPanel() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['resenas-panel'], queryFn: listarResenas })
  const [error, setError] = useState<string | null>(null)

  async function cambiar(r: Resena, publicar: boolean) {
    setError(null)
    try {
      await publicarResena(r.id, publicar)
      qc.invalidateQueries({ queryKey: ['resenas-panel'] })
      qc.invalidateQueries({ queryKey: ['resenas'] })
    } catch (e) { setError(mensajeDeError(e)) }
  }

  async function borrar(r: Resena) {
    if (!confirm('¿Borrar esta opinión? No se puede deshacer.')) return
    try {
      await eliminarResena(r.id)
      qc.invalidateQueries({ queryKey: ['resenas-panel'] })
      qc.invalidateQueries({ queryKey: ['resenas'] })
    } catch (e) { setError(mensajeDeError(e)) }
  }

  const lista = q.data ?? []
  const media = lista.length ? lista.reduce((t, r) => t + r.rating, 0) / lista.length : 0

  return (
    <div className="p-5 space-y-4">
      <Volver />
      <div>
        <h1 className="text-[30px] leading-tight">Opiniones</h1>
        <p className="text-[14px] text-tinta-tenue mt-1">
          Las clientas valoran su cita desde el enlace del mensaje de «gracias». Publica las que quieras mostrar en la web.
        </p>
      </div>

      {q.isLoading && <Esqueleto className="h-32" />}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
      {error && <Aviso>{error}</Aviso>}

      {lista.length > 0 && (
        <Tarjeta className="flex items-center justify-between">
          <div>
            <div className="font-display text-[28px] leading-none">{media.toFixed(1)}</div>
            <div className="text-[12px] text-tinta-tenue mt-1">{lista.length} {lista.length === 1 ? 'opinión' : 'opiniones'}</div>
          </div>
          <Estrellas valor={media} tam={22} />
        </Tarjeta>
      )}

      {q.data && lista.length === 0 && (
        <Vacio titulo="Aún no hay opiniones"
               texto="Cuando completes una cita, envía «Dar las gracias y pedir su opinión» desde el detalle de la cita." />
      )}

      <div className="space-y-2">
        {lista.map(r => (
          <Tarjeta key={r.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Estrellas valor={r.rating} tam={16} />
              <span className="text-[12px] text-tinta-tenue first-letter:uppercase">{fechaLarga(r.created_at)}</span>
            </div>
            {r.comment && <p className="text-[15px]">«{r.comment}»</p>}
            <Link to={`/panel/cita/${r.appointment_id}`} className="block text-[13px] text-rosa-800 font-medium">
              {r.clients?.full_name ?? 'Clienta'} · ver cita
            </Link>
            <div className="flex gap-2 pt-1">
              <button onClick={() => cambiar(r, !r.is_published)}
                className={`flex-1 min-h-[40px] rounded-full text-[13px] font-semibold
                  ${r.is_published ? 'border border-rosa-200 text-tinta-suave' : 'bg-rosa-600 text-white'}`}>
                {r.is_published ? 'Quitar de la web' : 'Publicar en la web'}
              </button>
              <button onClick={() => borrar(r)} className="min-h-[40px] px-3 text-[13px] text-estado-error">Borrar</button>
            </div>
            {r.is_published && <div className="text-[12px] text-estado-exito">● Se ve en la página de inicio</div>}
          </Tarjeta>
        ))}
      </div>
    </div>
  )
}
