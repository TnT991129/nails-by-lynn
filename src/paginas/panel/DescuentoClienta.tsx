import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { aplicarDescuento, quitarDescuento, aplicarDescuentoCita, type Cliente, type CitaAgenda } from '../../lib/panel/api-panel'
import { enlaceWhatsApp, mensajeDescuento, mensajeDescuentoCita } from '../../lib/panel/whatsapp'
import { fechaLarga, hora } from '../../lib/formato'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'
import { mensajeDeError } from '../../lib/errores'

const RAPIDOS = [10, 15, 20, 25]

// Descuento para la próxima cita de la clienta.
// Si ya tiene una cita reservada, se aplica directamente a esa cita;
// si no, queda guardado y se aplica solo cuando reserve (y luego se consume).
export default function DescuentoClienta({ clienta, proxima }: { clienta: Cliente; proxima?: CitaAgenda }) {
  const qc = useQueryClient()
  const activo = clienta.next_discount_percent ? Number(clienta.next_discount_percent) : null
  const [pct, setPct] = useState('15')
  const [nota, setNota] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nombre = clienta.full_name.trim().split(/\s+/)[0]

  const descCita = proxima ? Number(proxima.discount_percent ?? 0) : 0
  const cuando = proxima ? `${fechaLarga(proxima.starts_at)} a las ${hora(proxima.starts_at)}` : ''

  function refrescar() {
    qc.invalidateQueries({ queryKey: ['cli', clienta.id] })
    qc.invalidateQueries({ queryKey: ['clientas'] })
  }

  async function aplicar() {
    const n = Number(pct.replace(',', '.'))
    if (!(n > 0 && n <= 100)) { setError('Pon un porcentaje entre 1 y 100.'); return }
    setTrabajando(true); setError(null)
    try {
      if (proxima) {
        await aplicarDescuentoCita(proxima.id, n)
        qc.invalidateQueries()   // cambia el total de la cita
      } else {
        await aplicarDescuento(clienta.id, n, nota.trim() || null); refrescar()
      }
    }
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

      {!activo && descCita > 0 && proxima ? (
        <>
          <div className="rounded-lg bg-rosa-50 border border-rosa-100 p-3">
            <div className="text-[18px] font-semibold text-rosa-800">🎁 {descCita}% de descuento</div>
            <div className="text-[12px] text-tinta-tenue mt-1 first-letter:uppercase">
              Aplicado a su cita del {cuando}. Para cambiarlo, abre la cita.
            </div>
          </div>
          <a href={enlaceWhatsApp(clienta.phone, mensajeDescuentoCita(clienta.full_name, descCita, null, cuando))}
             target="_blank" rel="noreferrer"
             className="w-full min-h-[52px] rounded-full bg-whatsapp text-white font-semibold text-[15px]
                        flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <IconoWhatsApp tam={20} /> Avisar a {nombre} por WhatsApp
          </a>
        </>
      ) : activo ? (
        <>
          <div className="rounded-lg bg-rosa-50 border border-rosa-100 p-3">
            <div className="text-[18px] font-semibold text-rosa-800">🎁 {activo}% de descuento</div>
            {clienta.next_discount_note && <div className="text-[14px] text-tinta-suave mt-0.5">{clienta.next_discount_note}</div>}
            <div className="text-[12px] text-tinta-tenue mt-1">Se aplicará solo cuando reserve (por la web o manual).</div>
          </div>
          <a href={enlaceWhatsApp(clienta.phone, mensajeDescuento(clienta.full_name, activo, clienta.next_discount_note ?? null))}
             target="_blank" rel="noreferrer"
             className="w-full min-h-[52px] rounded-full bg-whatsapp text-white font-semibold text-[15px]
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
                  ${pct === String(n) ? 'bg-rosa-600 border-rosa-600 text-white' : 'border-rosa-200 bg-papel text-tinta-suave'}`}>
                {n}%
              </button>
            ))}
          </div>
          <div className={`grid gap-2 ${proxima ? 'grid-cols-[110px]' : 'grid-cols-[110px_1fr]'}`}>
            <label className="block">
              <span className="block text-[13px] text-tinta-suave mb-1">Otro %</span>
              <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal"
                className="w-full min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-papel
                           focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
            </label>
            {/* El motivo solo se guarda para el descuento de la próxima reserva */}
            {!proxima && <label className="block">
              <span className="block text-[13px] text-tinta-suave mb-1">Motivo (opcional)</span>
              <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: por tu cumpleaños"
                className="w-full min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-papel
                           focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
            </label>}
          </div>
          <Boton ancho cargando={trabajando} onClick={aplicar}>Aplicar descuento</Boton>
          <p className="text-[12px] text-tinta-tenue">
            {proxima
              ? <>Se aplica a su cita del {cuando}. Después podrás avisarle por WhatsApp.</>
              : 'Se aplicará cuando reserve. Después podrás avisarle por WhatsApp con un toque.'}
          </p>
        </>
      )}
      {error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  )
}
