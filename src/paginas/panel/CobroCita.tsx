import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cobrosDeCita, registrarCobro, eliminarCobro, cobroEnUsd, obtenerTasaPanel,
  type CitaAgenda, type MetodoCobro,
} from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import { importe, precioRango } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

const FORMAS: { clave: string; etiqueta: string; metodo: MetodoCobro; moneda: 'CUP' | 'USD' }[] = [
  { clave: 'ef-cup', etiqueta: 'Efectivo CUP',  metodo: 'EFECTIVO',      moneda: 'CUP' },
  { clave: 'ef-usd', etiqueta: 'Efectivo USD',  metodo: 'EFECTIVO',      moneda: 'USD' },
  { clave: 'tm',     etiqueta: 'Transfermóvil', metodo: 'TRANSFERMOVIL', moneda: 'CUP' },
  { clave: 'ez',     etiqueta: 'EnZona',        metodo: 'ENZONA',        moneda: 'CUP' },
]
const NOMBRE_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERMOVIL: 'Transfermóvil', ENZONA: 'EnZona', TRANSFERENCIA: 'Transferencia', OTRO: 'Otro',
}

// Lo que pagó la clienta: se puede cobrar en varias partes y en CUP o USD
export default function CobroCita({ cita }: { cita: CitaAgenda }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['cobros', cita.id], queryFn: () => cobrosDeCita(cita.id) })
  const qTasa = useQuery({ queryKey: ['tasa-panel'], queryFn: obtenerTasaPanel })
  const tasa = qTasa.data?.tasa ?? null
  const [abierto, setAbierto] = useState(false)
  const [forma, setForma] = useState(FORMAS[0].clave)
  const [monto, setMonto] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = Number(cita.total_amount)
  const pagado = (q.data ?? []).reduce((t, c) => t + cobroEnUsd(c, tasa), 0)
  const falta = Math.max(0, Math.round((total - pagado) * 100) / 100)
  const f = FORMAS.find(x => x.clave === forma)!

  // Al abrir o cambiar de forma de pago se propone lo que falta, en la moneda elegida
  function sugerir(clave: string) {
    setForma(clave)
    const fx = FORMAS.find(x => x.clave === clave)!
    if (falta <= 0) { setMonto(''); return }
    setMonto(fx.moneda === 'USD' ? String(falta) : tasa ? String(Math.round(falta * tasa)) : '')
  }

  async function guardar() {
    const n = Number(monto.replace(',', '.'))
    if (!(n > 0)) { setError('Escribe cuánto pagó.'); return }
    setTrabajando(true); setError(null)
    try {
      await registrarCobro({ citaId: cita.id, monto: n, moneda: f.moneda, metodo: f.metodo, tasa })
      qc.invalidateQueries({ queryKey: ['cobros', cita.id] })
      qc.invalidateQueries({ queryKey: ['cobrado'] })
      setAbierto(false)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  async function quitar(id: string) {
    if (!confirm('¿Borrar este cobro?')) return
    try {
      await eliminarCobro(id)
      qc.invalidateQueries({ queryKey: ['cobros', cita.id] })
      qc.invalidateQueries({ queryKey: ['cobrado'] })
    } catch (e) { setError(mensajeDeError(e)) }
  }

  if (q.isLoading) return null

  return (
    <Tarjeta className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] text-tinta-tenue">Cobro</div>
          <div className={`text-[16px] font-semibold ${falta <= 0 && total > 0 ? 'text-estado-exito' : ''}`}>
            {total <= 0 ? 'Sin precio' : falta <= 0 ? '✓ Pagado' : pagado > 0 ? `Falta ${importe(falta)}` : `Pendiente · ${precioRango(total, cita.total_amount_max)}`}
          </div>
        </div>
        {!abierto && falta > 0 && (
          <Boton onClick={() => { setAbierto(true); setError(null); sugerir(forma) }} className="shrink-0 !min-h-[40px] !text-[14px]">
            Cobrar
          </Boton>
        )}
      </div>

      {(q.data ?? []).length > 0 && (
        <ul className="space-y-1 text-[14px]">
          {q.data!.map(c => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span>
                {importe(Number(c.amount), c.currency)} · {NOMBRE_METODO[c.method ?? 'OTRO']}
                {c.currency === 'CUP' && <span className="text-tinta-tenue"> (≈ {importe(cobroEnUsd(c, tasa))})</span>}
              </span>
              <button onClick={() => quitar(c.id)} className="text-[12px] text-estado-error min-h-[36px] px-1">Quitar</button>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            {FORMAS.map(x => (
              <button key={x.clave} onClick={() => sugerir(x.clave)}
                className={`min-h-[44px] rounded-full border text-[14px] font-semibold transition
                  ${forma === x.clave ? 'bg-rosa-600 border-rosa-600 text-white' : 'border-rosa-200 bg-papel text-tinta-suave'}`}>
                {x.etiqueta}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-[14px] text-tinta-suave shrink-0">Monto</span>
            <input value={monto} onChange={e => setMonto(e.target.value)} inputMode="decimal" autoFocus
              className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-papel" />
            <span className="text-[14px] shrink-0">{f.moneda}</span>
          </label>
          {f.moneda === 'CUP' && !tasa && (
            <p className="text-[12px] text-estado-aviso">Pon el precio del dólar en «Hoy» para pasar los CUP a dólares.</p>
          )}
          {error && <Aviso>{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setAbierto(false)} className="flex-1">Cancelar</Boton>
            <Boton onClick={guardar} cargando={trabajando} className="flex-1">Guardar</Boton>
          </div>
        </div>
      )}
      {!abierto && error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  )
}
