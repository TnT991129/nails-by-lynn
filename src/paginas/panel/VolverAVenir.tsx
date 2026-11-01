import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { clientasParaVolver, type ParaVolver } from '../../lib/panel/api-panel'
import { enlaceWhatsApp, mensajeVolver } from '../../lib/panel/whatsapp'
import { Tarjeta } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'

const CLAVE = 'nbl.panel.volver'      // clientas ya invitadas en este móvil: id → fecha
const SILENCIO_DIAS = 30              // no se vuelve a proponer la misma clienta en un mes
const MOSTRAR = 4

function leerAvisadas(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? '{}') } catch { return {} }
}

// Clientas que hace semanas que no vienen y no tienen otra cita: invitarlas por WhatsApp con un toque
export default function VolverAVenir() {
  const q = useQuery({ queryKey: ['para-volver'], queryFn: () => clientasParaVolver() })
  const [avisadas, setAvisadas] = useState(leerAvisadas)
  const [todas, setTodas] = useState(false)

  const limite = Date.now() - SILENCIO_DIAS * 86_400_000
  const lista = (q.data ?? []).filter(c => !(avisadas[c.id] > limite))
  if (lista.length === 0) return null

  function apartar(c: ParaVolver, invitar: boolean) {
    if (invitar) {
      window.open(enlaceWhatsApp(c.phone, mensajeVolver(c.full_name, Math.floor(c.dias / 7))), '_blank', 'noopener,noreferrer')
    }
    // Se limpian las marcas viejas para que no crezca sin fin
    const nuevas = Object.fromEntries(Object.entries({ ...avisadas, [c.id]: Date.now() }).filter(([, t]) => t > limite))
    setAvisadas(nuevas)
    try { localStorage.setItem(CLAVE, JSON.stringify(nuevas)) } catch { /* sin almacenamiento: solo por esta vez */ }
  }

  const visibles = todas ? lista : lista.slice(0, MOSTRAR)

  return (
    <Tarjeta className="space-y-3">
      <div>
        <div className="text-[15px] font-semibold">💅 Hace tiempo que no vienen</div>
        <div className="text-[12px] text-tinta-tenue">Su última cita fue hace 3 a 8 semanas y no tienen otra reservada</div>
      </div>
      <ul className="space-y-3">
        {visibles.map(c => (
          <li key={c.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link to={`/panel/clientas/${c.id}`} className="text-[15px] font-medium truncate underline-offset-2 hover:underline">
                {c.full_name}
              </Link>
              <span className="text-[13px] shrink-0 text-tinta-tenue">Hace {Math.floor(c.dias / 7)} semanas</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => apartar(c, true)}
                className="flex-1 min-h-[40px] rounded-full bg-whatsapp text-white text-[13px] font-semibold
                           inline-flex items-center justify-center gap-1.5">
                <IconoWhatsApp tam={15} /> Invitar a volver
              </button>
              <button onClick={() => apartar(c, false)}
                className="min-h-[40px] px-4 rounded-full border border-rosa-200 text-[13px] text-tinta-suave">
                Ahora no
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!todas && lista.length > MOSTRAR && (
        <button onClick={() => setTodas(true)} className="w-full min-h-[40px] text-[13px] text-tinta-suave underline underline-offset-2">
          Ver las {lista.length}
        </button>
      )}
    </Tarjeta>
  )
}
