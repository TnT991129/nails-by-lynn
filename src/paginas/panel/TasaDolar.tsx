import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerTasaPanel, guardarTasa } from '../../lib/panel/api-panel'
import { Tarjeta, Boton, Aviso } from '../../componentes/ui'
import { fechaISO, fechaLarga } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

// Precio del dólar del día: los precios están en USD y la web muestra debajo el equivalente en CUP
export default function TasaDolar() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['tasa-panel'], queryFn: obtenerTasaPanel })
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tasa = q.data
  const deHoy = tasa?.fecha === fechaISO(new Date())

  function abrir() {
    setValor(tasa ? String(tasa.tasa) : ''); setError(null); setEditando(true)
  }

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      const n = Number(valor.replace(',', '.'))
      if (!valor.trim() || isNaN(n) || n <= 0) throw new Error('Escribe cuántos CUP vale 1 dólar hoy')
      await guardarTasa(n)
      qc.invalidateQueries({ queryKey: ['tasa-panel'] })
      qc.invalidateQueries({ queryKey: ['tasa'] })
      qc.invalidateQueries({ queryKey: ['resumen'] })
      setEditando(false)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  if (q.isLoading) return null

  if (editando) return (
    <Tarjeta className="space-y-3">
      <div className="text-[14px] font-medium">💵 Precio del dólar hoy</div>
      <label className="flex items-center gap-2 text-[16px]">
        <span className="shrink-0">1 USD =</span>
        <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" autoFocus
          placeholder="Ej: 480"
          className="flex-1 min-w-0 min-h-[44px] px-3 rounded border border-rosa-200 bg-papel" />
        <span className="shrink-0">CUP</span>
      </label>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={() => setEditando(false)} className="flex-1">Cancelar</Boton>
        <Boton onClick={guardar} cargando={guardando} className="flex-1">Guardar</Boton>
      </div>
    </Tarjeta>
  )

  return (
    <Tarjeta className={`flex items-center justify-between gap-3 ${!deHoy ? 'border-estado-aviso' : ''}`}>
      <div className="min-w-0">
        <div className="text-[12px] tracking-wider uppercase text-tinta-tenue">Precio del dólar</div>
        {tasa ? (
          <>
            <div className="font-display text-[20px]">1 USD = {tasa.tasa.toLocaleString('es-CU')} CUP</div>
            <div className={`text-[12px] ${deHoy ? 'text-tinta-tenue' : 'text-estado-aviso'}`}>
              {deHoy ? 'Actualizado hoy' : <>Del {fechaLarga(tasa.fecha + 'T12:00:00')} · actualízalo</>}
            </div>
          </>
        ) : (
          <div className="text-[14px] text-estado-aviso">Sin poner: la web no muestra el precio en CUP</div>
        )}
      </div>
      <Boton variante={deHoy ? 'secundario' : 'primario'} onClick={abrir} className="shrink-0">
        {tasa ? 'Cambiar' : 'Poner'}
      </Boton>
    </Tarjeta>
  )
}
