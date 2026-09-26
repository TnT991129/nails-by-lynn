import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { aplicarDescuento, quitarDescuento, type Cliente } from '../../lib/panel/api-panel'
import { enlaceWhatsApp, mensajeDescuento } from '../../lib/panel/whatsapp'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'
import { mensajeDeError } from '../../lib/errores'

const RAPIDOS = [10, 15, 20, 25]

// Descuento para la próxima cita de la clienta. Se aplica solo al reservar y luego se consume.
export default function DescuentoClienta({ clienta }: { clienta: Cliente }) {
  const qc = useQueryClient()
  const activo = clienta.next_discount_percent ? Number(clienta.next_discount_percent) : null
  const [pct, setPct] = useState('15')
  const [nota, setNota] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nombre = clienta.full_name.trim().split(/\s+/)[0]

  function refrescar() {
    qc.invalidateQueries({ queryKey: ['cli', clienta.id] })
    qc.invalidateQueries({ queryKey: ['clientas'] })
  }

  async function aplicar() {
    const n = Number(pct.replace(',', '.'))
    if (!(n > 0 && n <= 100)) { setError('Pon un porcentaje entre 1 y 100.'); return }
    setTrabajando(true); setError(null)
    try { await aplicarDescuento(clienta.id, n, nota.trim() || null); refrescar() }
    catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  async function quitar() {
    if (!confirm('¿Quitar el descuento de su próxima cita?')) return
    setTrabajando(true); setError(null)
    try { await quitarDescuento(clienta.id); refrescar() }
    catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  return (
    <Tarjeta className="space-y-3">
      <div className="text-[14px] text-tinta-tenue">Descuento en su próxima cita</div>

      {activo ? (
        <>
          <div className="rounded-lg bg-rosa-50 border border-rosa-100 p-3">
            <div className="text-[18px] font-semibold text-rosa-800">🎁 {activo}% de descuento</div>
            {clienta.next_discount_note && <div className="text-[14px] text-tinta-suave mt-0.5">{clienta.next_discount_note}</div>}
            <div className="text-[12px] text-tinta-tenue mt-1">Se aplicará solo cuando reserve (por la web o manual).</div>
          </div>
          <a href={enlaceWhatsApp(clienta.phone, mensajeDescuento(clienta.full_name, activo, clienta.next_discount_note ?? null))}
             target="_blank" rel="noreferrer"
             className="w-full min-h-[52px] rounded-full bg-[#25D366] text-white font-semibold text-[15px]
                        flex items-center justify-center gap-2 active:scale-[0.98] transition
                        shadow-[0_10px_24px_-10px_rgba(37,211,102,.7)]">
            <IconoWhatsApp tam={20} /> Avisar a {nombre} por WhatsApp
          </a>
          <button onClick={quitar} disabled={trabajando}
                  className="w-full text-[13px] text-estado-error min-h-[40px] disabled:opacity-50">
            Quitar descuento
          </button>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            {RAPIDOS.map(n => (
              <button key={n} onClick={() => setPct(String(n))}
                className={`flex-1 min-h-[44px] rounded-full border text-[14px] font-semibold transition
                  ${pct === String(n) ? 'bg-rosa-600 border-rosa-600 text-white' : 'border-rosa-200 bg-white text-tinta-suave'}`}>
                {n}%
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <label className="block">
              <span className="block text-[13px] text-tinta-suave mb-1">Otro %</span>
              <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal"
                className="w-full min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-white
                           focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
            </label>
            <label className="block">
              <span className="block text-[13px] text-tinta-suave mb-1">Motivo (opcional)</span>
              <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: por tu cumpleaños"
                className="w-full min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-white
                           focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
            </label>
          </div>
          <Boton ancho cargando={trabajando} onClick={aplicar}>Aplicar descuento</Boton>
          <p className="text-[12px] text-tinta-tenue">Después podrás avisarle por WhatsApp con un toque.</p>
        </>
      )}
      {error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  )
}
