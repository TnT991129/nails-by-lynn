import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerTasaPanel, guardarTasa } from '../../lib/panel/api-panel'
import { Boton, Aviso } from '../../componentes/ui'
import { fechaISO } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

const CLAVE = 'nbl.panel.tasa-pospuesta'   // día en que Lynn tocó «Ahora no»

// Al abrir el panel, si el precio del dólar no es de hoy, se pide en una ventana (una vez al día)
export default function PedirTasa() {
  const qc = useQueryClient()
  const hoy = fechaISO(new Date())
  const q = useQuery({ queryKey: ['tasa-panel'], queryFn: obtenerTasaPanel })
  const [pospuesta, setPospuesta] = useState(() => { try { return localStorage.getItem(CLAVE) === hoy } catch { return false } })
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (q.isLoading || q.isError || pospuesta || q.data?.fecha === hoy) return null

  function posponer() {
    try { localStorage.setItem(CLAVE, hoy) } catch { /* sin almacenamiento: solo se cierra */ }
    setPospuesta(true)
  }

  async function guardar() {
    const n = Number(valor.replace(',', '.'))
    if (!(n > 0)) { setError('Escribe cuántos CUP vale 1 dólar hoy'); return }
    setGuardando(true); setError(null)
    try {
      await guardarTasa(n)
      qc.invalidateQueries({ queryKey: ['tasa-panel'] })
      qc.invalidateQueries({ queryKey: ['tasa'] })
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal>
      <div className="w-full max-w-sm bg-papel rounded-2xl p-5 space-y-4 shadow-xl animate-entrada">
        <div>
          <div className="text-[20px] font-semibold">💵 ¿A cuánto está el dólar hoy?</div>
          <p className="text-[14px] text-tinta-tenue mt-1">
            {q.data
              ? `El último que pusiste fue ${q.data.tasa.toLocaleString('es-CU')} CUP. Las clientas ven los precios en CUP con este valor.`
              : 'Las clientas verán debajo de cada precio su equivalente en CUP.'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-[17px]">
          <span className="shrink-0">1 USD =</span>
          <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" autoFocus
            placeholder={q.data ? String(q.data.tasa) : 'Ej: 480'}
            className="flex-1 min-w-0 min-h-[48px] px-3 rounded-lg border border-rosa-200 bg-papel text-[18px]" />
          <span className="shrink-0">CUP</span>
        </label>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={posponer} className="flex-1">Ahora no</Boton>
          <Boton onClick={guardar} cargando={guardando} className="flex-1">Guardar</Boton>
        </div>
      </div>
    </div>
  )
}
