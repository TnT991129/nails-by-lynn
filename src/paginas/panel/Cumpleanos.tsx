import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cumpleanosProximos, aplicarDescuento, type Cumple } from '../../lib/panel/api-panel'
import { enlaceWhatsApp, mensajeCumple } from '../../lib/panel/whatsapp'
import { Tarjeta, Aviso } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'
import { mensajeDeError } from '../../lib/errores'

const REGALO = 10   // % de descuento que se propone por el cumpleaños

// Clientas que cumplen años esta semana: felicitar con un toque y, si quiere, regalar un descuento
export default function Cumpleanos() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['cumples'], queryFn: () => cumpleanosProximos(7) })
  const [error, setError] = useState<string | null>(null)
  if (!q.data || q.data.length === 0) return null

  async function felicitar(c: Cumple, conRegalo: boolean) {
    setError(null)
    window.open(enlaceWhatsApp(c.phone, mensajeCumple(c.full_name, conRegalo ? REGALO : null)), '_blank', 'noopener,noreferrer')
    if (!conRegalo) return
    try {
      await aplicarDescuento(c.id, REGALO, '¡Feliz cumpleaños!')
      qc.invalidateQueries({ queryKey: ['cli', c.id] })
    } catch (e) { setError(mensajeDeError(e)) }
  }

  return (
    <Tarjeta className="space-y-3">
      <div className="text-[15px] font-semibold">🎂 Cumpleaños esta semana</div>
      <ul className="space-y-3">
        {q.data.map(c => (
          <li key={c.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link to={`/panel/clientas/${c.id}`} className="text-[15px] font-medium truncate underline-offset-2 hover:underline">
                {c.full_name}
              </Link>
              <span className={`text-[13px] shrink-0 ${c.dias === 0 ? 'text-rosa-700 font-semibold' : 'text-tinta-tenue'}`}>
                {c.dias === 0 ? '¡Hoy!' : c.dias === 1 ? 'Mañana' : `En ${c.dias} días`}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => felicitar(c, false)}
                className="flex-1 min-h-[40px] rounded-full border border-rosa-200 text-[13px] font-semibold
                           inline-flex items-center justify-center gap-1.5">
                <IconoWhatsApp tam={15} /> Felicitar
              </button>
              <button onClick={() => felicitar(c, true)}
                className="flex-1 min-h-[40px] rounded-full bg-whatsapp text-white text-[13px] font-semibold
                           inline-flex items-center justify-center gap-1.5">
                🎁 Con {REGALO}% dto.
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  )
}
