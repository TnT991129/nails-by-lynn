import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { aplicarDescuentoCita, type CitaAgenda } from '../../lib/panel/api-panel'
import { enlaceWhatsApp, mensajeDescuentoCita } from '../../lib/panel/whatsapp'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'
import { fechaLarga, hora } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

const RAPIDOS = [10, 15, 20, 25]

// Descuento sobre una cita que ya está reservada: se recalcula el total al momento
export default function DescuentoCita({ cita }: { cita: CitaAgenda }) {
  const qc = useQueryClient()
  const actual = Number(cita.discount_percent ?? 0)
  const [abierto, setAbierto] = useState(false)
  const [pct, setPct] = useState(actual > 0 ? String(actual) : '15')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nombre = cita.cliente_nombre.trim().split(/\s+/)[0]
  const cuando = `${fechaLarga(cita.starts_at)} a las ${hora(cita.starts_at)}`

  async function guardar(porcentaje: number) {
    setTrabajando(true); setError(null)
    try {
      await aplicarDescuentoCita(cita.id, porcentaje)
      qc.invalidateQueries()   // cambian el total, la agenda y las estadísticas
      setAbierto(false)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  function aplicar() {
    const n = Number(pct.replace(',', '.'))
    if (!(n > 0 && n <= 100)) { setError('Pon un porcentaje entre 1 y 100.'); return }
    guardar(n)
  }

  if (!abierto) return (
    <Tarjeta className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] text-tinta-tenue">Descuento de esta cita</div>
          <div className="text-[16px] font-medium">{actual > 0 ? `🎁 ${actual}%` : 'Sin descuento'}</div>
        </div>
        <Boton variante="secundario" onClick={() => { setAbierto(true); setError(null) }} className="shrink-0 !min-h-[40px] !text-[14px]">
          {actual > 0 ? 'Cambiar' : 'Aplicar descuento'}
        </Boton>
      </div>
      {actual > 0 && (
        <a href={enlaceWhatsApp(cita.cliente_telefono, mensajeDescuentoCita(cita.cliente_nombre, actual, null, cuando))}
           target="_blank" rel="noreferrer"
           className="w-full min-h-[48px] rounded-full bg-whatsapp text-white font-semibold text-[15px]
                      flex items-center justify-center gap-2 active:scale-[0.98] transition">
          <IconoWhatsApp tam={20} /> Avisar a {nombre} por WhatsApp
        </a>
      )}
    </Tarjeta>
  )

  return (
    <Tarjeta className="space-y-3">
      <div className="text-[14px] text-tinta-tenue">Descuento de esta cita</div>
      <div className="flex gap-2">
        {RAPIDOS.map(n => (
          <button key={n} onClick={() => setPct(String(n))}
            className={`flex-1 min-h-[44px] rounded-full border text-[14px] font-semibold transition
              ${pct === String(n) ? 'bg-rosa-600 border-rosa-600 text-white' : 'border-rosa-200 bg-papel text-tinta-suave'}`}>
            {n}%
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <span className="text-[14px] text-tinta-suave shrink-0">Otro %</span>
        <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal"
          className="w-24 min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-papel" />
      </label>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={() => setAbierto(false)} className="flex-1">Cancelar</Boton>
        <Boton onClick={aplicar} cargando={trabajando} className="flex-1">Aplicar</Boton>
      </div>
      {actual > 0 && (
        <button onClick={() => guardar(0)} disabled={trabajando}
                className="w-full text-[13px] text-estado-error min-h-[40px] disabled:opacity-50">
          Quitar descuento
        </button>
      )}
    </Tarjeta>
  )
}
