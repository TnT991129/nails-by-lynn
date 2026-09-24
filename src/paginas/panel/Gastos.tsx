import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listarGastos, crearGasto, eliminarGasto, type CategoriaGasto } from '../../lib/panel/api-panel'
import { Boton, Campo, Tarjeta, Esqueleto, Aviso, Etiqueta } from '../../componentes/ui'
import { fechaLarga } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

const CATEGORIAS: { key: CategoriaGasto; etiqueta: string; icono: string }[] = [
  { key: 'MATERIAL',    etiqueta: 'Material',    icono: '💅' },
  { key: 'HERRAMIENTAS',etiqueta: 'Herramientas',icono: '🛠' },
  { key: 'LOCAL',       etiqueta: 'Local',       icono: '🏠' },
  { key: 'TRANSPORTE',  etiqueta: 'Transporte',  icono: '🚗' },
  { key: 'MARKETING',   etiqueta: 'Marketing',   icono: '📢' },
  { key: 'OTRO',        etiqueta: 'Otro',        icono: '📦' },
]

function iconoCat(c: string) {
  return CATEGORIAS.find(x => x.key === c)?.icono ?? '📦'
}
function etiquetaCat(c: string) {
  return CATEGORIAS.find(x => x.key === c)?.etiqueta ?? c
}

export default function Gastos() {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [nuevo, setNuevo] = useState(false)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [categoria, setCategoria] = useState<CategoriaGasto>('MATERIAL')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<'CUP' | 'USD'>('CUP')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = useQuery({ queryKey: ['gastos'], queryFn: () => listarGastos(100) })

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      const m = Number(monto)
      if (isNaN(m) || m <= 0) throw new Error('Monto inválido')
      if (!descripcion.trim()) throw new Error('Escribe qué compraste')
      await crearGasto({ date: fecha, category: categoria, description: descripcion.trim(), amount: m, currency: moneda })
      qc.invalidateQueries({ queryKey: ['gastos'] })
      qc.invalidateQueries({ queryKey: ['resumen'] })
      setNuevo(false); setDescripcion(''); setMonto(''); setCategoria('MATERIAL')
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    try {
      await eliminarGasto(id)
      qc.invalidateQueries({ queryKey: ['gastos'] })
      qc.invalidateQueries({ queryKey: ['resumen'] })
    } catch (e) { alert(mensajeDeError(e)) }
  }

  // Agrupar por mes
  const porMes: Record<string, typeof q.data> = {}
  q.data?.forEach(g => {
    const clave = g.date.slice(0, 7)  // YYYY-MM
    ;(porMes[clave] ??= []).push(g)
  })

  return (
    <div className="p-5 space-y-4">
      <button onClick={() => navegar(-1)} className="text-tinta-suave min-h-[44px]">← Volver</button>
      <h1 className="font-display text-[30px]">Gastos</h1>

      {!nuevo && <Boton ancho onClick={() => setNuevo(true)}>+ Nuevo gasto</Boton>}

      {nuevo && (
        <Tarjeta className="space-y-3">
          <div>
            <Etiqueta>Categoría</Etiqueta>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {CATEGORIAS.map(c => (
                <button key={c.key} onClick={() => setCategoria(c.key)}
                  className={`p-3 rounded-sm border min-h-[64px] text-center
                    ${categoria === c.key ? 'border-rosa-600 bg-rosa-50' : 'border-rosa-200 bg-white'}`}>
                  <div className="text-[20px]">{c.icono}</div>
                  <div className="text-[11px] mt-1">{c.etiqueta}</div>
                </button>
              ))}
            </div>
          </div>

          <Campo etiqueta="Fecha" type="date" value={fecha}
                 onChange={e => setFecha(e.target.value)} />

          <label className="block">
            <span className="block text-[14px] text-tinta-suave mb-1.5">Qué compraste</span>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: esmalte rosa Kiara Sky, alcohol 90%…"
              className="w-full min-h-[44px] px-3 rounded-sm border border-rosa-200 text-[16px]" />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="block col-span-2">
              <span className="block text-[14px] text-tinta-suave mb-1.5">Monto</span>
              <input value={monto} onChange={e => setMonto(e.target.value)} inputMode="decimal"
                className="w-full min-h-[44px] px-3 rounded-sm border border-rosa-200 text-[16px]" />
            </label>
            <label className="block">
              <span className="block text-[14px] text-tinta-suave mb-1.5">Moneda</span>
              <select value={moneda} onChange={e => setMoneda(e.target.value as 'CUP' | 'USD')}
                className="w-full min-h-[44px] px-3 rounded-sm border border-rosa-200 text-[16px] bg-white">
                <option value="CUP">CUP</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>

          {error && <Aviso>{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setNuevo(false)} className="flex-1">Cancelar</Boton>
            <Boton onClick={guardar} cargando={guardando} className="flex-1">Guardar</Boton>
          </div>
        </Tarjeta>
      )}

      {q.isLoading && <Esqueleto className="h-24" />}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
      {q.data && q.data.length === 0 && !nuevo && (
        <p className="text-[14px] text-tinta-tenue text-center py-8">
          Aún no registraste ningún gasto.
        </p>
      )}

      <div className="space-y-4">
        {Object.entries(porMes).map(([mesClave, gastos]) => {
          const total = gastos?.reduce((t, g) => t + Number(g.amount), 0) ?? 0
          const [a, m] = mesClave.split('-')
          const nombreMes = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' })
            .format(new Date(Number(a), Number(m) - 1, 1))
          return (
            <section key={mesClave}>
              <div className="flex justify-between items-baseline mb-2">
                <h3 className="text-[14px] font-medium capitalize">{nombreMes}</h3>
                <span className="text-[14px] font-display">{total.toLocaleString('es-CU')} CUP</span>
              </div>
              <div className="space-y-2">
                {gastos?.map(g => (
                  <Tarjeta key={g.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[24px] shrink-0">{iconoCat(g.category)}</span>
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium truncate">
                          {g.description || etiquetaCat(g.category)}
                        </div>
                        <div className="text-[12px] text-tinta-tenue capitalize">
                          {fechaLarga(new Date(g.date + 'T12:00:00').toISOString())}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[14px] font-display">
                        {Number(g.amount).toLocaleString('es-CU')} {g.currency}
                      </div>
                      <button onClick={() => eliminar(g.id)}
                        className="text-[12px] text-estado-error min-h-[44px]">Eliminar</button>
                    </div>
                  </Tarjeta>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
