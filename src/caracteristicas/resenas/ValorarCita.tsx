import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { dejarResena } from '../../lib/api'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import Estrellas from '../../componentes/Estrellas'
import { mensajeDeError } from '../../lib/errores'

// Después de la cita la clienta deja de 1 a 5 estrellas y un comentario. Lynn decide si se publica.
export default function ValorarCita({ token, resena }: {
  token: string; resena?: { estrellas: number; comentario: string | null } | null
}) {
  const qc = useQueryClient()
  const [estrellas, setEstrellas] = useState(resena?.estrellas ?? 0)
  const [comentario, setComentario] = useState(resena?.comentario ?? '')
  const [editando, setEditando] = useState(!resena)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar() {
    if (estrellas < 1) { setError('Toca las estrellas para valorar.'); return }
    setEnviando(true); setError(null)
    try {
      await dejarResena(token, estrellas, comentario.trim() || null)
      qc.invalidateQueries({ queryKey: ['cita', token] })
      setEditando(false)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setEnviando(false) }
  }

  if (!editando && resena) return (
    <Tarjeta className="space-y-2 text-center">
      <div className="text-[15px] font-semibold">¡Gracias por tu valoración! 💖</div>
      <div className="flex justify-center"><Estrellas valor={resena.estrellas} tam={22} /></div>
      {resena.comentario && <p className="text-[14px] text-tinta-suave italic">«{resena.comentario}»</p>}
      <button onClick={() => setEditando(true)} className="text-[13px] text-rosa-800 underline min-h-[40px]">
        Cambiar mi valoración
      </button>
    </Tarjeta>
  )

  return (
    <Tarjeta className="space-y-3">
      <div className="text-center">
        <div className="text-[17px] font-semibold">¿Qué tal te quedaron? 💅</div>
        <p className="text-[13px] text-tinta-tenue mt-0.5">Tu opinión ayuda a Lynn y a otras clientas.</p>
      </div>
      <div className="flex justify-center"><Estrellas valor={estrellas} onElegir={setEstrellas} tam={34} /></div>
      <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3} maxLength={600}
        placeholder="Cuéntanos qué te gustó (opcional)"
        className="w-full px-3 py-2 rounded-lg border border-rosa-200 text-[16px] bg-papel
                   focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
      {error && <Aviso>{error}</Aviso>}
      <Boton ancho onClick={enviar} cargando={enviando}>Enviar valoración</Boton>
    </Tarjeta>
  )
}
